// The Power Query Editor window.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { I } from '../icons';
import { menuAt } from '../common';
import { PQRibbon } from './PQRibbon';
import { PQGrid } from './PQGrid';
import { analyseFolding, foldingQueries } from '../../m/folding';
import { switchToImport } from '../actions';
import { pq, setPQ, currentQuery, stepsOf, selectedStepIndex, stepResult, deleteStep, renameStep, moveStep, updateQuery, addQuery, invalidate, closeAndApply } from './ops';
import { friendlyError, paramInfo, Query } from '../../m/engine';
import { MTable, MRecord, MError, MFunction, MBinary, displayValue, MType } from '../../core/values';
import { joinSteps, mId } from '../../m/parser';

function QueriesPane() {
  const s = store; const p = pq();
  const [rename, setRename] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = new Map<string, Query[]>();
  for (const q of p.queries) { const g = q.group ?? ''; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(q); }
  const qMenu = (e: React.MouseEvent, q: Query) => menuAt(e, [
    { label: 'Copy', icon: 'copy', onClick: () => { void navigator.clipboard?.writeText(q.code).catch(() => {}); } },
    { label: 'Delete', icon: 'trash', onClick: () => s.openDialog({ type: 'pq:deleteQuery', name: q.name }) },
    { label: 'Rename', icon: 'edit', onClick: () => setRename(q.name) },
    { label: 'Enable load', checked: q.load, onClick: () => updateQuery(q.name, x => { x.load = !x.load; }) },
    { label: 'Include in report refresh', checked: q.refresh, onClick: () => updateQuery(q.name, x => { x.refresh = !x.refresh; }) },
    { sep: true },
    { label: 'Duplicate', onClick: () => addQuery({ name: q.name, code: q.code, group: q.group }) },
    { label: 'Reference', onClick: () => addQuery({ name: q.name, code: `let\n    Source = ${mId(q.name)}\nin\n    Source`, group: q.group }) },
    { sep: true },
    { label: 'Move To Group', items: [...[...groups.keys()].filter(g => g && g !== q.group).map(g => ({ label: g, onClick: () => updateQuery(q.name, x => { x.group = g; }) })), { label: 'New Group…', onClick: () => s.openDialog({ type: 'pq:newGroup', name: q.name }) }, ...(q.group ? [{ label: 'Other Queries', onClick: () => updateQuery(q.name, x => { x.group = undefined; }) }] : [])] },
    { label: 'Create Function…', onClick: () => s.openDialog({ type: 'pq:createFunction', name: q.name }) },
    { label: 'Advanced Editor', icon: 'advanced', onClick: () => { setPQ({ selected: q.name }); s.openDialog({ type: 'pq:advanced' }); } },
    { label: 'Properties…', onClick: () => { setPQ({ selected: q.name }); s.openDialog({ type: 'pq:props' }); } },
  ]);
  return <div className="pq-queries">
    <div className="hdr"><span>Queries [{p.queries.length}]</span><button className="iconbtn" title="New blank query" onClick={() => addQuery({ name: 'Query1', code: 'let\n    Source = ""\nin\n    Source' })}><I n="plus" s={13} /></button></div>
    <div className="pq-qlist">
      {[...groups.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : 0)).map(([g, qs]) => <div key={g}>
        {(g || groups.size > 1) && <div className="pq-group" onClick={() => setCollapsed({ ...collapsed, [g]: !collapsed[g] })}><I n={collapsed[g] ? 'chevronRight' : 'chevronDown'} s={10} /><I n="folderSm" s={13} />{g || 'Other Queries'} [{qs.length}]</div>}
        {!collapsed[g] && qs.map(q => {
          const pi = paramInfo(q.code);
          const r = stepResult(q.name, null);
          const kind = pi ? 'param' : r.e ? 'error' : r.v instanceof MFunction ? 'fn' : r.v instanceof MTable ? 'table' : 'value';
          return rename === q.name
            ? <input key={q.id} className="tx" autoFocus defaultValue={q.name} onBlur={e => { setRename(null); renameQuery(q.name, e.target.value.trim()); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRename(null); }} />
            : <div key={q.id} className={`pq-q ${p.selected === q.name ? 'active' : ''} ${q.load ? '' : 'noload'}`} style={{ paddingLeft: g ? 22 : 8 }} onClick={() => setPQ({ selected: q.name, step: null, selectedCols: [] })} onDoubleClick={() => setRename(q.name)} onContextMenu={e => qMenu(e, q)} title={q.load ? q.name : `${q.name} (load disabled)`}>
              <I n={kind === 'param' ? 'param' : kind === 'fn' ? 'advanced' : kind === 'error' ? 'warning' : kind === 'table' ? 'tableIcon' : 'blank'} s={15} />
              <span className="nm">{q.name}{pi ? ` (${displayValue(r.v)})` : ''}</span>
            </div>;
        })}
      </div>)}
    </div>
  </div>;
}

export function renameQuery(old: string, name: string) {
  const p = pq();
  if (!name || name === old) return;
  if (p.queries.some(q => q.name === name)) { store.toast(`A query named '${name}' already exists.`, 'error'); return; }
  const re = new RegExp(`(?<![\\w."])${mId(old).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w."])`, 'g');
  const queries = p.queries.map(q => ({ ...q, name: q.name === old ? name : q.name, code: q.code.replace(re, mId(name)) }));
  store.setUI({ pq: { ...p, queries, selected: p.selected === old ? name : p.selected, dirty: true } });
  invalidate();
}

function stepIcon(code: string) {
  if (/^(Csv|Excel|Json|Xml|Parquet|Sql|Folder|File|Table\.FromRows|#table|Web)/.test(code)) return 'database';
  if (/^Table\.SelectRows/.test(code)) return 'filter';
  if (/^Table\.TransformColumnTypes/.test(code)) return 'datatype';
  if (/^Table\.(Nested)?Join|Table\.Combine/.test(code)) return 'merge';
  if (/^Table\.Group/.test(code)) return 'groupby';
  if (/^Table\.Unpivot/.test(code)) return 'unpivot';
  if (/^Table\.AddColumn/.test(code)) return 'customcol';
  return 'blank';
}

function SettingsPane() {
  const s = store; const p = pq(); const q = currentQuery();
  const [rename, setRename] = useState<number | null>(null);
  if (!q) return <div className="pq-settings"><h3>Query Settings</h3></div>;
  const sp = stepsOf(q);
  const sel = selectedStepIndex();
  const folding = analyseFolding(q.code, foldingQueries(p.queries));
  const mode = s.project.model.tables.find(t => t.name === q.name)?.storageMode ?? q.storageMode ?? 'Import';
  const dqProblem = mode === 'DirectQuery' || mode === 'Dual' ? folding.find(f => f.status === 'notfolds') ?? (folding[0]?.status === 'na' ? folding[0] : null) : null;
  return <div className="pq-settings">
    <h3>Query Settings <button className="iconbtn" onClick={() => setPQ({ showSettings: false })} aria-label="Hide Query Settings"><I n="close" s={12} /></button></h3>
    <h4>Properties</h4>
    <div style={{ padding: '0 12px' }}>
      <div className="tiny">Name</div>
      <input className="tx" key={q.name} defaultValue={q.name} onBlur={e => renameQuery(q.name, e.target.value.trim())} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Query name" />
      <button className="btn sm" style={{ marginTop: 6, padding: 0, border: 0, color: '#0f6cbd', background: 'transparent' }} onClick={() => s.openDialog({ type: 'pq:props' })}>All Properties</button>
    </div>
    <h4>Applied Steps</h4>
    {mode !== 'Import' && <div className="tiny" style={{ padding: '0 12px 4px' }}>Storage mode: <b>{mode}</b></div>}
    {dqProblem && <div className="errbox" style={{ margin: '0 8px 6px', fontSize: 11.5 }}>{dqProblem.status === 'na' ? 'This source doesn\'t support DirectQuery.' : <>This step results in a query that is not supported in DirectQuery mode: <b>{dqProblem.name}</b>. {dqProblem.reason}</>}<div style={{ marginTop: 4 }}><button className="btn sm" onClick={() => switchToImport(q.name)}>Switch all tables to Import mode</button></div></div>}
    <div className="steps">
      {!sp && <div className="tiny" style={{ padding: 6 }}>This query is a single expression. Open the Advanced Editor to edit it.</div>}
      {sp?.steps.map((st, i) => rename === i
        ? <input key={i} className="tx" autoFocus defaultValue={st.name} onBlur={e => { setRename(null); renameStep(i, e.target.value.trim()); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        : <div key={i} className={`step ${i === sel ? 'active' : ''} ${i > sel ? 'after' : ''}`} onClick={() => setPQ({ step: i === sp.steps.length - 1 ? null : i })} onDoubleClick={() => setRename(i)}
          onContextMenu={e => menuAt(e, [
            { label: 'Edit Settings', onClick: () => { setPQ({ step: i }); s.toast('Edit the step in the formula bar above the grid, then press Enter.'); } },
            { label: 'Rename', onClick: () => setRename(i) },
            { label: 'Delete', onClick: () => deleteStep(i) },
            { label: 'Delete Until End', onClick: () => s.openDialog({ type: 'confirm', title: 'Delete Step', text: 'Are you sure you want to delete this step and all the steps after it?', ok: 'Delete', onOk: () => deleteStep(i, true) }) },
            { label: 'Insert Step After', onClick: () => { const steps = [...sp.steps]; const nm = `Custom${i + 1}`; steps.splice(i + 1, 0, { name: nm, code: mId(st.name) }); if (steps[i + 2]) steps[i + 2].code = steps[i + 2].code.split(mId(st.name)).join(mId(nm)); updateQuery(q.name, x => { x.code = joinSteps(steps, i + 1 === sp.steps.length ? undefined : sp.result); }, { step: i + 1 }); } },
            { label: 'Move Up', disabled: i < 2, onClick: () => moveStep(i, -1) },
            { label: 'Move Down', disabled: i === 0 || i >= sp.steps.length - 1, onClick: () => moveStep(i, 1) },
            { label: 'Extract Previous', disabled: i === 0, onClick: () => s.openDialog({ type: 'pq:extractPrevious', step: i }) },
            { sep: true },
            { label: 'View Native Query', disabled: folding[i]?.status !== 'folds' || !folding[i]?.sql, onClick: () => s.openDialog({ type: 'message', title: 'Native Query', text: folding[i].sql }) },
            { label: 'View query plan', disabled: !folding[i] || folding[i].status === 'na', onClick: () => s.openDialog({ type: 'message', title: 'Query plan', text: folding.slice(0, i + 1).map(f => `${f.status === 'folds' ? '⇢ Remote (folded)  ' : '⚙ Local (Power Query)'}  ${f.name}${f.reason && f.status !== 'folds' ? `\n        ${f.reason}` : ''}`).join('\n') }) },
          ])}>
          <I n={stepIcon(st.code)} s={14} />
          <span className="nm" title={st.name}>{st.name}</span>
          {folding[i] && folding[i].status !== 'na' && <span className={`fold ${folding[i].status}`} title={folding[i].status === 'folds' ? 'Folding: this step is sent to the data source' : `Not folding: ${folding[i].reason ?? ''}`} />}
          {stepResult(q.name, i).e && <span title={friendlyError(stepResult(q.name, i).e).message}><I n="warning" s={13} /></span>}
          <button className="iconbtn x" style={{ height: 18, minWidth: 18 }} title="Delete step" onClick={e => { e.stopPropagation(); deleteStep(i); }}><I n="close" s={11} /></button>
        </div>)}
    </div>
  </div>;
}

function FormulaBarPQ() {
  const p = pq(); const q = currentQuery();
  const sp = q ? stepsOf(q) : null;
  const idx = selectedStepIndex();
  const step = sp?.steps[idx];
  const [draft, setDraft] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const k = `${q?.name}|${idx}|${step?.code}`;
  if (k !== key) { setKey(k); setDraft(null); }
  if (!p.formulaBar || !q) return null;
  const val = draft ?? (step ? '= ' + step.code : '= ' + q.code);
  const commit = () => {
    if (draft === null) return;
    const code = draft.replace(/^\s*=\s*/, '');
    if (sp && step) { const steps = sp.steps.map((x, i) => (i === idx ? { ...x, code } : x)); updateQuery(q.name, x => { x.code = joinSteps(steps, sp.result === mId(sp.steps[sp.steps.length - 1].name) ? undefined : sp.result); }); }
    else updateQuery(q.name, x => { x.code = code; });
    setDraft(null);
  };
  return <div className="fbar">
    <div className="fbtns" style={{ borderLeft: 0, borderRight: '1px solid #e1dfdd' }}>
      <button className="iconbtn" title="Cancel" onClick={() => setDraft(null)} disabled={draft === null}><I n="cancel" s={16} /></button>
      <button className="iconbtn" title="Commit (Enter)" onClick={commit} disabled={draft === null}><I n="commit" s={16} /></button>
    </div>
    <div className="fx"><i>fx</i></div>
    <textarea value={val} rows={Math.min(6, Math.max(1, Math.ceil(val.length / 140), val.split('\n').length))} spellCheck={false} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); } }} onBlur={commit} aria-label="Formula bar" />
  </div>;
}

function Preview() {
  const s = store; const q = currentQuery();
  const [cell, setCell] = useState<{ row: number; col: number; v: any } | null>(null);
  const [ck, setCk] = useState('');
  const idx = selectedStepIndex();
  const kk = `${q?.name}|${idx}`;
  if (kk !== ck) { setCk(kk); setCell(null); }
  if (!q) return <div className="pq-value subtle">No query selected. Use <b>New Source</b> to connect to data.</div>;
  const r = stepResult(q.name, idx < 0 ? null : idx);
  if (r.e) {
    const fe = friendlyError(r.e);
    return <div className="pq-error">
      <h4><I n="warning" s={14} /> {fe.reason}: {fe.message}</h4>
      {fe.detail && <div className="det">Details:{'\n'}    {fe.detail}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        {/File|DataSource/.test(fe.reason) && <button className="btn sm" onClick={() => s.openDialog({ type: 'getData', pq: true })}>Upload file…</button>}
        <button className="btn sm" onClick={() => s.openDialog({ type: 'pq:advanced' })}>Go To Error (Advanced Editor)</button>
      </div>
    </div>;
  }
  const v = r.v;
  if (v instanceof MTable) {
    return <>
      <PQGrid t={v} onCell={setCell} />
      {cell && (cell.v instanceof MError || cell.v instanceof MTable || cell.v instanceof MRecord || Array.isArray(cell.v)) && <div style={{ height: 160, borderTop: '1px solid #e1dfdd', overflow: 'auto', padding: 10, background: '#fff', flexShrink: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><b>{v.columns[cell.col].name}, row {cell.row + 1}</b><button className="iconbtn" onClick={() => setCell(null)}><I n="close" s={12} /></button></div>
        {cell.v instanceof MError && <div className="errbox" style={{ marginTop: 6 }}>{cell.v.reason}: {cell.v.message}{cell.v.detail !== undefined && cell.v.detail !== null ? `\nDetails: ${String(cell.v.detail)}` : ''}</div>}
        {cell.v instanceof MRecord && <table className="grid-table" style={{ marginTop: 6 }}><tbody>{cell.v.names.map((n, i) => <tr key={n}><td><b>{n}</b></td><td>{displayValue((cell.v as MRecord).values[i])}</td></tr>)}</tbody></table>}
        {cell.v instanceof MTable && <table className="grid-table" style={{ marginTop: 6 }}><thead><tr>{cell.v.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr></thead><tbody>{cell.v.rows.slice(0, 20).map((rr, i) => <tr key={i}>{rr.map((x, j) => <td key={j}>{displayValue(x)}</td>)}</tr>)}</tbody></table>}
        {Array.isArray(cell.v) && <div style={{ marginTop: 6 }}>{cell.v.slice(0, 30).map((x, i) => <div key={i}>{displayValue(x)}</div>)}</div>}
      </div>}
    </>;
  }
  if (v instanceof MFunction) return <InvokeFunction q={q} f={v} />;
  if (Array.isArray(v)) return <div className="dgrid-wrap"><table className="dgrid"><thead><tr><th className="rn" /><th><div className="colh"><span className="nm">List</span></div></th></tr></thead><tbody>{v.slice(0, 2000).map((x, i) => <tr key={i}><td className="rn">{i + 1}</td><td>{displayValue(x)}</td></tr>)}</tbody></table>
    <div className="row" style={{ padding: 8 }}><button className="btn sm" onClick={() => import('./ops').then(o => o.addStep('Converted to Table', pr => `Table.FromList(${pr}, Splitter.SplitByNothing(), null, null, ExtraValues.Error)`))}>To Table</button></div></div>;
  if (v instanceof MRecord) return <div className="dgrid-wrap"><table className="dgrid"><tbody>{v.names.map((n, i) => <tr key={n}><td style={{ fontWeight: 600 }}>{n}</td><td>{displayValue(v.values[i])}</td></tr>)}</tbody></table>
    <div className="row" style={{ padding: 8 }}><button className="btn sm" onClick={() => import('./ops').then(o => o.addStep('Converted to Table', pr => `Record.ToTable(${pr})`))}>Into Table</button></div></div>;
  const pi = paramInfo(q.code);
  return <div className="pq-value">
    <div className="big">{v === null ? 'null' : v instanceof MBinary ? `Binary (${v.bytes.length.toLocaleString()} bytes)` : v instanceof MType ? `Type: ${v.name}` : displayValue(v)}</div>
    {pi && <ParamEditor q={q} type={pi.type} />}
    {v instanceof MBinary && <div className="tiny">A binary value. Use Csv.Document, Excel.Workbook, Json.Document or similar to read it.</div>}
  </div>;
}

function ParamEditor({ q, type }: { q: Query; type: string }) {
  const r = stepResult(q.name, null);
  const [val, setVal] = useState(String(r.v ?? ''));
  return <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
    <div className="tiny">Parameter of type {type}. Change the current value:</div>
    <input className="tx" value={val} onChange={e => setVal(e.target.value)} />
    <div><button className="btn sm primary" onClick={() => { const lit = /Number/i.test(type) && !isNaN(Number(val)) ? val : `"${val.replace(/"/g, '""')}"`; updateQuery(q.name, x => { x.code = x.code.replace(/^[\s\S]*?(\s+meta\s+\[)/, `${lit}$1`); }); }}>Apply</button></div>
  </div>;
}

function InvokeFunction({ q, f }: { q: Query; f: MFunction }) {
  const [vals, setVals] = useState<string[]>(f.paramNames.map(() => ''));
  return <div className="pq-value">
    <div className="big">Enter Parameters</div>
    <div className="tiny" style={{ marginBottom: 8 }}>{q.name} is a function. Invoke it to create a new query with its result.</div>
    {f.paramNames.map((n, i) => <div key={n} className="field" style={{ maxWidth: 360, marginBottom: 6 }}><label>{n}</label><input className="tx" value={vals[i]} onChange={e => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Example: 10 or &quot;text&quot; or another query name" /></div>)}
    <button className="btn primary" onClick={() => addQuery({ name: 'Invoked Function', code: `let\n    Source = ${mId(q.name)}(${vals.map(v => v.trim() || 'null').join(', ')})\nin\n    Source` })}>Invoke</button>
  </div>;
}

export function PowerQueryEditor() {
  const s = useStore();
  const p = s.ui.pq!;
  const q = currentQuery();
  const idx = selectedStepIndex();
  const r = q ? stepResult(q.name, idx < 0 ? null : idx) : null;
  const [mobile, setMobile] = useState<'q' | 's' | null>(null);
  return <div className="pq" role="dialog" aria-label="Power Query Editor">
    <div className="titlebar">
      <span className="logo"><I n="logo" s={18} /></span>
      <div className="name">{q ? `${q.name} - ` : ''}Power Query Editor</div>
      <button className="iconbtn" title="Close" onClick={() => (p.dirty ? s.openDialog({ type: 'pq:closeConfirm' }) : closeAndApply(false))}><I n="close" s={14} /></button>
    </div>
    <PQRibbon />
    <div>
      {p.dirty && <div className="pq-banner"><I n="warning" s={14} />There are pending changes in your queries that haven't been applied. <button className="btn sm yellow" onClick={() => closeAndApply(true)}>Close &amp; Apply</button></div>}
      <div style={{ display: 'flex', gap: 4, padding: 4 }} className="pq-mobile-tabs">
        <button className={`btn sm ${mobile === 'q' ? 'primary' : ''}`} onClick={() => setMobile(mobile === 'q' ? null : 'q')} style={{ display: window.innerWidth < 860 ? undefined : 'none' }}>Queries</button>
        <button className={`btn sm ${mobile === 's' ? 'primary' : ''}`} onClick={() => setMobile(mobile === 's' ? null : 's')} style={{ display: window.innerWidth < 860 ? undefined : 'none' }}>Applied steps</button>
      </div>
    </div>
    <div className={`pq-main ${mobile === 'q' ? 'show-q' : mobile === 's' ? 'show-s' : ''}`} style={{ gridTemplateColumns: p.showSettings ? undefined : '220px 1fr' }}>
      <QueriesPane />
      <div className="pq-center">
        <FormulaBarPQ />
        <Preview />
      </div>
      {p.showSettings && <SettingsPane />}
    </div>
    <div className="pq-status">
      {r?.v instanceof MTable ? <span>{r.v.columns.length} column{r.v.columns.length === 1 ? '' : 's'}, {r.v.rows.length.toLocaleString()} row{r.v.rows.length === 1 ? '' : 's'}</span> : <span>{r?.e ? 'Error' : 'Ready'}</span>}
      <span>Column profiling based on {p.profile.whole ? 'entire data set' : 'top 1000 rows'} <button className="iconbtn" style={{ height: 16, fontSize: 10 }} onClick={() => setPQ({ profile: { ...p.profile, whole: !p.profile.whole } })}>▾</button></span>
      <span style={{ flex: 1 }} />
      <span>Preview evaluated in {r ? r.ms.toFixed(0) : 0} ms</span>
      <span>Preview downloaded at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  </div>;
}
