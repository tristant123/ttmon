// DAX query view: write EVALUATE queries, DEFINE measures, see results.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { DataPane } from '../panes/DataPane';
import { CodeEditor } from '../CodeEditor';
import { daxSuggestions } from '../FormulaBar';
import { Grid } from './Grid';
import { I } from '../icons';
import { DaxParser } from '../../dax/parser';
import { emptyCtx, VTable, isTableExpr } from '../../dax/engine';
import { compareValues } from '../../core/values';
import { formatValue } from '../../core/format';
import { Measure } from '../../model/types';
import { menuBelow } from '../common';

export function runDaxQuery(text: string): { cols: string[]; rows: any[][]; ms: number; error?: string } {
  const s = store; const eng = s.dax;
  const t0 = performance.now();
  try {
    const q = DaxParser.query(text);
    eng.extraMeasures.clear();
    let ctx = emptyCtx();
    for (const d of q.defines) {
      if (d.kind === 'MEASURE') eng.extraMeasures.set(d.name.toLowerCase(), { name: d.name, table: d.table ?? '', expression: text.slice(0, 0) || '' } as Measure);
    }
    // measures need their source text: re-serialise from the query by locating each DEFINE MEASURE
    const re = /MEASURE\s+(?:'[^']+'|[A-Za-z_][\w]*)?\s*\[([^\]]+)\]\s*=\s*([\s\S]*?)(?=\n\s*(?:MEASURE|VAR|TABLE|COLUMN|EVALUATE)\b|$)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) { const ms = eng.extraMeasures.get(m[1].toLowerCase()); if (ms) ms.expression = m[2].trim(); }
    for (const d of q.defines) if (d.kind === 'VAR' || d.kind === 'TABLE') {
      const v = isTableExpr(d.expr, eng, ctx) ? eng.tableExpr(d.expr, ctx) : eng.scalar(d.expr, ctx);
      const vars = new Map(ctx.vars ?? []); vars.set(d.name.toLowerCase(), v); ctx = { ...ctx, vars };
    }
    let last: VTable | null = null;
    for (const ev of q.evaluates) {
      let vt = eng.tableExpr(ev.expr, ctx);
      if (ev.orderBy.length) {
        const keys = vt.rows.map((_r, i) => ev.orderBy.map(o => eng.scalar(o.expr, { ...ctx, rows: [{ vt, i }] })));
        const idx = vt.rows.map((_r, i) => i).sort((a, b) => { for (let k = 0; k < ev.orderBy.length; k++) { const d = compareValues(keys[a][k], keys[b][k]) * (ev.orderBy[k].desc ? -1 : 1); if (d) return d; } return 0; });
        vt = new VTable(vt.cols, idx.map(i => vt.rows[i]));
      }
      last = vt;
    }
    const vt = last!;
    return { cols: vt.cols.map(c => (c.t ? `${c.t}[${c.c}]${c.part ? '.' + c.part : ''}` : `[${c.name}]`)), rows: vt.rows, ms: performance.now() - t0 };
  } catch (e) {
    return { cols: [], rows: [], ms: performance.now() - t0, error: (e as Error).message };
  } finally { eng.extraMeasures.clear(); }
}

export function DaxView() {
  const s = useStore();
  const [split, setSplit] = useState(45);
  const qs = s.ui.daxQueries;
  const active = qs.find(q => q.id === s.ui.daxActive) ?? qs[0];
  const setText = (text: string) => s.setUI({ daxQueries: qs.map(q => (q.id === active.id ? { ...q, text } : q)) });
  const run = () => s.setUI({ daxResult: runDaxQuery(active.text) });
  const res = s.ui.daxResult;
  const quick = (e: React.MouseEvent) => {
    const m = s.project.model;
    const qt = (t: string) => (/\s/.test(t) ? `'${t}'` : t);
    menuBelow(e.currentTarget as HTMLElement, [
      { header: 'Quick queries' },
      ...m.tables.slice(0, 12).map(t => ({ label: `Show top 100 rows: ${t.name}`, onClick: () => setText(`EVALUATE\n\tTOPN(100, ${qt(t.name)})`) })),
      { sep: true },
      ...m.measures.slice(0, 12).map(x => ({ label: `Evaluate: ${x.name}`, onClick: () => setText(`EVALUATE\n\tSUMMARIZECOLUMNS(\n\t\t"${x.name}", [${x.name}]\n\t)`) })),
      { label: 'Define all measures in the model', onClick: () => setText(`DEFINE\n${m.measures.map(x => `\tMEASURE ${qt(x.table)}[${x.name}] = ${x.expression}`).join('\n')}\n\nEVALUATE\n\tSUMMARIZECOLUMNS(\n${m.measures.slice(0, 4).map(x => `\t\t"${x.name}", [${x.name}]`).join(',\n')}\n\t)`) },
      { label: 'Column statistics', disabled: !m.tables.length, onClick: () => { const t = m.tables[0]; setText(`EVALUATE\n\tUNION(\n${t.columns.slice(0, 6).map(c => `\t\tROW("Column", "${c.name}", "Rows", COUNTROWS(${qt(t.name)}), "Distinct", DISTINCTCOUNT(${qt(t.name)}[${c.name}]), "Blanks", COUNTBLANK(${qt(t.name)}[${c.name}]))`).join(',\n')}\n\t)`); } },
    ]);
  };
  return <>
    <div className="center">
      <div className="daxv" style={{ gridTemplateRows: `34px ${split}% 6px 1fr 26px` }}>
        <div className="dax-tabs">
          <button className="btn sm primary" onClick={run} title="Run (Ctrl+Enter or F5)"><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><I n="runQuery" s={12} />Run</span></button>
          <button className="btn sm" onClick={quick}>Quick queries ▾</button>
          <span style={{ width: 10 }} />
          {qs.map(q => <button key={q.id} className={`dax-tab ${q.id === active.id ? 'active' : ''}`} onClick={() => s.setUI({ daxActive: q.id })} onDoubleClick={() => { const n = window.prompt?.('Rename query', q.name); if (n) s.setUI({ daxQueries: qs.map(x => (x.id === q.id ? { ...x, name: n } : x)) }); }}>
            {q.name}{qs.length > 1 && <span onClick={e => { e.stopPropagation(); const rest = qs.filter(x => x.id !== q.id); s.setUI({ daxQueries: rest, daxActive: rest[0].id }); }}><I n="close" s={10} /></span>}
          </button>)}
          <button className="iconbtn" title="New query" onClick={() => { const id = 'q' + Date.now(); s.setUI({ daxQueries: [...qs, { id, name: `Query ${qs.length + 1}`, text: 'EVALUATE\n\t' }], daxActive: id }); }}><I n="plus" s={14} /></button>
        </div>
        <CodeEditor key={active.id} value={active.text} onChange={setText} lang="dax" suggestions={daxSuggestions} onRun={run} autoFocus />
        <div className="splitter" onMouseDown={e => {
          const sy = e.clientY; const start = split; const h = (e.currentTarget.parentElement as HTMLElement).clientHeight;
          const mv = (ev: MouseEvent) => setSplit(Math.max(15, Math.min(80, start + ((ev.clientY - sy) / h) * 100)));
          const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
          window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!res && <div className="subtle" style={{ padding: 16 }}>Results appear here. Start with <code className="code">EVALUATE</code> followed by a table expression, for example <code className="code">EVALUATE VALUES('Product'[Category])</code> or <code className="code">EVALUATE SUMMARIZECOLUMNS('Date'[Year], "Sales", [Total Sales])</code>.</div>}
          {res?.error && <div className="errbox" style={{ margin: 12 }}><b>Query (error)</b>{'\n'}{res.error}</div>}
          {res && !res.error && <Grid cols={res.cols.map(c => ({ name: c, render: (v: any) => (v === null || v === undefined ? '' : formatValue(v)), num: false }))} rows={res.rows} />}
        </div>
        <div className="statusbar" style={{ borderTop: '1px solid #e1dfdd' }}>{res ? (res.error ? 'Query failed' : `Success · ${res.rows.length.toLocaleString()} row${res.rows.length === 1 ? '' : 's'} · ${res.ms.toFixed(0)} ms`) : 'Ready'}</div>
      </div>
    </div>
    <DataPane mode="dax" />
  </>;
}
