// Visual calculations edit mode: formula bar with templates, a preview of the visual, and the visual matrix.
import React, { useMemo, useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { I } from '../icons';
import { menuBelow } from '../common';
import { CodeEditor } from '../CodeEditor';
import { FieldRef, Visual } from '../../model/types';
import { summarize, visualContext, fieldLabel, fmt, formatFor, isValueField, drillLevels, sortRows } from '../../report/query';
import { VC_TEMPLATES } from '../../report/visualcalc';
import { vdef } from '../../report/visuals';
import { VisualBody } from './Canvas';
import { clearQueryCache } from './vhelpers';
import { splitDefinition } from '../../dax/parser';

const close = () => store.closeDialog();
const valueWell = (v: Visual) => (v.type === 'table' ? 'columns' : vdef(v.type).wells.find(w => w.kind === 'value')?.key ?? 'values');

export function startVisualCalc(visualId?: string) {
  const s = store; const v = visualId ? s.findVisual(visualId) : s.selectedVisual();
  if (!v || !vdef(v.type).wells.some(w => w.kind === 'value' || w.kind === 'any')) { s.toast('Select a chart, table, matrix or card first. Visual calculations belong to one visual.', 'error'); return; }
  s.openDialog({ type: 'visualCalc', visualId: v.id });
}

export function VisualCalcEditor({ d }: { d: DialogT }) {
  const s = store; const m = s.project.model;
  const v = s.findVisual(d.visualId)!;
  const page = s.project.report.pages.find(p => p.visuals.some(x => x.id === v.id))!;
  const wk = valueWell(v);
  const existing = d.edit ? (v.wells[wk] ?? []).find(f => f.visualCalc === d.edit) : undefined;
  const taken = Object.values(v.wells).flat().filter(f => f.visualCalc).map(f => f.visualCalc!);
  const defaultName = (() => { let n = 'Calculation', i = 1; while (taken.includes(n)) n = `Calculation ${++i}`; return n; })();
  const [text, setText] = useState(existing ? `${existing.visualCalc} = ${existing.calcExpr}` : `${defaultName} = `);
  const [format, setFormat] = useState(existing?.calcFormat ?? '');
  const [err, setErr] = useState<string | null>(null);
  const firstValue = (v.wells[wk] ?? []).find(f => isValueField(m, f) && !f.visualCalc) ?? (v.wells[wk] ?? []).find(f => !f.visualCalc);
  const def = splitDefinition(text);
  // a draft copy of the visual with the calculation in place, for the preview and the matrix
  const draft: Visual = useMemo(() => {
    const x: Visual = JSON.parse(JSON.stringify(v));
    if (def?.name && def.expr) {
      const f: FieldRef = { table: '', visualCalc: def.name, calcExpr: def.expr, calcFormat: format || undefined };
      const list = (x.wells[wk] ?? []).filter(g => g.visualCalc !== (existing?.visualCalc ?? '\u0000'));
      const at = existing ? (v.wells[wk] ?? []).findIndex(g => g.visualCalc === existing.visualCalc) : list.length;
      list.splice(Math.max(0, at), 0, f);
      x.wells[wk] = list;
    }
    return x;
  }, [text, format]);
  const matrix = useMemo(() => {
    try {
      const groupWells = vdef(draft.type).wells.filter(w => w.kind === 'group' && w.key !== 'tooltips').map(w => w.key);
      const groups = draft.type === 'table' ? (draft.wells.columns ?? []).filter(f => !isValueField(m, f)) : groupWells.flatMap(k => (k === 'axis' || k === 'rows' ? drillLevels(s, draft, k).levels : draft.wells[k] ?? []));
      const values = (draft.wells[wk] ?? []).filter(f => isValueField(m, f));
      const res = summarize(s, groups, values, visualContext(s, page, draft), draft.type === 'matrix' ? { lattice: { rows: groups.slice(0, groups.length - (draft.wells.cols?.length ?? 0)), cols: groups.slice(groups.length - (draft.wells.cols?.length ?? 0)), rowLevels: [...Array(groups.length - (draft.wells.cols?.length ?? 0) + 1).keys()], colLevels: [...Array((draft.wells.cols?.length ?? 0) + 1).keys()] } } : {});
      return { res: { ...res, rows: sortRows(s, res.rows, groups) }, error: null };
    } catch (e) { return { res: null, error: (e as Error).message }; }
  }, [draft]);
  const commit = () => {
    if (!def) { setErr('Write the calculation as Name = expression.'); return; }
    if (!def.expr) { setErr('The expression is empty.'); return; }
    if (taken.includes(def.name) && def.name !== existing?.visualCalc) { setErr(`This visual already has a calculation named '${def.name}'.`); return; }
    if (matrix.error) { setErr(matrix.error); return; }
    s.updateVisual(v.id, x => { x.wells[wk] = draft.wells[wk]; });
    clearQueryCache(); close();
    s.toast(`Visual calculation '${def.name}' ${existing ? 'updated' : 'added'}. It belongs to this visual only.`);
  };
  const toggleHidden = (f: FieldRef) => s.updateVisual(v.id, x => { for (const k of Object.keys(x.wells)) for (const g of x.wells[k]) if (fieldLabel(g) === fieldLabel(f)) g.hiddenInVisual = !g.hiddenInVisual; });
  const fieldsOnVisual = Object.entries(v.wells).filter(([k]) => k !== 'tooltips').flatMap(([, fs]) => fs);
  return <div className="overlay vc-overlay">
    <div className="vc-editor" role="dialog" aria-label="Visual calculations">
      <div className="vc-top">
        <b>Visual calculations</b><span className="tiny">Edit mode · {vdef(v.type).name}</span>
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={e => menuBelow(e.currentTarget, VC_TEMPLATES.map(t => ({ label: t.name, onClick: () => setText(`${t.name} = ${t.expr(firstValue ? fieldLabel(firstValue) : 'Field')}`) })))}><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><I n="visualCalc" s={14} />Templates</span></button>
        <button className="btn sm" onClick={close}>Back to report</button>
      </div>
      <div className="formula" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="fbtns"><button className="iconbtn" title="Cancel" onClick={close}><I n="cancel" s={18} /></button><button className="iconbtn" title="Commit (Enter)" onClick={commit}><I n="commit" s={18} /></button></div>
        <div className="ed" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !document.querySelector('.ac')) { e.preventDefault(); commit(); } }}>
          <CodeEditor id="vc-formula" value={text} onChange={t => { setText(t); setErr(null); }} lang="dax" autoFocus minHeight={34}
            suggestions={() => [...fieldsOnVisual.map(f => ({ text: `[${fieldLabel(f)}]`, kind: 'column' })), ...['RUNNINGSUM', 'MOVINGAVERAGE', 'PREVIOUS', 'NEXT', 'FIRST', 'LAST', 'COLLAPSE', 'COLLAPSEALL', 'EXPAND', 'EXPANDALL', 'ISATLEVEL', 'ROWNUMBER', 'DIVIDE', 'IF', 'SWITCH'].map(x => ({ text: x, insert: x + '()', kind: 'function' })), ...['ROWS', 'COLUMNS', 'HIGHESTPARENT', 'LOWESTPARENT', 'NONE'].map(x => ({ text: x, kind: 'keyword' }))]} />
        </div>
      </div>
      {err && <div className="errbox" style={{ margin: '4px 10px' }}>{err}</div>}
      <div className="vc-body">
        <div className="vc-main">
          <div className="vc-preview"><div className="vis" style={{ position: 'absolute', inset: 0 }}><div className="vis-body"><VisualBody v={draft} page={page} /></div></div></div>
          <div className="vc-matrix">
            <div className="section-h" style={{ margin: '0 0 4px' }}>Visual matrix</div>
            {matrix.error ? <div className="errbox">{matrix.error}</div> : matrix.res && <div style={{ overflow: 'auto', maxHeight: '100%' }}><table className="grid-table vtable"><thead><tr>{matrix.res.cols.map((c, i) => <th key={i} className={c.isValue ? 'num' : ''} style={{ color: c.field.hiddenInVisual ? '#8a8886' : undefined }}>{c.field.visualCalc && <I n="visualCalc" s={12} />} {c.label}</th>)}</tr></thead>
              <tbody>{matrix.res.rows.slice(0, 300).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className={matrix.res!.cols[j].isValue ? 'num' : ''}>{fmt(x, formatFor(m, matrix.res!.cols[j].field), matrix.res!.cols[j].field)}</td>)}</tr>)}</tbody></table></div>}
          </div>
        </div>
        <div className="vc-side">
          <div className="section-h" style={{ marginTop: 0 }}>Fields on the visual</div>
          {fieldsOnVisual.map((f, i) => <div key={i} className="tree-item" style={{ paddingLeft: 4 }}>
            <I n={f.visualCalc ? 'visualCalc' : f.measure ? 'fieldCalc' : 'fieldText'} s={14} /><span className="nm" style={{ color: f.hiddenInVisual ? '#8a8886' : undefined }}>{fieldLabel(f)}</span>
            <button className="iconbtn" title={f.hiddenInVisual ? 'Show on the visual' : 'Hide on the visual (still usable in calculations)'} onClick={() => toggleHidden(f)}><I n={f.hiddenInVisual ? 'eyeOff' : 'eye'} s={14} /></button>
            {f.visualCalc && f.visualCalc !== existing?.visualCalc && <button className="iconbtn" title="Edit calculation" onClick={() => { close(); s.openDialog({ type: 'visualCalc', visualId: v.id, edit: f.visualCalc }); }}><I n="edit" s={13} /></button>}
          </div>)}
          <div className="field" style={{ marginTop: 10 }}><label>Format string</label><input className="tx" value={format} placeholder="e.g. 0.0% or #,0" onChange={e => setFormat(e.target.value)} /></div>
          <div className="tiny" style={{ marginTop: 8, lineHeight: 1.5 }}>Visual calculations are DAX that runs on the visual's own rows and columns, so they can only refer to fields on the visual. They're stored in the visual, not the model, and can't be reused in other visuals. Use ROWS or COLUMNS to choose the axis, and HIGHESTPARENT / LOWESTPARENT to reset along a hierarchy.</div>
        </div>
      </div>
    </div>
  </div>;
}
