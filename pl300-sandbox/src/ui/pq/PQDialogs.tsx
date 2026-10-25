// Dialogs of the Power Query Editor.
import React, { useMemo, useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { CodeEditor, Suggestion } from '../CodeEditor';
import { T, pq, setPQ, currentQuery, currentTable, stepResult, pqEngine, updateQuery, addQuery, asNewQuery, closeAndApply, stepsOf, selectedStepIndex, invalidate } from './ops';
import { MTable, MRecord, DataType, displayValue, typeName, MError } from '../../core/values';
import { LIB } from '../../m/lib';
import { Parser, mId, mStr, joinSteps } from '../../m/parser';
import { friendlyError, paramInfo } from '../../m/engine';
import { typeExpr } from '../../io/getdata';
import { renameQuery } from './PowerQuery';

const close = () => store.closeDialog();
const Footer = ({ ok, okLabel = 'OK', disabled }: { ok: () => void; okLabel?: string; disabled?: boolean }) => <><button className="btn primary" disabled={disabled} onClick={ok}>{okLabel}</button><button className="btn" onClick={close}>Cancel</button></>;

function ColSelect({ value, onChange, cols, allowEmpty }: { value: string; onChange: (v: string) => void; cols: string[]; allowEmpty?: boolean }) {
  return <select className="tx" value={value} onChange={e => onChange(e.target.value)}>{allowEmpty && <option value="">(none)</option>}{cols.map(c => <option key={c}>{c}</option>)}</select>;
}

// ---------- generic forms ----------
type FormField = { key: string; label: string; type?: 'text' | 'number' | 'select'; options?: [string, string][]; def?: any };
const FORMS: Record<string, { title: string; desc?: string; fields: FormField[]; run: (v: Record<string, any>, d: DialogT) => void }> = {
  keepTop: { title: 'Keep Top Rows', desc: 'Specify how many rows to keep.', fields: [{ key: 'n', label: 'Number of rows', type: 'number', def: 10 }], run: v => T.keepTop(+v.n) },
  keepBottom: { title: 'Keep Bottom Rows', desc: 'Specify how many rows to keep.', fields: [{ key: 'n', label: 'Number of rows', type: 'number', def: 10 }], run: v => T.keepBottom(+v.n) },
  keepRange: { title: 'Keep Range of Rows', desc: 'Specify the range of rows to keep.', fields: [{ key: 'first', label: 'First row', type: 'number', def: 1 }, { key: 'n', label: 'Number of rows', type: 'number', def: 10 }], run: v => T.keepRange(+v.first, +v.n) },
  removeTop: { title: 'Remove Top Rows', desc: 'Specify how many rows to remove from the top.', fields: [{ key: 'n', label: 'Number of rows', type: 'number', def: 1 }], run: v => T.removeTop(+v.n) },
  removeBottom: { title: 'Remove Bottom Rows', desc: 'Specify how many rows to remove from the bottom.', fields: [{ key: 'n', label: 'Number of rows', type: 'number', def: 1 }], run: v => T.removeBottom(+v.n) },
  removeAlternate: { title: 'Remove Alternate Rows', desc: 'Specify the pattern of rows to remove and keep.', fields: [{ key: 'first', label: 'First row to remove', type: 'number', def: 1 }, { key: 'remove', label: 'Number of rows to remove', type: 'number', def: 1 }, { key: 'keep', label: 'Number of rows to keep', type: 'number', def: 1 }], run: v => T.removeAlternate(+v.first, +v.remove, +v.keep) },
  replaceErrors: { title: 'Replace Errors', desc: 'Enter the value which will replace errors in the selected columns.', fields: [{ key: 'value', label: 'Value', def: '' }], run: v => T.replaceErrors(v.value) },
  splitChars: { title: 'Split Column by Number of Characters', desc: 'Specify the number of characters used to split the text column.', fields: [{ key: 'n', label: 'Number of characters', type: 'number', def: 2 }], run: v => T.splitPositions('chars', +v.n) },
  splitPositions: { title: 'Split Column by Positions', desc: 'Enter the positions to split the text column (comma-separated, zero-based).', fields: [{ key: 'p', label: 'Positions', def: '0, 2' }], run: v => T.splitPositions('positions', v.p) },
  index: { title: 'Add Index Column', desc: 'Specify the starting index and increment.', fields: [{ key: 'start', label: 'Starting index', type: 'number', def: 1 }, { key: 'step', label: 'Increment', type: 'number', def: 1 }], run: v => T.index(+v.start, +v.step) },
  round: { title: 'Round', desc: 'Specify the number of decimal places to round to.', fields: [{ key: 'd', label: 'Decimal places', type: 'number', def: 2 }], run: (v, d) => T.numberOp('round', String(+v.d), !!d.asNew) },
  number: { title: 'Standard', fields: [{ key: 'v', label: 'Value', type: 'number', def: 1 }], run: (v, d) => T.numberOp(d.op, String(+v.v), !!d.asNew) },
  prefix: { title: 'Prefix', desc: 'Specify a text value to add to the start of each value in the column.', fields: [{ key: 'v', label: 'Value', def: '' }], run: (v, d) => T.prefixSuffix('prefix', v.v, !!d.asNew) },
  suffix: { title: 'Suffix', desc: 'Specify a text value to add to the end of each value in the column.', fields: [{ key: 'v', label: 'Value', def: '' }], run: (v, d) => T.prefixSuffix('suffix', v.v, !!d.asNew) },
  extractFirst: { title: 'Extract First Characters', desc: 'Enter how many starting characters to keep.', fields: [{ key: 'n', label: 'Count', type: 'number', def: 3 }], run: (v, d) => T.extract('first', { n: +v.n }, !!d.asNew) },
  extractLast: { title: 'Extract Last Characters', desc: 'Enter how many ending characters to keep.', fields: [{ key: 'n', label: 'Count', type: 'number', def: 3 }], run: (v, d) => T.extract('last', { n: +v.n }, !!d.asNew) },
  extractRange: { title: 'Extract Text Range', desc: 'Enter the index of the first character, and the number of characters to keep.', fields: [{ key: 'start', label: 'Starting Index (zero-based)', type: 'number', def: 0 }, { key: 'n', label: 'Number of Characters', type: 'number', def: 3 }], run: (v, d) => T.extract('range', { start: +v.start, n: +v.n }, !!d.asNew) },
  extractBefore: { title: 'Text Before Delimiter', desc: 'Enter the delimiter that marks the end of the text to extract.', fields: [{ key: 'delim', label: 'Delimiter', def: '-' }], run: (v, d) => T.extract('before', { delim: v.delim }, !!d.asNew) },
  extractAfter: { title: 'Text After Delimiter', desc: 'Enter the delimiter that marks the start of the text to extract.', fields: [{ key: 'delim', label: 'Delimiter', def: '-' }], run: (v, d) => T.extract('after', { delim: v.delim }, !!d.asNew) },
  extractBetween: { title: 'Text Between Delimiters', desc: 'Enter the delimiters that mark the start and end of the text to extract.', fields: [{ key: 'start', label: 'Start delimiter', def: '(' }, { key: 'end', label: 'End delimiter', def: ')' }], run: (v, d) => T.extract('between', { start: v.start, end: v.end }, !!d.asNew) },
  mergeCols: { title: 'Merge Columns', desc: 'Choose how to merge the selected columns.', fields: [{ key: 'sep', label: 'Separator', type: 'select', options: [['', '--None--'], [',', 'Comma'], [':', 'Colon'], ['=', 'Equals Sign'], [';', 'Semicolon'], [' ', 'Space'], ['\t', 'Tab'], ['-', 'Hyphen']], def: ' ' }, { key: 'name', label: 'New column name (optional)', def: 'Merged' }], run: (v, d) => T.mergeColumns(v.sep, v.name || 'Merged', !!d.asNew) },
};

function FormDialog({ d }: { d: DialogT }) {
  const f = FORMS[d.form];
  const [vals, setVals] = useState<Record<string, any>>(() => Object.fromEntries(f.fields.map(x => [x.key, x.def ?? ''])));
  const ok = () => { close(); f.run(vals, d); };
  return <Dialog title={d.label ? `${f.title}: ${d.label}` : f.title} sub={f.desc} width={460} footer={<Footer ok={ok} />}>
    {f.fields.map(x => <div className="field" key={x.key}><label htmlFor={'f-' + x.key}>{x.label}</label>
      {x.type === 'select' ? <select id={'f-' + x.key} className="tx" value={vals[x.key]} onChange={e => setVals({ ...vals, [x.key]: e.target.value })}>{x.options!.map(([k, l]) => <option key={l} value={k}>{l}</option>)}</select>
        : <input id={'f-' + x.key} className="tx" type={x.type === 'number' ? 'number' : 'text'} value={vals[x.key]} autoFocus={x === f.fields[0]} onChange={e => setVals({ ...vals, [x.key]: e.target.value })} onKeyDown={e => e.key === 'Enter' && ok()} />}
    </div>)}
  </Dialog>;
}

function RenameDialog({ d }: { d: DialogT }) {
  const [v, setV] = useState(d.col);
  const ok = () => { close(); T.rename(d.col, v.trim()); };
  return <Dialog title="Rename column" width={420} footer={<Footer ok={ok} />}><input className="tx" autoFocus value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && ok()} aria-label="New name" onFocus={e => e.target.select()} /></Dialog>;
}

function ReplaceDialog({ d }: { d: DialogT }) {
  const [find, setFind] = useState(d.find ?? '');
  const [rep, setRep] = useState('');
  const [whole, setWhole] = useState(false);
  const [adv, setAdv] = useState(false);
  const ok = () => { close(); T.replaceValues(find, rep, whole); };
  return <Dialog title="Replace Values" sub="Replace one value with another in the selected columns." width={500} footer={<Footer ok={ok} />}>
    <div className="field"><label htmlFor="rv-f">Value To Find</label><input id="rv-f" className="tx" autoFocus value={find} onChange={e => setFind(e.target.value)} /></div>
    <div className="field"><label htmlFor="rv-r">Replace With</label><input id="rv-r" className="tx" value={rep} onChange={e => setRep(e.target.value)} onKeyDown={e => e.key === 'Enter' && ok()} /></div>
    <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAdv(!adv)}>{adv ? '▾' : '▸'} Advanced options</button>
    {adv && <label className="row"><input type="checkbox" checked={whole} onChange={e => setWhole(e.target.checked)} />Match entire cell contents</label>}
    <div className="tiny">Type <code>null</code> to find or replace null values. For text columns the default replaces matching text inside values (Replacer.ReplaceText); match entire cell uses Replacer.ReplaceValue.</div>
  </Dialog>;
}

function SplitDialog() {
  const [delim, setDelim] = useState(',');
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState<'each' | 'left' | 'right'>('each');
  const [rows, setRows] = useState(false);
  const [quote, setQuote] = useState(true);
  const t = currentTable(); const col = pq().selectedCols[0];
  const guess = useMemo(() => { if (!t || !col) return ','; const i = t.idx(col); const sample = t.rows.slice(0, 50).map(r => String(r[i] ?? '')).join(''); return [',', ';', '|', ' - ', '-', ' ', '\t', ':'].find(x => sample.includes(x)) ?? ','; }, [t, col]);
  React.useEffect(() => { if ([',', ';', ':', '=', ' ', '\t', '|', '-'].includes(guess)) setDelim(guess); else { setDelim('custom'); setCustom(guess); } }, [guess]);
  const d = delim === 'custom' ? custom : delim;
  const ok = () => { close(); T.splitDelimiter(d, mode, quote, rows); };
  return <Dialog title="Split Column by Delimiter" sub="Specify the delimiter used to split the text column." width={500} footer={<Footer ok={ok} disabled={!d} />}>
    <div className="field"><label>Select or enter delimiter</label><select className="tx" value={delim} onChange={e => setDelim(e.target.value)}>
      <option value=",">Comma</option><option value=":">Colon</option><option value="=">Equals Sign</option><option value=";">Semicolon</option><option value=" ">Space</option><option value={'\t'}>Tab</option><option value="|">Pipe</option><option value="-">Hyphen</option><option value="custom">--Custom--</option></select></div>
    {delim === 'custom' && <input className="tx" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Delimiter" aria-label="Custom delimiter" />}
    <div className="field"><label>Split at</label><div className="radio-row" style={{ flexDirection: 'column', gap: 4 }}>
      <label><input type="radio" checked={mode === 'left'} onChange={() => setMode('left')} />Left-most delimiter</label>
      <label><input type="radio" checked={mode === 'right'} onChange={() => setMode('right')} />Right-most delimiter</label>
      <label><input type="radio" checked={mode === 'each'} onChange={() => setMode('each')} />Each occurrence of the delimiter</label>
    </div></div>
    <div className="field"><label>Advanced options</label>
      <div className="radio-row"><label><input type="radio" checked={!rows} onChange={() => setRows(false)} />Split into Columns</label><label><input type="radio" checked={rows} onChange={() => setRows(true)} />Split into Rows</label></div>
      <label className="row"><input type="checkbox" checked={quote} onChange={e => setQuote(e.target.checked)} />Quote character " (ignore delimiters inside quotes)</label>
    </div>
  </Dialog>;
}

const AGG_OPS: [string, string][] = [['Sum', 'Sum'], ['Average', 'Average'], ['Median', 'Median'], ['Min', 'Min'], ['Max', 'Max'], ['Count', 'Count Rows'], ['CountDistinct', 'Count Distinct Rows'], ['All', 'All Rows']];
function GroupDialog() {
  const t = currentTable(); const cols = t?.names ?? [];
  const [adv, setAdv] = useState(false);
  const [keys, setKeys] = useState<string[]>([pq().selectedCols[0] ?? cols[0]]);
  const [aggs, setAggs] = useState([{ name: 'Count', op: 'Count', col: cols[0] }]);
  const ok = () => { close(); T.groupBy(keys.filter(Boolean), aggs); };
  return <Dialog title="Group By" sub="Specify the columns to group by and one or more outputs." width={640} footer={<Footer ok={ok} disabled={!keys.filter(Boolean).length} />}>
    <div className="radio-row"><label><input type="radio" checked={!adv} onChange={() => { setAdv(false); setKeys(keys.slice(0, 1)); setAggs(aggs.slice(0, 1)); }} />Basic</label><label><input type="radio" checked={adv} onChange={() => setAdv(true)} />Advanced</label></div>
    <div className="field"><label>Group by</label>
      {keys.map((k, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap' }}><ColSelect value={k} onChange={v => setKeys(keys.map((x, j) => (j === i ? v : x)))} cols={cols} />{adv && keys.length > 1 && <button className="btn sm" onClick={() => setKeys(keys.filter((_x, j) => j !== i))}>Remove</button>}</div>)}
      {adv && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setKeys([...keys, cols[0]])}>Add grouping</button>}
    </div>
    <div className="field"><label>New column name · Operation · Column</label>
      {aggs.map((a, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="tx" value={a.name} onChange={e => setAggs(aggs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="New column name" />
        <select className="tx" value={a.op} onChange={e => setAggs(aggs.map((x, j) => (j === i ? { ...x, op: e.target.value, name: x.name === 'Count' || AGG_OPS.some(o => o[1] === x.name) ? AGG_OPS.find(o => o[0] === e.target.value)![1] : x.name } : x)))}>{AGG_OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {!['Count', 'CountDistinct', 'All'].includes(a.op) ? <ColSelect value={a.col} onChange={v => setAggs(aggs.map((x, j) => (j === i ? { ...x, col: v } : x)))} cols={cols} /> : <span style={{ flex: 1 }} />}
        {adv && aggs.length > 1 && <button className="btn sm" onClick={() => setAggs(aggs.filter((_x, j) => j !== i))}>Remove</button>}
      </div>)}
      {adv && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAggs([...aggs, { name: 'Sum', op: 'Sum', col: cols[0] }])}>Add aggregation</button>}
    </div>
  </Dialog>;
}

const JOIN_KINDS: [string, string, string][] = [
  ['LeftOuter', 'Left Outer (all from first, matching from second)', 'Every row of the first table, plus matches from the second (nulls where there are none).'],
  ['RightOuter', 'Right Outer (all from second, matching from first)', 'Every row of the second table, plus matches from the first.'],
  ['FullOuter', 'Full Outer (all rows from both)', 'Every row of both tables, matched where possible.'],
  ['Inner', 'Inner (only matching rows)', 'Only rows that have a match in both tables.'],
  ['LeftAnti', 'Left Anti (rows only in first)', 'Rows of the first table with no match in the second. Useful to find orphans.'],
  ['RightAnti', 'Right Anti (rows only in second)', 'Rows of the second table with no match in the first.'],
];
function MiniTable({ t, sel, onToggle }: { t: MTable | null; sel: string[]; onToggle: (c: string, e: React.MouseEvent) => void }) {
  if (!t) return <div className="tiny">No preview.</div>;
  return <div style={{ overflow: 'auto', maxHeight: 170, border: '1px solid #e1dfdd' }}>
    <table className="dgrid"><thead><tr>{t.columns.map(c => <th key={c.name} className={sel.includes(c.name) ? 'selc' : ''} onClick={e => onToggle(c.name, e)} style={{ cursor: 'pointer' }}><div className="colh" style={{ minWidth: 80 }}><span className="nm">{c.name}</span>{sel.includes(c.name) && <span className="tiny">{sel.indexOf(c.name) + 1}</span>}</div></th>)}</tr></thead>
      <tbody>{t.rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={sel.includes(t.columns[j].name) ? 'selc' : ''}>{displayValue(v, t.columns[j].type)}</td>)}</tr>)}</tbody></table>
  </div>;
}
function MergeDialog({ d }: { d: DialogT }) {
  const p = pq(); const q = currentQuery()!;
  const t1 = currentTable();
  const others = p.queries.filter(x => x.name !== q.name || d.asNew);
  const [other, setOther] = useState(others.find(x => x.name !== q.name)?.name ?? '');
  const [k1, setK1] = useState<string[]>(p.selectedCols.length ? [p.selectedCols[0]] : []);
  const [k2, setK2] = useState<string[]>([]);
  const [kind, setKind] = useState('LeftOuter');
  const [fuzzy, setFuzzy] = useState(false);
  const t2 = useMemo(() => { if (!other) return null; const r = stepResult(other, null); return r.v instanceof MTable ? r.v : null; }, [other]);
  const toggle = (list: string[], set: (x: string[]) => void) => (c: string, e: React.MouseEvent) => set(e.ctrlKey || e.metaKey ? (list.includes(c) ? list.filter(x => x !== c) : [...list, c]) : [c]);
  const stats = useMemo(() => {
    if (!t1 || !t2 || !k1.length || k1.length !== k2.length) return null;
    const i1 = k1.map(c => t1.idx(c)), i2 = k2.map(c => t2.idx(c));
    if (i1.some(x => x < 0) || i2.some(x => x < 0)) return null;
    const norm = (v: any) => (fuzzy && typeof v === 'string' ? v.trim().toLowerCase() : v instanceof Date ? v.getTime() : v);
    const keys = new Set(t2.rows.map(r => JSON.stringify(i2.map(i => norm(r[i])))));
    const m = t1.rows.filter(r => keys.has(JSON.stringify(i1.map(i => norm(r[i]))))).length;
    const tyMismatch = k1.some((c, i) => { const a = t1.columns[t1.idx(c)].type, b = t2.columns[t2.idx(k2[i])].type; return a !== b && a !== 'any' && b !== 'any' && !(/int|decimal/.test(a) && /int|decimal/.test(b)); });
    return { m, n: t1.rows.length, tyMismatch };
  }, [t1, t2, k1, k2, fuzzy]);
  const ok = () => {
    close();
    if (d.asNew) asNewQuery(q.name, pr => `${fuzzy ? 'Table.FuzzyNestedJoin' : 'Table.NestedJoin'}(${pr}, {${k1.map(mStr).join(', ')}}, ${mId(other)}, {${k2.map(mStr).join(', ')}}, ${mStr(other)}, JoinKind.${kind})`, 'Merge1');
    else T.merge(other, k1, k2, kind, fuzzy);
  };
  return <Dialog title="Merge" sub="Select a table and matching columns to create a merged table." width={820} footer={<Footer ok={ok} disabled={!other || !k1.length || k1.length !== k2.length} />}>
    <div><b>{q.name}</b></div>
    <MiniTable t={t1} sel={k1} onToggle={toggle(k1, setK1)} />
    <select className="tx" value={other} onChange={e => { setOther(e.target.value); setK2([]); }}>{others.map(x => <option key={x.name}>{x.name}</option>)}</select>
    <MiniTable t={t2} sel={k2} onToggle={toggle(k2, setK2)} />
    <div className="row">
      <div className="field" style={{ flex: 2 }}><label>Join Kind</label><select className="tx" value={kind} onChange={e => setKind(e.target.value)}>{JOIN_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <label className="row" style={{ marginTop: 18 }}><input type="checkbox" checked={fuzzy} onChange={e => setFuzzy(e.target.checked)} />Use fuzzy matching to perform the merge</label>
    </div>
    <div className="tiny">{JOIN_KINDS.find(j => j[0] === kind)![2]} Ctrl+click headers to match on several columns (pick them in the same order in both tables).</div>
    {stats && <div className={stats.m ? 'info' : 'warnbox'}>The selection matches {stats.m.toLocaleString()} of {stats.n.toLocaleString()} rows from the first table.{stats.tyMismatch ? ' The key columns have different data types; matches may be missed.' : ''}</div>}
  </Dialog>;
}

function AppendDialog({ d }: { d: DialogT }) {
  const p = pq(); const q = currentQuery()!;
  const [multi, setMulti] = useState(false);
  const [second, setSecond] = useState(p.queries.find(x => x.name !== q.name)?.name ?? '');
  const [list, setList] = useState<string[]>([q.name]);
  const ok = () => {
    close();
    const others = multi ? list.filter(x => x !== q.name || d.asNew) : [second];
    if (d.asNew) { const all = multi ? list : [q.name, second]; addQuery({ name: 'Append1', code: `let\n    Source = Table.Combine({${all.map(mId).join(', ')}})\nin\n    Source` }); }
    else T.append(others);
  };
  return <Dialog title="Append" sub="Concatenate rows from two tables into a single table." width={560} footer={<Footer ok={ok} />}>
    <div className="radio-row"><label><input type="radio" checked={!multi} onChange={() => setMulti(false)} />Two tables</label><label><input type="radio" checked={multi} onChange={() => setMulti(true)} />Three or more tables</label></div>
    {!multi ? <>
      <div className="field"><label>Primary table</label><input className="tx" value={q.name} disabled /></div>
      <div className="field"><label>Table to append</label><select className="tx" value={second} onChange={e => setSecond(e.target.value)}>{p.queries.map(x => <option key={x.name}>{x.name}</option>)}</select></div>
    </> : <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="field"><label>Available tables</label><div className="list" style={{ height: 180 }}>{p.queries.map(x => <div key={x.name} className="it" onDoubleClick={() => setList([...list, x.name])}>{x.name}<button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setList([...list, x.name])}>Add »</button></div>)}</div></div>
      <div className="field"><label>Tables to append</label><div className="list" style={{ height: 180 }}>{list.map((x, i) => <div key={i} className="it">{x}<button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setList(list.filter((_y, j) => j !== i))}>Remove</button></div>)}</div></div>
    </div>}
    <div className="tiny">Columns are matched by name. A column missing from one table is filled with null for its rows.</div>
  </Dialog>;
}

function mSuggestions(cols: string[]): () => Suggestion[] {
  return () => [...Object.keys(LIB).filter(k => /^[A-Z#]/.test(k)).map(k => ({ text: k, insert: LIB[k] && LIB[k].impl ? k + '()' : k, kind: LIB[k] && LIB[k].impl ? 'function' : 'constant' })), ...cols.map(c => ({ text: `[${c}]`, kind: 'column' })), ...pq().queries.map(q => ({ text: mId(q.name), kind: 'query' })), ...['each', 'let', 'in', 'if', 'then', 'else', 'try', 'otherwise', 'null', 'true', 'false'].map(k => ({ text: k, kind: 'keyword' }))];
}

function CustomColumnDialog() {
  const t = currentTable(); const cols = t?.names ?? [];
  const [name, setName] = useState('Custom');
  const [f, setF] = useState('');
  const [type, setType] = useState<DataType>('any');
  const err = useMemo(() => { if (!f.trim()) return null; try { Parser.parse(`each ${f.replace(/^=\s*/, '')}`); return null; } catch (e) { return (e as Error).message; } }, [f]);
  const preview = useMemo(() => {
    if (!t || !f.trim() || err) return null;
    try {
      const eng = pqEngine(); const q = currentQuery()!;
      const idx = selectedStepIndex(); const sp = stepsOf(q)!;
      const v = eng.evaluateIn(q.name, `Table.FirstN(Table.AddColumn(${mId(sp.steps[idx].name)}, "__x", each ${f.replace(/^=\s*/, '')}), 3)[__x]`);
      return (v as any[]).map(x => (x instanceof MError ? 'Error: ' + x.message : displayValue(x))).join(' · ');
    } catch (e) { return 'Error: ' + friendlyError(e).message; }
  }, [f, err, t]);
  const ok = () => { close(); T.customColumn(name, f, type); };
  return <Dialog title="Custom Column" sub={<>Add a column that is computed from the other columns. <a href="https://learn.microsoft.com/powerquery-m/" target="_blank" rel="noreferrer">Learn about Power Query formulas</a></>} width={780} footer={<Footer ok={ok} disabled={!f.trim() || !!err} />}>
    <div className="row" style={{ alignItems: 'stretch' }}>
      <div className="field" style={{ flex: 3 }}>
        <label htmlFor="cc-name">New column name</label><input id="cc-name" className="tx" value={name} onChange={e => setName(e.target.value)} />
        <label>Custom column formula</label>
        <div style={{ border: '1px solid #c8c6c4', borderRadius: 3, height: 160, position: 'relative' }}><span style={{ position: 'absolute', left: 6, top: 8, zIndex: 1, font: '13px var(--mono)', color: '#605e5c' }}>=</span><div style={{ position: 'absolute', inset: '0 0 0 12px', display: 'flex' }}><CodeEditor value={f} onChange={setF} lang="m" gutter={false} suggestions={mSuggestions(cols)} autoFocus /></div></div>
        {err ? <div className="errbox">{err}</div> : f.trim() ? <div className="tiny" style={{ color: '#107c10' }}>✓ No syntax errors have been detected.</div> : null}
        {preview && <div className="tiny">Preview (first rows): {preview}</div>}
        <label>Data type (optional)</label>
        <select className="tx" value={type} onChange={e => setType(e.target.value as DataType)} style={{ maxWidth: 220 }}>{(['any', 'text', 'int', 'decimal', 'currency', 'percent', 'date', 'datetime', 'bool'] as DataType[]).map(x => <option key={x} value={x}>{typeName(x)}</option>)}</select>
      </div>
      <div className="field" style={{ flex: 1, minWidth: 170 }}><label>Available columns</label><div className="list" style={{ height: 250 }}>{cols.map(c => <div key={c} className="it" onDoubleClick={() => setF(f + `[${c}]`)}>{c}</div>)}</div><button className="btn sm" onClick={() => setF(f + `[${cols[0]}]`)}>&lt;&lt; Insert</button></div>
    </div>
  </Dialog>;
}

const COND_OPS: [string, string][] = [['equals', 'equals'], ['notEquals', 'does not equal'], ['gt', 'is greater than'], ['gte', 'is greater than or equal to'], ['lt', 'is less than'], ['lte', 'is less than or equal to'], ['begins', 'begins with'], ['notBegins', 'does not begin with'], ['ends', 'ends with'], ['notEnds', 'does not end with'], ['contains', 'contains'], ['notContains', 'does not contain']];
function ConditionalDialog() {
  const t = currentTable(); const cols = t?.names ?? [];
  const [name, setName] = useState('Custom');
  const [rules, setRules] = useState([{ col: cols[0], op: 'equals', value: '', output: '', valueIsCol: false, outIsCol: false }]);
  const [els, setEls] = useState('');
  const set = (i: number, patch: any) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const ok = () => { close(); T.conditional(name, rules, els, false); };
  return <Dialog title="Add Conditional Column" sub="Add a conditional column that is computed from the other columns or values." width={900} footer={<Footer ok={ok} />}>
    <div className="field" style={{ maxWidth: 300 }}><label htmlFor="cond-n">New column name</label><input id="cond-n" className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    {rules.map((r, i) => <div key={i} className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
      <b style={{ width: 52 }}>{i === 0 ? 'If' : 'Else If'}</b>
      <ColSelect value={r.col} onChange={v => set(i, { col: v })} cols={cols} />
      <select className="tx" value={r.op} onChange={e => set(i, { op: e.target.value })}>{COND_OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className="tx" style={{ width: 72 }} value={r.valueIsCol ? 'col' : 'val'} onChange={e => set(i, { valueIsCol: e.target.value === 'col', value: e.target.value === 'col' ? cols[0] : '' })}><option value="val">ABC 123</option><option value="col">Column</option></select>
      {r.valueIsCol ? <ColSelect value={r.value} onChange={v => set(i, { value: v })} cols={cols} /> : <input className="tx" placeholder="Value" value={r.value} onChange={e => set(i, { value: e.target.value })} />}
      <b>Then</b>
      <select className="tx" style={{ width: 72 }} value={r.outIsCol ? 'col' : 'val'} onChange={e => set(i, { outIsCol: e.target.value === 'col', output: e.target.value === 'col' ? cols[0] : '' })}><option value="val">ABC 123</option><option value="col">Column</option></select>
      {r.outIsCol ? <ColSelect value={r.output} onChange={v => set(i, { output: v })} cols={cols} /> : <input className="tx" placeholder="Output" value={r.output} onChange={e => set(i, { output: e.target.value })} />}
      {rules.length > 1 && <button className="iconbtn" onClick={() => setRules(rules.filter((_x, j) => j !== i))} aria-label="Remove clause">×</button>}
    </div>)}
    <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setRules([...rules, { col: cols[0], op: 'equals', value: '', output: '', valueIsCol: false, outIsCol: false }])}>Add Clause</button>
    <div className="row" style={{ maxWidth: 400 }}><b style={{ width: 52 }}>Else</b><input className="tx" value={els} onChange={e => setEls(e.target.value)} placeholder="Output (leave empty for null)" /></div>
  </Dialog>;
}

const TEXT_OPS: [string, string][] = [['equals', 'equals'], ['notEquals', 'does not equal'], ['begins', 'begins with'], ['notBegins', 'does not begin with'], ['ends', 'ends with'], ['notEnds', 'does not end with'], ['contains', 'contains'], ['notContains', 'does not contain'], ['isNull', 'is null'], ['notNull', 'is not null']];
const NUM_OPS: [string, string][] = [['equals', 'equals'], ['notEquals', 'does not equal'], ['gt', 'is greater than'], ['gte', 'is greater than or equal to'], ['lt', 'is less than'], ['lte', 'is less than or equal to'], ['isNull', 'is null'], ['notNull', 'is not null']];
function FilterDialog({ d }: { d: DialogT }) {
  const t = currentTable(); const cols = t?.names ?? [];
  const ops = d.kind === 'Text' ? TEXT_OPS : NUM_OPS.map(([k, l]) => [k, d.kind === 'Date' ? l.replace('greater than', 'after').replace('less than', 'before') : l] as [string, string]);
  const between = d.op === 'between';
  const [conds, setConds] = useState([{ op: between ? 'gte' : d.op || 'equals', value: '' }, { op: between ? 'lte' : '', value: '' }]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [col] = useState(d.col);
  const ok = () => { close(); T.filterRows(col, conds, logic); };
  const inputType = d.kind === 'Number' ? 'number' : d.kind === 'Date' ? 'date' : 'text';
  return <Dialog title="Filter Rows" sub={<>Apply one or more filter conditions to the rows in this table. Keep rows where '<b>{col}</b>'</>} width={560} footer={<Footer ok={ok} />}>
    {conds.map((c, i) => <React.Fragment key={i}>
      {i > 0 && <div className="radio-row"><label><input type="radio" checked={logic === 'and'} onChange={() => setLogic('and')} />And</label><label><input type="radio" checked={logic === 'or'} onChange={() => setLogic('or')} />Or</label></div>}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <select className="tx" value={c.op} onChange={e => setConds(conds.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}><option value="">{i ? '(none)' : 'Choose…'}</option>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {!['isNull', 'notNull'].includes(c.op) && <input className="tx" type={inputType} value={c.value} onChange={e => setConds(conds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Enter or select a value" autoFocus={i === 0} />}
      </div>
    </React.Fragment>)}
    <div className="tiny">Text comparisons are case-sensitive in Power Query (use Text.Lower in a custom filter for case-insensitive matching).</div>
    {void cols}
  </Dialog>;
}

function ExpandDialog({ d }: { d: DialogT }) {
  const t = currentTable()!;
  const i = t.idx(d.col);
  const fields = useMemo(() => {
    const out: string[] = [];
    for (const r of t.rows.slice(0, 200)) {
      const v = r[i];
      if (v instanceof MTable) for (const n of v.names) { if (!out.includes(n)) out.push(n); }
      if (v instanceof MRecord) for (const n of v.names) { if (!out.includes(n)) out.push(n); }
    }
    return out;
  }, [t, i]);
  const [sel, setSel] = useState<string[]>(fields);
  const [mode, setMode] = useState<'expand' | 'aggregate'>(d.aggregate ? 'aggregate' : 'expand');
  const [aggOp, setAggOp] = useState<Record<string, string>>({});
  const [prefix, setPrefix] = useState(true);
  const [q, setQ] = useState('');
  const ok = () => {
    close();
    if (mode === 'aggregate') T.aggregate(d.col, sel.map(c => ({ col: c, op: aggOp[c] ?? 'Sum' })));
    else T.expand(d.col, sel, prefix, d.kind);
  };
  return <Dialog title={d.col} width={380} footer={<Footer ok={ok} disabled={!sel.length} />}>
    {d.kind === 'table' && <div className="radio-row"><label><input type="radio" checked={mode === 'expand'} onChange={() => setMode('expand')} />Expand</label><label><input type="radio" checked={mode === 'aggregate'} onChange={() => setMode('aggregate')} />Aggregate</label></div>}
    <div className="pane-search" style={{ margin: 0 }}><input placeholder="Search Columns to Expand" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="list" style={{ maxHeight: 260 }}>
      <label className="it"><input type="checkbox" checked={sel.length === fields.length} onChange={e => setSel(e.target.checked ? fields : [])} />(Select All Columns)</label>
      {fields.filter(f => !q || f.toLowerCase().includes(q.toLowerCase())).map(f => <label key={f} className="it"><input type="checkbox" checked={sel.includes(f)} onChange={e => setSel(e.target.checked ? [...sel, f] : sel.filter(x => x !== f))} />{mode === 'aggregate' ? <><select className="tx" style={{ width: 110 }} value={aggOp[f] ?? 'Sum'} onChange={e => setAggOp({ ...aggOp, [f]: e.target.value })}>{['Sum', 'Average', 'Min', 'Max', 'Count', 'Median'].map(o => <option key={o}>{o}</option>)}</select> of {f}</> : f}</label>)}
    </div>
    {mode === 'expand' && <label className="row"><input type="checkbox" checked={prefix} onChange={e => setPrefix(e.target.checked)} />Use original column name as prefix</label>}
  </Dialog>;
}

function PivotDialog() {
  const t = currentTable()!; const col = pq().selectedCols[0];
  const others = t.names.filter(n => n !== col);
  const [val, setVal] = useState(others[others.length - 1]);
  const [agg, setAgg] = useState('Sum');
  const ok = () => { close(); T.pivot(val, agg); };
  return <Dialog title="Pivot Column" sub={<>Use the names in column "<b>{col}</b>" to create new columns.</>} width={460} footer={<Footer ok={ok} />}>
    <div className="field"><label>Values Column</label><ColSelect value={val} onChange={setVal} cols={others} /></div>
    <div className="field"><label>Aggregate Value Function (Advanced options)</label><select className="tx" value={agg} onChange={e => setAgg(e.target.value)}><option value="none">Don't Aggregate</option>{['Count', 'Min', 'Max', 'Median', 'Average', 'Sum'].map(x => <option key={x}>{x}</option>)}</select></div>
  </Dialog>;
}

function ChooseDialog({ d }: { d: DialogT }) {
  const t = currentTable()!;
  const [sel, setSel] = useState<string[]>(t.names);
  const [q, setQ] = useState('');
  const ok = () => { close(); if (d.goto) { setPQ({ selectedCols: sel.slice(0, 1) }); return; } T.chooseColumns(t.names.filter(n => sel.includes(n))); };
  return <Dialog title={d.goto ? 'Go to Column' : 'Choose Columns'} sub={d.goto ? 'Select a column.' : 'Choose the columns to keep.'} width={400} footer={<Footer ok={ok} disabled={!sel.length} />}>
    <div className="pane-search" style={{ margin: 0 }}><input placeholder="Search Columns" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
    <div className="list" style={{ maxHeight: 320 }}>
      {!d.goto && <label className="it"><input type="checkbox" checked={sel.length === t.names.length} onChange={e => setSel(e.target.checked ? t.names : [])} />(Select All Columns)</label>}
      {t.names.filter(n => !q || n.toLowerCase().includes(q.toLowerCase())).map(n => d.goto
        ? <div key={n} className={`it ${sel[0] === n ? 'on' : ''}`} onClick={() => setSel([n])} onDoubleClick={() => { setSel([n]); setPQ({ selectedCols: [n] }); close(); }}>{n}</div>
        : <label key={n} className="it"><input type="checkbox" checked={sel.includes(n)} onChange={e => setSel(e.target.checked ? [...sel, n] : sel.filter(x => x !== n))} />{n}</label>)}
    </div>
  </Dialog>;
}

function AdvancedEditor() {
  const q = currentQuery()!;
  const [code, setCode] = useState(q.code);
  const err = useMemo(() => { try { Parser.parse(code); return null; } catch (e) { const pos = (e as any).pos ?? 0; const line = code.slice(0, pos).split('\n').length; return `Token error at line ${line}: ${(e as Error).message}`; } }, [code]);
  const ok = () => { close(); updateQuery(q.name, x => { x.code = code; }, { step: null }); };
  return <Dialog title={q.name} sub={<span>Advanced Editor · <a href="https://learn.microsoft.com/powerquery-m/" target="_blank" rel="noreferrer">Power Query M reference</a></span>} width="min(1000px, 95vw)" footer={<><div className="left">{err ? <span style={{ color: '#a4262c' }}>⚠ {err}</span> : <span style={{ color: '#107c10' }}>✓ No syntax errors have been detected.</span>}</div><button className="btn primary" onClick={ok}>Done</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div style={{ height: '58vh', border: '1px solid #c8c6c4', position: 'relative', display: 'flex' }}><CodeEditor value={code} onChange={setCode} lang="m" suggestions={mSuggestions(currentTable()?.names ?? [])} autoFocus /></div>
  </Dialog>;
}

function ParamsDialog({ d }: { d: DialogT }) {
  const p = pq();
  const params = p.queries.filter(q => paramInfo(q.code));
  const [sel, setSel] = useState<string | null>(d.create ? null : params[0]?.name ?? null);
  const blank = { name: 'Parameter1', desc: '', required: true, type: 'Text', value: '' };
  const toForm = (name: string) => { const q = p.queries.find(x => x.name === name)!; const pi = paramInfo(q.code)!; const r = stepResult(name, null); return { name, desc: q.description ?? '', required: pi.required, type: pi.type, value: r.v === null || r.v === undefined ? '' : String(r.v) }; };
  const [form, setForm] = useState(() => (sel ? toForm(sel) : blank));
  const save = () => {
    const lit = /Number/.test(form.type) ? (form.value === '' ? '0' : form.value) : form.type === 'Date' ? `#date(${form.value.split('-').map(Number).join(', ')})` : form.type === 'True/False' ? (form.value.toLowerCase() === 'true' ? 'true' : 'false') : mStr(form.value);
    const mType = form.type === 'Decimal Number' ? 'Number' : form.type === 'True/False' ? 'Logical' : form.type;
    const code = `${lit} meta [IsParameterQuery=true, Type="${mType}", IsParameterQueryRequired=${form.required}]`;
    if (sel) { if (form.name !== sel) renameQuery(sel, form.name); updateQuery(form.name, x => { x.code = code; x.description = form.desc; x.load = false; }); }
    else addQuery({ name: form.name, code, load: false }, false);
    close();
  };
  return <Dialog title="Manage Parameters" width={720} footer={<Footer ok={save} />}>
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="field" style={{ maxWidth: 200 }}>
        <button className="btn sm" onClick={() => { setSel(null); setForm(blank); }}>New</button>
        <div className="list" style={{ height: 240, marginTop: 6 }}>{params.map(x => <div key={x.name} className={`it ${sel === x.name ? 'on' : ''}`} onClick={() => { setSel(x.name); setForm(toForm(x.name)); }}>{x.name}</div>)}{!sel && <div className="it on">{form.name}</div>}</div>
      </div>
      <div className="field" style={{ flex: 1 }}>
        <label>Name</label><input className="tx" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label>Description</label><input className="tx" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
        <label className="row"><input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} />Required</label>
        <label>Type</label><select className="tx" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{['Text', 'Number', 'Decimal Number', 'Date', 'True/False', 'Any'].map(x => <option key={x}>{x}</option>)}</select>
        <label>Current Value</label><input className="tx" type={form.type === 'Date' ? 'date' : /Number/.test(form.type) ? 'number' : 'text'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
        <div className="tiny">Reference a parameter by name in any step, e.g. <code>Table.SelectRows(Source, each [Region] = RegionParam)</code> or <code>File.Contents(FolderPath &amp; "Sales.csv")</code>.</div>
      </div>
    </div>
  </Dialog>;
}

function PropsDialog() {
  const q = currentQuery()!;
  const [name, setName] = useState(q.name);
  const [desc, setDesc] = useState(q.description ?? '');
  const [load, setLoad] = useState(q.load);
  const [refresh, setRefresh] = useState(q.refresh);
  const ok = () => { close(); updateQuery(q.name, x => { x.description = desc; x.load = load; x.refresh = refresh; }); if (name !== q.name) renameQuery(q.name, name); };
  return <Dialog title="Query Properties" width={480} footer={<Footer ok={ok} />}>
    <div className="field"><label>Name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label>Description</label><textarea className="tx" rows={3} value={desc} onChange={e => setDesc(e.target.value)} /></div>
    <label className="row"><input type="checkbox" checked={load} onChange={e => setLoad(e.target.checked)} />Enable load to report</label>
    <label className="row"><input type="checkbox" checked={refresh} onChange={e => setRefresh(e.target.checked)} />Include in report refresh</label>
    <div className="tiny">Disable load for staging queries (for example a query that's only merged into another). They stay in Power Query but don't become model tables.</div>
  </Dialog>;
}

function DepsDialog() {
  const p = pq();
  const deps = p.queries.map(q => ({ q, uses: p.queries.filter(o => o.name !== q.name && new RegExp(`(?<![\\w."])${mId(o.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w."])`).test(q.code)).map(o => o.name), src: [...q.code.matchAll(/(File\.Contents|Folder\.Files|Sql\.Database|Web\.Contents)\(\s*"([^"]+)"/g)].map(m => `${m[1].split('.')[0]}: ${m[2]}`) }));
  // layered layout
  const level = new Map<string, number>();
  const lv = (n: string, seen = new Set<string>()): number => { if (level.has(n)) return level.get(n)!; if (seen.has(n)) return 0; seen.add(n); const d = deps.find(x => x.q.name === n)!; const l = d.uses.length ? Math.max(...d.uses.map(u => lv(u, seen))) + 1 : 1; level.set(n, l); return l; };
  deps.forEach(d => lv(d.q.name));
  const sources = [...new Set(deps.flatMap(d => d.src))];
  const cols = new Map<number, string[]>();
  cols.set(0, sources);
  deps.forEach(d => { const l = level.get(d.q.name)!; if (!cols.has(l)) cols.set(l, []); cols.get(l)!.push(d.q.name); });
  const pos = new Map<string, { x: number; y: number }>();
  [...cols.entries()].forEach(([l, names]) => names.forEach((n, i) => pos.set(n, { x: 20 + l * 230, y: 20 + i * 70 })));
  const W = 40 + (Math.max(...cols.keys()) + 1) * 230, H = 40 + Math.max(...[...cols.values()].map(v => v.length)) * 70;
  return <Dialog title="Query Dependencies" width="min(1100px, 95vw)" footer={<button className="btn" onClick={close}>Close</button>}>
    <div style={{ overflow: 'auto', maxHeight: '65vh', background: '#faf9f8', border: '1px solid #e1dfdd' }}>
      <svg width={W} height={H}>
        {deps.flatMap(d => [...d.uses, ...d.src].map(u => { const a = pos.get(u)!, b = pos.get(d.q.name)!; return a && b ? <line key={u + d.q.name} x1={a.x + 190} y1={a.y + 22} x2={b.x} y2={b.y + 22} stroke="#8a8886" markerEnd="url(#dep)" /> : null; }))}
        <defs><marker id="dep" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8a8886" /></marker></defs>
        {[...pos.entries()].map(([n, p0]) => { const d = deps.find(x => x.q.name === n); return <g key={n} transform={`translate(${p0.x},${p0.y})`}><rect width={190} height={44} rx={4} fill={d ? '#fff' : '#fff8db'} stroke="#c8c6c4" /><text x={10} y={18} fontSize={12} fontWeight={600} fill="#252423">{n.length > 26 ? n.slice(0, 25) + '…' : n}</text><text x={10} y={34} fontSize={10} fill="#605e5c">{d ? (d.q.load ? 'Load enabled' : 'Connection only') : 'Data source'}</text></g>; })}
      </svg>
    </div>
  </Dialog>;
}

function DeleteQueryDialog({ d }: { d: DialogT }) {
  const p = pq();
  const users = p.queries.filter(q => q.name !== d.name && q.code.includes(mId(d.name)));
  const ok = () => { close(); const queries = p.queries.filter(q => q.name !== d.name); store.setUI({ pq: { ...p, queries, selected: p.selected === d.name ? queries[0]?.name ?? null : p.selected, dirty: true, step: null } }); invalidate(); };
  return <Dialog title="Delete Query" width={460} footer={<Footer ok={ok} okLabel="Delete" />}>
    <div>Are you sure you want to delete the query "{d.name}"?</div>
    {users.length > 0 && <div className="warnbox">These queries reference it and will return errors: {users.map(u => u.name).join(', ')}</div>}
  </Dialog>;
}

function CloseConfirm() {
  return <Dialog title="Power Query Editor" width={460} footer={<><button className="btn primary" onClick={() => { close(); closeAndApply(true); }}>Apply</button><button className="btn" onClick={() => { close(); closeAndApply(false); }}>Discard</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div>Apply query changes? Changes that haven't been applied to the model are lost if you discard them.</div>
  </Dialog>;
}

function NewGroupDialog({ d }: { d: DialogT }) {
  const [n, setN] = useState('New Group');
  const ok = () => { close(); updateQuery(d.name, x => { x.group = n; }); };
  return <Dialog title="New Group" width={400} footer={<Footer ok={ok} />}><input className="tx" autoFocus value={n} onChange={e => setN(e.target.value)} onKeyDown={e => e.key === 'Enter' && ok()} /></Dialog>;
}

function CreateFunctionDialog({ d }: { d: DialogT }) {
  const p = pq();
  const params = p.queries.filter(q => paramInfo(q.code) && new RegExp(`(?<![\\w."])${mId(q.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w."])`).test(p.queries.find(x => x.name === d.name)!.code));
  const [n, setN] = useState(`fn${d.name.replace(/\W/g, '')}`);
  const ok = () => {
    close();
    const src = p.queries.find(x => x.name === d.name)!;
    const body = src.code.replace(/\n/g, '\n    ');
    addQuery({ name: n, code: `(${params.map(x => `${mId(x.name)} as ${/Number/.test(paramInfo(x.code)!.type) ? 'number' : 'text'}`).join(', ')}) =>\n    ${body}`, load: false });
  };
  return <Dialog title="Create Function" sub={params.length ? `Parameters used: ${params.map(x => x.name).join(', ')}` : 'This query uses no parameters; the function will take none.'} width={460} footer={<Footer ok={ok} />}>
    <div className="field"><label>Function name</label><input className="tx" value={n} onChange={e => setN(e.target.value)} /></div>
  </Dialog>;
}

function InvokeDialog() {
  const p = pq(); const t = currentTable();
  const fns = p.queries.filter(q => stepResult(q.name, null).v?.impl);
  const [fn, setFn] = useState(fns[0]?.name ?? '');
  const [arg, setArg] = useState(t?.names[0] ?? '');
  const [name, setName] = useState(fn || 'Invoked');
  const ok = () => { close(); import('./ops').then(o => o.addStep('Invoked Custom Function', pr => `Table.AddColumn(${pr}, ${mStr(name || fn)}, each ${mId(fn)}([${arg}]))`)); };
  return <Dialog title="Invoke Custom Function" sub="Invoke a custom function defined in this file for each row." width={480} footer={<Footer ok={ok} disabled={!fn} />}>
    {!fns.length && <div className="warnbox">No function queries yet. Create one with a query like <code>(x as number) =&gt; x * 2</code>, or right-click a query › Create Function.</div>}
    <div className="field"><label>New column name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label>Function query</label><select className="tx" value={fn} onChange={e => setFn(e.target.value)}>{fns.map(f => <option key={f.name}>{f.name}</option>)}</select></div>
    <div className="field"><label>Argument column</label><ColSelect value={arg} onChange={setArg} cols={t?.names ?? []} /></div>
  </Dialog>;
}

function LocaleDialog({ d }: { d: DialogT }) {
  const [t, setT] = useState<DataType>('date');
  const [loc, setLoc] = useState('en-GB');
  const ok = () => { close(); import('./ops').then(o => o.addStep('Changed Type with Locale', pr => `Table.TransformColumnTypes(${pr}, {${d.cols.map((c: string) => `{${mStr(c)}, ${typeExpr(t)}}`).join(', ')}}, ${mStr(loc)})`)); };
  return <Dialog title="Change Type with Locale" sub="Change the data type and select the locale of origin." width={460} footer={<Footer ok={ok} />}>
    <div className="field"><label>Data Type</label><select className="tx" value={t} onChange={e => setT(e.target.value as DataType)}>{(['date', 'datetime', 'decimal', 'currency', 'int', 'text'] as DataType[]).map(x => <option key={x} value={x}>{typeName(x)}</option>)}</select></div>
    <div className="field"><label>Locale</label><select className="tx" value={loc} onChange={e => setLoc(e.target.value)}>{['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP'].map(x => <option key={x}>{x}</option>)}</select></div>
    <div className="tiny">The sandbox parses dates month-first and falls back to day-first when the first number is over 12.</div>
  </Dialog>;
}

function ExtractPreviousDialog({ d }: { d: DialogT }) {
  const q = currentQuery()!;
  const [n, setN] = useState(`${q.name} (2)`);
  const ok = () => {
    close();
    const sp = stepsOf(q)!;
    const before = sp.steps.slice(0, d.step), after = sp.steps.slice(d.step);
    const newName = addQuery({ name: n, code: joinSteps(before) }, false);
    const first = after[0]; const prevRef = mId(before[before.length - 1].name);
    const re = new RegExp(prevRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w."])', 'g');
    const steps = [{ name: 'Source', code: mId(newName) }, { ...first, code: first.code.replace(re, 'Source') }, ...after.slice(1)];
    updateQuery(q.name, x => { x.code = joinSteps(steps); }, { step: null });
  };
  return <Dialog title="Extract Steps" sub="Moves the steps before the selected one into a new query that this query references." width={460} footer={<Footer ok={ok} />}>
    <div className="field"><label>Extraction query name</label><input className="tx" value={n} onChange={e => setN(e.target.value)} /></div>
  </Dialog>;
}

export const PQ_DIALOGS: Record<string, (p: { d: DialogT }) => React.ReactElement> = {
  'pq:form': FormDialog, 'pq:rename': RenameDialog, 'pq:replace': ReplaceDialog, 'pq:split': SplitDialog, 'pq:group': GroupDialog, 'pq:merge': MergeDialog,
  'pq:append': AppendDialog, 'pq:custom': CustomColumnDialog, 'pq:conditional': ConditionalDialog, 'pq:filter': FilterDialog, 'pq:expand': ExpandDialog, 'pq:pivot': PivotDialog,
  'pq:choose': ChooseDialog, 'pq:advanced': AdvancedEditor, 'pq:params': ParamsDialog, 'pq:props': PropsDialog, 'pq:deps': DepsDialog, 'pq:deleteQuery': DeleteQueryDialog,
  'pq:closeConfirm': CloseConfirm, 'pq:newGroup': NewGroupDialog, 'pq:createFunction': CreateFunctionDialog, 'pq:invoke': InvokeDialog, 'pq:locale': LocaleDialog, 'pq:extractPrevious': ExtractPreviousDialog,
};
