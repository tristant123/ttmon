// Modeling dialogs: relationships, roles (RLS), View as, Mark as date table, quick measures, what-if, groups & bins.
import React, { useMemo, useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { Relationship, FieldRef } from '../../model/types';
import { relationshipValid } from '../views/ModelView';
import { autodetectRelationships } from '../../model/refresh';
import { clearQueryCache } from '../report/vhelpers';
import { DaxParser } from '../../dax/parser';
import { emptyCtx } from '../../dax/engine';
import { displayValue, keyOf, compareValues, isNumericType } from '../../core/values';
import { createWhatIf } from '../actions';
import { CodeEditor } from '../CodeEditor';
import { daxSuggestions } from '../FormulaBar';

const close = () => store.closeDialog();
const q = (t: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t) ? t : `'${t.replace(/'/g, "''")}'`);

export function RelationshipsDialog() {
  const s = store; const m = s.project.model;
  const [sel, setSel] = useState<string | null>(m.relationships[0]?.id ?? null);
  const label = (r: Relationship) => `${r.fromTable} (${r.fromColumn})`;
  return <Dialog title="Manage relationships" width="min(860px, 95vw)" footer={<button className="btn primary" onClick={close}>Close</button>}>
    <div className="row">
      <button className="btn sm" onClick={() => s.openDialog({ type: 'editRelationship' })}>+ New relationship</button>
      <button className="btn sm" onClick={() => { const rels = autodetectRelationships(m); if (!rels.length) s.toast('No new relationships were found.'); else { s.change(p => { p.model.relationships.push(...rels); }); clearQueryCache(); s.toast(`Found ${rels.length} new relationship${rels.length > 1 ? 's' : ''}.`); } }}>Autodetect</button>
      <button className="btn sm" disabled={!sel} onClick={() => s.openDialog({ type: 'editRelationship', id: sel })}>Edit</button>
      <button className="btn sm" disabled={!sel} onClick={() => { s.change(p => { p.model.relationships = p.model.relationships.filter(r => r.id !== sel); }); clearQueryCache(); setSel(null); }}>Delete</button>
    </div>
    <div style={{ border: '1px solid #e1dfdd', maxHeight: 360, overflow: 'auto' }}>
      <table className="grid-table vtable"><thead><tr><th>Active</th><th>From: Table (Column)</th><th>Cardinality</th><th>Cross-filter</th><th>To: Table (Column)</th><th /></tr></thead>
        <tbody>{m.relationships.map(r => { const err = relationshipValid(r); return <tr key={r.id} style={{ background: sel === r.id ? '#deecf9' : undefined, cursor: 'pointer' }} onClick={() => setSel(r.id)} onDoubleClick={() => s.openDialog({ type: 'editRelationship', id: r.id })}>
          <td><input type="checkbox" checked={r.active} onChange={() => { s.change(p => { p.model.relationships.find(x => x.id === r.id)!.active = !r.active; }); clearQueryCache(); }} aria-label="Active" /></td>
          <td>{label(r)}</td><td>{r.cardinality === 'many-one' ? 'Many to one (*:1)' : r.cardinality === 'one-one' ? 'One to one (1:1)' : 'Many to many (*:*)'}</td><td>{r.crossFilter === 'both' ? 'Both' : 'Single'}</td><td>{r.toTable} ({r.toColumn})</td><td>{err && <span title={err} style={{ color: '#a4262c' }}>⚠</span>}</td>
        </tr>; })}
          {!m.relationships.length && <tr><td colSpan={6} className="subtle" style={{ padding: 16 }}>There are no relationships. Select <b>Autodetect</b> or <b>New relationship</b>.</td></tr>}</tbody></table>
    </div>
    <div className="tiny">Exam tip: only one active path can exist between two tables. Use an inactive relationship with USERELATIONSHIP() in a measure (for example Ship Date vs Order Date — a "role-playing" Date dimension).</div>
  </Dialog>;
}

export function EditRelationshipDialog({ d }: { d: DialogT }) {
  const s = store; const m = s.project.model;
  const ex = d.id ? m.relationships.find(r => r.id === d.id) : undefined;
  const [r, setR] = useState<Relationship>(ex ? { ...ex } : { id: 'rel' + Math.random().toString(36).slice(2, 9), fromTable: m.tables[0]?.name ?? '', fromColumn: '', toTable: m.tables[1]?.name ?? '', toColumn: '', cardinality: 'many-one', crossFilter: 'single', active: true });
  const [secFilter, setSecFilter] = useState(false);
  const t1 = m.tables.find(t => t.name === r.fromTable), t2 = m.tables.find(t => t.name === r.toTable);
  const err = r.fromColumn && r.toColumn ? relationshipValid(r) : null;
  const clash = r.active && m.relationships.some(x => x.id !== r.id && x.active && [x.fromTable, x.toTable].sort().join() === [r.fromTable, r.toTable].sort().join());
  const match = useMemo(() => {
    if (!t1 || !t2 || !r.fromColumn || !r.toColumn) return null;
    const a = t1.columns.findIndex(c => c.name === r.fromColumn), b = t2.columns.findIndex(c => c.name === r.toColumn);
    const keys = new Set(t2.rows.map(x => keyOf(x[b])));
    return { n: t1.rows.filter(x => keys.has(keyOf(x[a]))).length, total: t1.rows.length };
  }, [t1, t2, r.fromColumn, r.toColumn]);
  const ok = () => {
    if (clash) { s.openDialog({ type: 'message', title: 'Ambiguous path', text: 'There is already an active relationship between these tables. Make this one inactive, or deactivate the other first.' }); return; }
    s.change(p => { if (ex) Object.assign(p.model.relationships.find(x => x.id === r.id)!, r); else p.model.relationships.push(r); });
    clearQueryCache(); close();
  };
  const preview = (t: typeof t1, col: string, set: (c: string) => void) => t && <div style={{ overflow: 'auto', maxHeight: 150, border: '1px solid #e1dfdd' }}>
    <table className="dgrid"><thead><tr>{t.columns.map(c => <th key={c.name} className={c.name === col ? 'selc' : ''} onClick={() => set(c.name)} style={{ cursor: 'pointer' }}><div className="colh" style={{ minWidth: 80 }}><span className="nm">{c.name}</span></div></th>)}</tr></thead>
      <tbody>{t.rows.slice(0, 4).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className={t.columns[j].name === col ? 'selc' : ''}>{displayValue(v)}</td>)}</tr>)}</tbody></table></div>;
  return <Dialog title={ex ? 'Edit relationship' : 'New relationship'} sub="Select tables and columns that are related." width="min(860px, 95vw)" footer={<><button className="btn primary" onClick={ok} disabled={!r.fromColumn || !r.toColumn}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>From table</label><select className="tx" value={r.fromTable} onChange={e => setR({ ...r, fromTable: e.target.value, fromColumn: '' })}>{m.tables.map(t => <option key={t.name}>{t.name}</option>)}</select></div>
    {preview(t1, r.fromColumn, c => setR({ ...r, fromColumn: c }))}
    <div className="field"><label>To table</label><select className="tx" value={r.toTable} onChange={e => setR({ ...r, toTable: e.target.value, toColumn: '' })}>{m.tables.map(t => <option key={t.name}>{t.name}</option>)}</select></div>
    {preview(t2, r.toColumn, c => setR({ ...r, toColumn: c }))}
    <div className="row">
      <div className="field"><label>Cardinality</label><select className="tx" value={r.cardinality} onChange={e => setR({ ...r, cardinality: e.target.value as any, crossFilter: e.target.value === 'one-one' ? 'both' : r.crossFilter })}><option value="many-one">Many to one (*:1)</option><option value="one-one">One to one (1:1)</option><option value="many-many">Many to many (*:*)</option></select></div>
      <div className="field"><label>Cross-filter direction</label><select className="tx" value={r.crossFilter} disabled={r.cardinality === 'one-one'} onChange={e => setR({ ...r, crossFilter: e.target.value as any })}><option value="single">Single ({r.toTable} filters {r.fromTable})</option><option value="both">Both</option></select></div>
    </div>
    <label className="row"><input type="checkbox" checked={r.active} onChange={e => setR({ ...r, active: e.target.checked })} />Make this relationship active</label>
    {r.crossFilter === 'both' && <label className="row"><input type="checkbox" checked={secFilter} onChange={e => setSecFilter(e.target.checked)} />Apply security filter in both directions</label>}
    {match && <div className={match.n === match.total ? 'info' : 'warnbox'}>{match.n.toLocaleString()} of {match.total.toLocaleString()} rows in {r.fromTable} have a matching key in {r.toTable}.{match.n < match.total ? ' Unmatched rows group under (Blank) in visuals.' : ''}</div>}
    {err && <div className="errbox">{err}</div>}
    {clash && <div className="warnbox">An active relationship already connects these tables. Clear "Make this relationship active" to keep this one inactive (use USERELATIONSHIP in measures).</div>}
    {r.crossFilter === 'both' && <div className="tiny">Bi-directional filtering can create ambiguity and slow models. Prefer single direction plus CROSSFILTER() in a measure when you only need it sometimes.</div>}
  </Dialog>;
}

export function RolesDialog() {
  const s = store; const m = s.project.model;
  const [roles, setRoles] = useState(JSON.parse(JSON.stringify(m.roles)) as typeof m.roles);
  const [sel, setSel] = useState(0);
  const [table, setTable] = useState(m.tables[0]?.name ?? '');
  const [result, setResult] = useState<string | null>(null);
  const role = roles[sel];
  const test = () => {
    if (!role) return;
    const expr = role.filters[table] ?? '';
    if (!expr.trim()) { setResult('No filter on this table: all rows are visible.'); return; }
    try {
      DaxParser.expr(expr);
      const tab = s.dax.table(table); const node = s.dax.parse(expr); const base = s.dax.baseTable(tab.name, emptyCtx());
      let n = 0; tab.rows.forEach((_r, i) => { if (s.dax.scalar(node, { ...emptyCtx(), rows: [{ vt: base, i }] }) === true) n++; });
      setResult(`✓ The expression is valid. ${n.toLocaleString()} of ${tab.rows.length.toLocaleString()} rows of ${table} pass this filter (with USERPRINCIPALNAME() = ${s.dax.userName}).`);
    } catch (e) { setResult('✗ ' + (e as Error).message); }
  };
  const save = () => { s.change(p => { p.model.roles = roles.filter(r => r.name.trim()); }); s.applyRls(); clearQueryCache(); close(); };
  return <Dialog title="Manage security roles" width="min(980px, 96vw)" footer={<><button className="btn primary" onClick={save}>Save</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap', minHeight: 300 }}>
      <div className="field" style={{ width: 200, flex: 'none' }}><label>Roles</label>
        <div className="list" style={{ flex: 1 }}>{roles.map((r, i) => <div key={i} className={`it ${i === sel ? 'on' : ''}`} onClick={() => setSel(i)}>{r.name}</div>)}</div>
        <div className="row"><button className="btn sm" onClick={() => { setRoles([...roles, { name: `Role ${roles.length + 1}`, filters: {} }]); setSel(roles.length); }}>New</button><button className="btn sm" disabled={!role} onClick={() => { setRoles(roles.filter((_x, i) => i !== sel)); setSel(0); }}>Delete</button></div>
      </div>
      <div className="field" style={{ width: 200, flex: 'none' }}><label>Select tables</label>
        <div className="list" style={{ flex: 1 }}>{m.tables.map(t => <div key={t.name} className={`it ${table === t.name ? 'on' : ''}`} onClick={() => { setTable(t.name); setResult(null); }}>{t.name}{role?.filters[t.name] ? ' ⦿' : ''}</div>)}</div>
      </div>
      <div className="field" style={{ flex: 1, minWidth: 0 }}>
        {role ? <>
          <label>Role name</label><input className="tx" value={role.name} onChange={e => setRoles(roles.map((r, i) => (i === sel ? { ...r, name: e.target.value } : r)))} />
          <label>Filter data: DAX expression for {table} (returns TRUE/FALSE per row)</label>
          <div style={{ height: 120, border: '1px solid #c8c6c4', display: 'flex', position: 'relative' }}><CodeEditor value={role.filters[table] ?? ''} onChange={v => setRoles(roles.map((r, i) => (i === sel ? { ...r, filters: { ...r.filters, [table]: v } } : r)))} lang="dax" suggestions={daxSuggestions} gutter={false} /></div>
          <div className="row"><button className="btn sm" onClick={test}>Validate</button>
            <button className="btn sm" onClick={() => { const t = m.tables.find(x => x.name === table)!; const c = t.columns.find(x => x.dataType === 'text') ?? t.columns[0]; setRoles(roles.map((r, i) => (i === sel ? { ...r, filters: { ...r.filters, [table]: `${q(table)}[${c.name}] = "${displayValue(t.rows[0]?.[t.columns.indexOf(c)] ?? '')}"` } } : r))); }}>Static example</button>
            <button className="btn sm" onClick={() => { const t = m.tables.find(x => x.name === table)!; const c = t.columns.find(x => /mail|upn|login/i.test(x.name)) ?? t.columns[0]; setRoles(roles.map((r, i) => (i === sel ? { ...r, filters: { ...r.filters, [table]: `${q(table)}[${c.name}] = USERPRINCIPALNAME()` } } : r))); }}>Dynamic example (USERPRINCIPALNAME)</button>
          </div>
          {result && <div className={result.startsWith('✓') || result.startsWith('No') ? 'info' : 'errbox'}>{result}</div>}
          <div className="tiny">Filters propagate along relationships like any other filter. Members are assigned to roles in the Power BI service (workspace › dataset › Security); test them here with <b>View as</b>.</div>
        </> : <div className="subtle">Create a role with <b>New</b>.</div>}
      </div>
    </div>
  </Dialog>;
}

export function ViewAsDialog() {
  const s = store; const m = s.project.model;
  const [roles, setRoles] = useState<string[]>(s.ui.viewAs?.roles ?? []);
  const [other, setOther] = useState(!!s.ui.viewAs?.user);
  const [user, setUser] = useState(s.ui.viewAs?.user ?? 'alex@contoso.com');
  const ok = () => { s.ui.viewAs = roles.length || other ? { roles, user: other ? user : undefined } : null; if (!other) s.dax.userName = 'student@contoso.com'; s.rebuildDax(); clearQueryCache(); s.emit(); close(); };
  return <Dialog title="View as roles" width={460} footer={<><button className="btn primary" onClick={ok}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    <label className="row"><input type="checkbox" checked={!roles.length && !other} onChange={() => { setRoles([]); setOther(false); }} />None</label>
    <label className="row"><input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} />Other user</label>
    {other && <input className="tx" value={user} onChange={e => setUser(e.target.value)} placeholder="user@contoso.com" aria-label="User principal name" />}
    {m.roles.map(r => <label key={r.name} className="row"><input type="checkbox" checked={roles.includes(r.name)} onChange={e => setRoles(e.target.checked ? [...roles, r.name] : roles.filter(x => x !== r.name))} />{r.name}</label>)}
    <div className="tiny">USERPRINCIPALNAME() returns the "Other user" value while viewing as roles, so you can test dynamic row-level security.</div>
  </Dialog>;
}

export function MarkDateDialog({ d }: { d: DialogT }) {
  const s = store; const t = s.project.model.tables.find(x => x.name === d.table)!;
  const dateCols = t.columns.filter(c => c.dataType === 'date' || c.dataType === 'datetime');
  const [col, setCol] = useState(t.dateColumn ?? dateCols[0]?.name ?? '');
  const check = useMemo(() => {
    if (!col) return 'Choose a column of type Date.';
    const i = t.columns.findIndex(c => c.name === col);
    const vals = t.rows.map(r => r[i]);
    if (vals.some(v => v === null)) return `The column '${col}' contains blank values.`;
    const ks = new Set(vals.map(v => (v as Date).getTime())); if (ks.size !== vals.length) return `The column '${col}' contains duplicate values.`;
    const sorted = [...vals].sort(compareValues) as Date[];
    for (let k = 1; k < sorted.length; k++) if (Math.round((sorted[k].getTime() - sorted[k - 1].getTime()) / 86400000) !== 1) return `The column '${col}' has gaps: dates must be contiguous (missing after ${sorted[k - 1].toLocaleDateString()}).`;
    return null;
  }, [col]);
  const ok = () => { s.change(p => { const tt = p.model.tables.find(x => x.name === t.name)!; tt.dateColumn = col || undefined; }); clearQueryCache(); close(); s.toast(col ? `${t.name} is now marked as a date table. Auto date/time hierarchies are no longer used for ${t.name}[${col}].` : 'Date table unmarked'); };
  return <Dialog title="Mark as date table" width={520} footer={<><button className="btn primary" disabled={!!check && !!col} onClick={ok}>OK</button>{t.dateColumn && <button className="btn" onClick={() => { s.change(p => { p.model.tables.find(x => x.name === t.name)!.dateColumn = undefined; }); close(); }}>Unmark</button>}<button className="btn" onClick={close}>Cancel</button></>}>
    <div>Select a column to be used for the date. The column must be of the data type 'date' and must contain only unique values.</div>
    <div className="field"><label>Date column</label><select className="tx" value={col} onChange={e => setCol(e.target.value)}><option value="">None</option>{dateCols.map(c => <option key={c.name}>{c.name}</option>)}</select></div>
    {col && (check ? <div className="errbox">{check}</div> : <div className="info">✓ Validated successfully</div>)}
    <div className="tiny">Exam tip: marking a date table makes time intelligence (TOTALYTD, SAMEPERIODLASTYEAR, DATEADD…) remove filters on the whole date table automatically, and turns off auto date/time for it.</div>
  </Dialog>;
}

const QM: { group: string; id: string; name: string; needs: ('base' | 'cat' | 'date' | 'filter' | 'base2' | 'n')[] }[] = [
  { group: 'Aggregate per category', id: 'avgCat', name: 'Average per category', needs: ['base', 'cat'] },
  { group: 'Aggregate per category', id: 'maxCat', name: 'Max per category', needs: ['base', 'cat'] },
  { group: 'Aggregate per category', id: 'minCat', name: 'Min per category', needs: ['base', 'cat'] },
  { group: 'Filters', id: 'filtered', name: 'Filtered value', needs: ['base', 'filter'] },
  { group: 'Filters', id: 'diffFiltered', name: 'Difference from filtered value', needs: ['base', 'filter'] },
  { group: 'Time intelligence', id: 'ytd', name: 'Year-to-date total', needs: ['base', 'date'] },
  { group: 'Time intelligence', id: 'qtd', name: 'Quarter-to-date total', needs: ['base', 'date'] },
  { group: 'Time intelligence', id: 'mtd', name: 'Month-to-date total', needs: ['base', 'date'] },
  { group: 'Time intelligence', id: 'yoy', name: 'Year-over-year change', needs: ['base', 'date'] },
  { group: 'Time intelligence', id: 'mom', name: 'Month-over-month change', needs: ['base', 'date'] },
  { group: 'Time intelligence', id: 'rolling', name: 'Rolling average', needs: ['base', 'date', 'n'] },
  { group: 'Totals', id: 'running', name: 'Running total', needs: ['base', 'cat'] },
  { group: 'Totals', id: 'totalCat', name: 'Total for category (filters applied)', needs: ['base', 'cat'] },
  { group: 'Totals', id: 'pctCat', name: 'Percentage of category total', needs: ['base', 'cat'] },
  { group: 'Mathematical operations', id: 'add', name: 'Addition', needs: ['base', 'base2'] },
  { group: 'Mathematical operations', id: 'sub', name: 'Subtraction', needs: ['base', 'base2'] },
  { group: 'Mathematical operations', id: 'mul', name: 'Multiplication', needs: ['base', 'base2'] },
  { group: 'Mathematical operations', id: 'div', name: 'Division', needs: ['base', 'base2'] },
  { group: 'Mathematical operations', id: 'pctDiff', name: 'Percentage difference', needs: ['base', 'base2'] },
  { group: 'Text', id: 'concat', name: 'Concatenated list of values', needs: ['cat'] },
  { group: 'Text', id: 'stars', name: 'Star rating', needs: ['base'] },
];

export function QuickMeasureDialog({ d }: { d: DialogT }) {
  const s = store; const m = s.project.model;
  const [calc, setCalc] = useState('ytd');
  const fields = useMemo(() => [
    ...m.measures.map(x => ({ label: `[${x.name}]`, dax: `[${x.name}]`, f: { table: x.table, measure: x.name } as FieldRef })),
    ...m.tables.flatMap(t => t.columns.filter(c => isNumericType(c.dataType)).map(c => ({ label: `Sum of ${t.name}[${c.name}]`, dax: `SUM(${q(t.name)}[${c.name}])`, f: { table: t.name, column: c.name, agg: 'Sum' } as FieldRef }))),
  ], [m]);
  const cols = m.tables.flatMap(t => t.columns.map(c => ({ label: `${t.name}[${c.name}]`, dax: `${q(t.name)}[${c.name}]`, t, c })));
  const dateCols = cols.filter(x => x.c.dataType === 'date' || x.c.dataType === 'datetime');
  const initBase = d.field ? fields.find(x => x.f.measure === d.field.measure && x.f.column === d.field.column)?.dax : fields[0]?.dax;
  const [base, setBase] = useState(initBase ?? '');
  const [base2, setBase2] = useState(fields[1]?.dax ?? fields[0]?.dax ?? '');
  const [cat, setCat] = useState(cols.find(x => x.c.dataType === 'text')?.dax ?? cols[0]?.dax ?? '');
  const [date, setDate] = useState((dateCols.find(x => x.t.dateColumn === x.c.name) ?? dateCols[0])?.dax ?? '');
  const [filterVal, setFilterVal] = useState('');
  const [n, setN] = useState(3);
  const def = QM.find(x => x.id === calc)!;
  const baseName = (b: string) => b.replace(/^\[|\]$/g, '').replace(/^SUM\((.*)\)$/, 'Sum of $1').replace(/'/g, '');
  const catCol = cols.find(x => x.dax === cat);
  const catVals = catCol ? [...new Set(catCol.t.rows.map(r => r[catCol.t.columns.indexOf(catCol.c)]))].sort(compareValues).slice(0, 200) : [];
  const fv = typeof catVals.find(v => String(v) === filterVal) === 'number' ? filterVal : `"${filterVal}"`;
  const gen = (): { name: string; expr: string } => {
    const bn = baseName(base);
    switch (calc) {
      case 'avgCat': return { name: `${bn} average per ${catCol?.c.name}`, expr: `AVERAGEX(\n    KEEPFILTERS(VALUES(${cat})),\n    CALCULATE(${base})\n)` };
      case 'maxCat': return { name: `${bn} max per ${catCol?.c.name}`, expr: `MAXX(\n    KEEPFILTERS(VALUES(${cat})),\n    CALCULATE(${base})\n)` };
      case 'minCat': return { name: `${bn} min per ${catCol?.c.name}`, expr: `MINX(\n    KEEPFILTERS(VALUES(${cat})),\n    CALCULATE(${base})\n)` };
      case 'filtered': return { name: `${bn} for ${filterVal}`, expr: `CALCULATE(\n    ${base},\n    ${cat} IN { ${fv} }\n)` };
      case 'diffFiltered': return { name: `${bn} difference from ${filterVal}`, expr: `VAR __BASELINE_VALUE = CALCULATE(${base}, ${cat} IN { ${fv} })\nVAR __VALUE_TO_COMPARE = ${base}\nRETURN\n    IF(NOT ISBLANK(__VALUE_TO_COMPARE), __VALUE_TO_COMPARE - __BASELINE_VALUE)` };
      case 'ytd': return { name: `${bn} YTD`, expr: `TOTALYTD(${base}, ${date})` };
      case 'qtd': return { name: `${bn} QTD`, expr: `TOTALQTD(${base}, ${date})` };
      case 'mtd': return { name: `${bn} MTD`, expr: `TOTALMTD(${base}, ${date})` };
      case 'yoy': return { name: `${bn} YoY%`, expr: `VAR __PREV_YEAR = CALCULATE(${base}, DATEADD(${date}, -1, YEAR))\nRETURN\n    DIVIDE(${base} - __PREV_YEAR, __PREV_YEAR)` };
      case 'mom': return { name: `${bn} MoM%`, expr: `VAR __PREV_MONTH = CALCULATE(${base}, DATEADD(${date}, -1, MONTH))\nRETURN\n    DIVIDE(${base} - __PREV_MONTH, __PREV_MONTH)` };
      case 'rolling': return { name: `${bn} rolling average`, expr: `AVERAGEX(\n    DATESINPERIOD(${date}, LASTDATE(${date}), -${n}, MONTH),\n    CALCULATE(${base})\n)` };
      case 'running': return { name: `${bn} running total in ${catCol?.c.name}`, expr: `CALCULATE(\n    ${base},\n    FILTER(\n        ALLSELECTED(${cat}),\n        ISONORAFTER(${cat}, MAX(${cat}), DESC)\n    )\n)`.replace(/ISONORAFTER\((.*), MAX\((.*)\), DESC\)/, '$1 <= MAX($2)') };
      case 'totalCat': return { name: `${bn} total for ${catCol?.c.name}`, expr: `CALCULATE(${base}, ALLSELECTED(${cat}))` };
      case 'pctCat': return { name: `${bn} % of ${catCol?.c.name} total`, expr: `DIVIDE(\n    ${base},\n    CALCULATE(${base}, ALLSELECTED(${cat}))\n)` };
      case 'add': return { name: `${bn} plus ${baseName(base2)}`, expr: `${base} + ${base2}` };
      case 'sub': return { name: `${bn} minus ${baseName(base2)}`, expr: `${base} - ${base2}` };
      case 'mul': return { name: `${bn} multiplied by ${baseName(base2)}`, expr: `${base} * ${base2}` };
      case 'div': return { name: `${bn} divided by ${baseName(base2)}`, expr: `DIVIDE(${base}, ${base2})` };
      case 'pctDiff': return { name: `${bn} % difference from ${baseName(base2)}`, expr: `VAR __BASELINE_VALUE = ${base2}\nVAR __VALUE_TO_COMPARE = ${base}\nRETURN\n    IF(NOT ISBLANK(__VALUE_TO_COMPARE), DIVIDE(__VALUE_TO_COMPARE - __BASELINE_VALUE, __BASELINE_VALUE))` };
      case 'concat': return { name: `List of ${catCol?.c.name} values`, expr: `VAR __DISTINCT_VALUES_COUNT = DISTINCTCOUNT(${cat})\nVAR __MAX_VALUES_TO_SHOW = 3\nRETURN\n    IF(\n        __DISTINCT_VALUES_COUNT > __MAX_VALUES_TO_SHOW,\n        CONCATENATE(CONCATENATEX(TOPN(__MAX_VALUES_TO_SHOW, VALUES(${cat}), ${cat}, ASC), ${cat}, ", ", ${cat}, ASC), ", etc."),\n        CONCATENATEX(VALUES(${cat}), ${cat}, ", ", ${cat}, ASC)\n    )` };
      case 'stars': return { name: `${bn} star rating`, expr: `VAR __MAX_NUMBER_OF_STARS = 5\nVAR __MIN_RATED_VALUE = 0\nVAR __MAX_RATED_VALUE = CALCULATE(${base}, ALLSELECTED())\nVAR __BASE_VALUE = ${base}\nVAR __STAR_RATING = ROUND(DIVIDE(__BASE_VALUE - __MIN_RATED_VALUE, __MAX_RATED_VALUE - __MIN_RATED_VALUE) * __MAX_NUMBER_OF_STARS, 0)\nRETURN\n    IF(NOT ISBLANK(__BASE_VALUE), REPT(UNICHAR(9733), __STAR_RATING) & REPT(UNICHAR(9734), __MAX_NUMBER_OF_STARS - __STAR_RATING))` };
    }
    return { name: 'Measure', expr: base };
  };
  const g = gen();
  const ok = () => {
    let name = g.name; let k = 2; while (m.measures.some(x => x.name.toLowerCase() === name.toLowerCase())) name = `${g.name} ${k++}`;
    const home = d.table ?? m.measures.find(x => `[${x.name}]` === base)?.table ?? m.tables[0]?.name;
    s.change(p => { p.model.measures.push({ name, table: home, expression: g.expr, formatString: /%|pct|YoY|MoM/i.test(calc + name) && !/stars/.test(calc) ? '0.00%' : undefined }); });
    clearQueryCache(); close(); s.setUI({ field: { table: home, measure: name } });
    s.toast(`Created quick measure [${name}]. Select it in the Data pane to read the DAX it generated.`);
  };
  const sel = (label: string, val: string, set: (v: string) => void, list: { label: string; dax: string }[]) => <div className="field"><label>{label}</label><select className="tx" value={val} onChange={e => set(e.target.value)}>{list.map(x => <option key={x.dax} value={x.dax}>{x.label}</option>)}</select></div>;
  return <Dialog title="Quick measures" width="min(900px, 95vw)" footer={<><button className="btn primary" onClick={ok} disabled={!m.tables.length}>Add</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
      <div className="field" style={{ width: 300, flex: 'none' }}><label>Calculation</label>
        <select className="tx" value={calc} onChange={e => setCalc(e.target.value)} size={14} style={{ height: 'auto' }}>
          {[...new Set(QM.map(x => x.group))].map(gr => <optgroup key={gr} label={gr}>{QM.filter(x => x.group === gr).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
        </select>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        {def.needs.includes('base') && sel('Base value', base, setBase, fields)}
        {def.needs.includes('base2') && sel('Second value', base2, setBase2, fields)}
        {def.needs.includes('cat') || def.needs.includes('filter') ? sel('Category / field', cat, setCat, cols) : null}
        {def.needs.includes('filter') && <div className="field"><label>Filter value</label><select className="tx" value={filterVal} onChange={e => setFilterVal(e.target.value)}><option value="">Choose…</option>{catVals.map(v => <option key={keyOf(v)} value={String(v)}>{displayValue(v)}</option>)}</select></div>}
        {def.needs.includes('date') && (dateCols.length ? sel('Date', date, setDate, dateCols) : <div className="warnbox">Add a date column (ideally a Date table marked as a date table).</div>)}
        {def.needs.includes('n') && <div className="field"><label>Periods before (months)</label><input className="tx" type="number" min={1} value={n} onChange={e => setN(+e.target.value)} /></div>}
        <div className="field"><label>DAX that will be created: [{g.name}]</label><pre className="code" style={{ background: '#f8f8f8', border: '1px solid #e1dfdd', padding: 8, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{g.expr}</pre></div>
      </div>
    </div>
  </Dialog>;
}

export function WhatIfDialog() {
  const [name, setName] = useState('Discount');
  const [min, setMin] = useState(0); const [max, setMax] = useState(0.5); const [step, setStep] = useState(0.05); const [dflt, setDflt] = useState(0.1);
  const [slicer, setSlicer] = useState(true);
  const ok = () => { close(); createWhatIf(name, min, max, step, dflt, slicer); store.toast(`Created table '${name}' (GENERATESERIES) and measure [${name} Value] (SELECTEDVALUE). Use [${name} Value] in your own measures.`); };
  return <Dialog title="Parameters" sub="Numeric range (what-if) parameter" width={480} footer={<><button className="btn primary" onClick={ok}>Create</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>Name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="row"><div className="field"><label>Minimum</label><input className="tx" type="number" value={min} onChange={e => setMin(+e.target.value)} /></div><div className="field"><label>Maximum</label><input className="tx" type="number" value={max} onChange={e => setMax(+e.target.value)} /></div></div>
    <div className="row"><div className="field"><label>Increment</label><input className="tx" type="number" value={step} onChange={e => setStep(+e.target.value)} /></div><div className="field"><label>Default</label><input className="tx" type="number" value={dflt} onChange={e => setDflt(+e.target.value)} /></div></div>
    <label className="row"><input type="checkbox" checked={slicer} onChange={e => setSlicer(e.target.checked)} />Add slicer to this page</label>
  </Dialog>;
}

export function GroupsDialog({ d }: { d: DialogT }) {
  const s = store; const t = s.project.model.tables.find(x => x.name === d.table)!; const c = t.columns.find(x => x.name === d.column)!;
  const numeric = isNumericType(c.dataType) || c.dataType === 'date';
  const [kind, setKind] = useState<'list' | 'bin'>(numeric ? 'bin' : 'list');
  const [name, setName] = useState(`${c.name} (${numeric ? 'bins' : 'groups'})`);
  const [size, setSize] = useState(10);
  const vals = useMemo(() => [...new Set(t.rows.map(r => r[t.columns.indexOf(c)]))].sort(compareValues), [t, c]);
  const [groups, setGroups] = useState<{ name: string; values: any[] }[]>([]);
  const [pick, setPick] = useState<any[]>([]);
  const [other, setOther] = useState(true);
  const grouped = new Set(groups.flatMap(g => g.values.map(keyOf)));
  const lit = (v: any) => (typeof v === 'number' ? String(v) : v === null ? 'BLANK()' : `"${String(v).replace(/"/g, '""')}"`);
  const ok = () => {
    const ref = `${q(t.name)}[${c.name}]`;
    const expr = kind === 'bin' ? (c.dataType === 'date' ? `DATE(YEAR(${ref}), MONTH(${ref}), 1)` : `FLOOR(${ref}, ${size})`) : `SWITCH(TRUE(),\n${groups.map(g => `    ${ref} IN {${g.values.map(lit).join(', ')}}, "${g.name}"`).join(',\n')}${other ? ',\n    "Other"' : `,\n    ${ref}`}\n)`;
    s.change(p => { const tt = p.model.tables.find(x => x.name === t.name)!; tt.columns.push({ name, dataType: 'any', expression: expr, summarizeBy: 'None', description: kind === 'bin' ? `Bins of size ${size}` : 'Data groups' }); tt.rows.forEach(r => r.push(null)); }, { recalc: true });
    clearQueryCache(); close(); s.toast(`Created '${name}'. In the sandbox, groups and bins are calculated columns (you can read their DAX).`);
  };
  return <Dialog title="Groups" width="min(760px, 95vw)" footer={<><button className="btn primary" onClick={ok} disabled={kind === 'list' && !groups.length}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row"><div className="field"><label>Name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div><div className="field"><label>Field</label><input className="tx" disabled value={`${t.name}[${c.name}]`} /></div>
      <div className="field"><label>Group type</label><select className="tx" value={kind} onChange={e => setKind(e.target.value as any)}><option value="list">List</option>{numeric && <option value="bin">Bin</option>}</select></div></div>
    {kind === 'bin' ? <div className="field" style={{ maxWidth: 240 }}><label>Bin size</label><input className="tx" type="number" min={1} value={size} onChange={e => setSize(+e.target.value)} disabled={c.dataType === 'date'} />{c.dataType === 'date' && <span className="tiny">Dates are binned by month.</span>}</div> :
      <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap' }}>
        <div className="field"><label>Ungrouped values</label><div className="list" style={{ height: 240 }}>{vals.filter(v => !grouped.has(keyOf(v))).map(v => <label key={keyOf(v)} className="it"><input type="checkbox" checked={pick.some(x => keyOf(x) === keyOf(v))} onChange={e => setPick(e.target.checked ? [...pick, v] : pick.filter(x => keyOf(x) !== keyOf(v)))} />{displayValue(v)}</label>)}</div>
          <button className="btn sm" disabled={!pick.length} onClick={() => { setGroups([...groups, { name: pick.map(x => displayValue(x)).join(' & ').slice(0, 40), values: pick }]); setPick([]); }}>Group</button></div>
        <div className="field"><label>Groups and members</label><div className="list" style={{ height: 240 }}>{groups.map((g, i) => <div key={i} className="it" style={{ flexDirection: 'column', alignItems: 'stretch' }}><input className="tx" value={g.name} onChange={e => setGroups(groups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /><span className="tiny">{g.values.map(x => displayValue(x)).join(', ')}</span></div>)}</div>
          <label className="row"><input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} />Include Other group</label></div>
      </div>}
  </Dialog>;
}
