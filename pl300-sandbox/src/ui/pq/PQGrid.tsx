// Power Query data preview: typed column headers, quality/distribution bars, sort & filter menus, cell details.
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { store } from '../../store';
import { MTable, MError, MRecord, MFunction, MBinary, MType, displayValue, keyOf, compareValues, DataType, typeName } from '../../core/values';
import { menuAt, MenuItem, pqTypeLabel } from '../common';
import { I } from '../icons';
import { T, pq, setPQ, currentQuery, selectedStepIndex, addStep } from './ops';
import { mStr } from '../../m/parser';

const TYPES: DataType[] = ['decimal', 'currency', 'int', 'percent', 'datetime', 'date', 'time', 'datetimezone', 'duration', 'text', 'bool', 'binary'];

export function typeMenu(cols: string[]): MenuItem[] {
  return [...TYPES.map(t => ({ label: typeName(t), onClick: () => T.changeType(t, cols) })), { sep: true }, { label: 'Using Locale…', onClick: () => store.openDialog({ type: 'pq:locale', cols }) }];
}

export function columnMenu(col: string, t: MTable): MenuItem[] {
  const s = store;
  const sel = pq().selectedCols.includes(col) ? pq().selectedCols : [col];
  const ty = t.columns.find(c => c.name === col)?.type ?? 'any';
  const textItems: MenuItem[] = [
    { label: 'lowercase', onClick: () => T.textTransform('Text.Lower', 'Lowercased Text') },
    { label: 'UPPERCASE', onClick: () => T.textTransform('Text.Upper', 'Uppercased Text') },
    { label: 'Capitalize Each Word', onClick: () => T.textTransform('Text.Proper', 'Capitalized Each Word') },
    { label: 'Trim', onClick: () => T.textTransform('Text.Trim', 'Trimmed Text') },
    { label: 'Clean', onClick: () => T.textTransform('Text.Clean', 'Cleaned Text') },
    { label: 'Length', onClick: () => T.extract('length', {}) },
    { sep: true },
    { label: 'JSON', onClick: () => T.parse('JSON') }, { label: 'XML', onClick: () => T.parse('XML') },
  ];
  const numItems: MenuItem[] = [
    { label: 'Round…', onClick: () => s.openDialog({ type: 'pq:form', form: 'round' }) }, { label: 'Round Up', onClick: () => T.numberOp('roundUp', null, false) }, { label: 'Round Down', onClick: () => T.numberOp('roundDown', null, false) },
    { label: 'Absolute Value', onClick: () => T.numberOp('abs', null, false) }, { label: 'Square Root', onClick: () => T.numberOp('sqrt', null, false) },
  ];
  const dateItems: MenuItem[] = [
    { label: 'Year', onClick: () => T.dateOp('year', false) }, { label: 'Month', onClick: () => T.dateOp('month', false) }, { label: 'Quarter', onClick: () => T.dateOp('quarter', false) },
    { label: 'Day', onClick: () => T.dateOp('day', false) }, { label: 'Name of Month', onClick: () => T.dateOp('monthName', false) }, { label: 'Name of Day', onClick: () => T.dateOp('dayName', false) },
    { label: 'Date Only', onClick: () => T.dateOp('dateOnly', false) },
  ];
  setPQ({ selectedCols: sel });
  return [
    { label: 'Copy', icon: 'copy', onClick: () => { const i = t.idx(col); void navigator.clipboard?.writeText([col, ...t.rows.map(r => displayValue(r[i]))].join('\n')).catch(() => {}); } },
    { label: sel.length > 1 ? 'Remove Columns' : 'Remove', icon: 'removeCols', onClick: () => T.removeColumns() },
    { label: 'Remove Other Columns', icon: 'chooseCols', onClick: () => T.removeOther() },
    { label: 'Duplicate Column', onClick: () => T.duplicate() },
    { label: 'Add Column From Examples…', disabled: true },
    { label: 'Remove Duplicates', onClick: () => T.removeDuplicates() },
    { label: 'Remove Errors', onClick: () => T.removeErrors() },
    { sep: true },
    { label: 'Change Type', icon: 'datatype', items: typeMenu(sel) },
    { label: 'Transform', items: ty === 'text' || ty === 'any' ? textItems : /int|decimal|currency|percent/.test(ty) ? numItems : /date/.test(ty) ? dateItems : textItems },
    { sep: true },
    { label: 'Replace Values…', icon: 'replace', onClick: () => s.openDialog({ type: 'pq:replace' }) },
    { label: 'Replace Errors…', onClick: () => s.openDialog({ type: 'pq:form', form: 'replaceErrors' }) },
    { sep: true },
    { label: 'Split Column', icon: 'split', items: [{ label: 'By Delimiter…', onClick: () => s.openDialog({ type: 'pq:split' }) }, { label: 'By Number of Characters…', onClick: () => s.openDialog({ type: 'pq:form', form: 'splitChars' }) }, { label: 'By Positions…', onClick: () => s.openDialog({ type: 'pq:form', form: 'splitPositions' }) }, { label: 'By Lowercase to Uppercase', onClick: () => T.splitPositions('transition', 'lowerUpper') }, { label: 'By Digit to Non-Digit', onClick: () => T.splitPositions('transition', 'digitNon') }] },
    { label: 'Group By…', icon: 'groupby', onClick: () => s.openDialog({ type: 'pq:group' }) },
    { label: 'Fill', icon: 'fill', items: [{ label: 'Down', onClick: () => T.fill('Down') }, { label: 'Up', onClick: () => T.fill('Up') }] },
    { label: 'Unpivot Columns', icon: 'unpivot', onClick: () => T.unpivot('selected') },
    { label: 'Unpivot Other Columns', onClick: () => T.unpivot('other') },
    { label: 'Unpivot Only Selected Columns', onClick: () => T.unpivot('only') },
    { sep: true },
    { label: 'Rename…', icon: 'edit', onClick: () => s.openDialog({ type: 'pq:rename', col }) },
    { label: 'Move', items: [{ label: 'Left', onClick: () => T.move('Left') }, { label: 'Right', onClick: () => T.move('Right') }, { label: 'To Beginning', onClick: () => T.move('Beginning') }, { label: 'To End', onClick: () => T.move('End') }] },
    { sep: true },
    { label: 'Drill Down', onClick: () => T.drillDown(col) },
    { label: 'Add as New Query', onClick: () => { const q = currentQuery()!; const idx = selectedStepIndex(); import('./ops').then(o => { const sp = o.stepsOf(q)!; o.addQuery({ name: col, code: `let\n    Source = ${q.name.match(/^[A-Za-z_]\w*$/) ? q.name : `#"${q.name}"`},\n    ${col.match(/^[A-Za-z_]\w*$/) ? col : `#"${col}"`} = Source[${col}]\nin\n    ${col.match(/^[A-Za-z_]\w*$/) ? col : `#"${col}"`}` }); void sp; void idx; }); } },
  ];
}

function FilterMenuDialog({ col, t, onClose, x, y }: { col: string; t: MTable; onClose: () => void; x: number; y: number }) {
  const i = t.idx(col);
  const ty = t.columns[i].type;
  const all = useMemo(() => { const m = new Map<string, any>(); for (const r of t.rows.slice(0, 5000)) { const v = r[i]; if (v instanceof MError) continue; const k = keyOf(v); if (!m.has(k)) m.set(k, v); } return [...m.values()].sort(compareValues).slice(0, 1000); }, [t, i]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(all.map(keyOf)));
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }; setTimeout(() => window.addEventListener('mousedown', f)); return () => window.removeEventListener('mousedown', f); }, [onClose]);
  const kind = /int|decimal|currency|percent/.test(ty) ? 'Number' : /date/.test(ty) ? 'Date' : 'Text';
  const filters: Record<string, [string, string][]> = {
    Text: [['equals', 'Equals…'], ['notEquals', 'Does Not Equal…'], ['begins', 'Begins With…'], ['notBegins', 'Does Not Begin With…'], ['ends', 'Ends With…'], ['contains', 'Contains…'], ['notContains', 'Does Not Contain…']],
    Number: [['equals', 'Equals…'], ['notEquals', 'Does Not Equal…'], ['gt', 'Greater Than…'], ['gte', 'Greater Than Or Equal To…'], ['lt', 'Less Than…'], ['lte', 'Less Than Or Equal To…'], ['between', 'Between…']],
    Date: [['equals', 'Equals…'], ['lt', 'Before…'], ['gt', 'After…'], ['between', 'Between…'], ['thisYear', 'Year › This Year'], ['lastNDays', 'In the Previous… days']],
  };
  const left = Math.min(x, window.innerWidth - 290), top = Math.min(y, window.innerHeight - 470);
  const ok = () => {
    const sel = all.filter(v => checked.has(keyOf(v)));
    if (sel.length === all.length) { onClose(); return; }
    const unsel = all.filter(v => !checked.has(keyOf(v)));
    if (sel.length <= unsel.length) T.filterValues(col, sel, null); else T.filterValues(col, null, unsel);
    onClose();
  };
  const shown = all.filter(v => !q || displayValue(v, ty).toLowerCase().includes(q.toLowerCase()));
  return <div ref={ref} className="menu" style={{ left, top, width: 280, padding: 6 }} onMouseDown={e => e.stopPropagation()}>
    <div className="mi" onClick={() => { setPQ({ selectedCols: [col] }); T.sort(false); onClose(); }}><span className="ic"><I n="sortAsc" s={16} /></span>Sort Ascending</div>
    <div className="mi" onClick={() => { setPQ({ selectedCols: [col] }); T.sort(true); onClose(); }}><span className="ic"><I n="sortDesc" s={16} /></span>Sort Descending</div>
    <div className="sep" />
    <div className="mi" onClick={() => { T.removeEmpty(col); onClose(); }}><span className="ic" />Remove Empty</div>
    <div className="mi" onClick={() => { store.openDialog({ type: 'pq:filter', col, kind, op: '' }); onClose(); }}><span className="ic"><I n="filter" s={14} /></span>{kind} Filters…</div>
    {filters[kind].map(([op, l]) => <div key={op} className="mi" style={{ paddingLeft: 34 }} onClick={() => { if (op === 'thisYear') T.filterRows(col, [{ op, value: '' }], 'and'); else store.openDialog({ type: 'pq:filter', col, kind, op }); onClose(); }}>{l}</div>)}
    <div className="sep" />
    <div className="pane-search" style={{ margin: '4px 6px' }}><I n="search" s={13} /><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
    <div style={{ maxHeight: 200, overflow: 'auto', padding: '0 6px' }}>
      <label className="slicer-item"><input type="checkbox" checked={checked.size === all.length} onChange={e => setChecked(e.target.checked ? new Set(all.map(keyOf)) : new Set())} />(Select All)</label>
      {shown.map(v => <label key={keyOf(v)} className="slicer-item"><input type="checkbox" checked={checked.has(keyOf(v))} onChange={e => { const n = new Set(checked); if (e.target.checked) n.add(keyOf(v)); else n.delete(keyOf(v)); setChecked(n); }} />{v === null ? '(null)' : v === '' ? '(blank)' : displayValue(v, ty)}</label>)}
    </div>
    {t.rows.length > 5000 && <div className="tiny" style={{ padding: '2px 8px' }}>List may be incomplete.</div>}
    <div className="row" style={{ justifyContent: 'flex-end', padding: 6 }}><button className="btn sm primary" onClick={ok}>OK</button><button className="btn sm" onClick={onClose}>Cancel</button></div>
  </div>;
}

function profileOf(t: MTable, i: number, top: number) {
  const rows = t.rows.slice(0, top);
  let valid = 0, err = 0, empty = 0;
  const counts = new Map<string, { v: any; n: number }>();
  for (const r of rows) {
    const v = r[i];
    if (v instanceof MError) { err++; continue; }
    if (v === null || v === '') empty++; else valid++;
    const k = keyOf(v); const e = counts.get(k) ?? { v, n: 0 }; e.n++; counts.set(k, e);
  }
  const distinct = counts.size; let unique = 0; for (const c of counts.values()) if (c.n === 1) unique++;
  const top10 = [...counts.values()].sort((a, b) => b.n - a.n);
  return { total: rows.length, valid, err, empty, distinct, unique, top10 };
}

export function PQGrid({ t, onCell }: { t: MTable; onCell: (info: { row: number; col: number; v: any }) => void }) {
  const s = store; const p = pq();
  const [filterMenu, setFilterMenu] = useState<{ col: string; x: number; y: number } | null>(null);
  const [scroll, setScroll] = useState(0);
  const [h, setH] = useState(500);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = ref.current!; const ro = new ResizeObserver(() => setH(el.clientHeight)); ro.observe(el); return () => ro.disconnect(); }, []);
  const top = p.profile.whole ? t.rows.length : 1000;
  const profiles = useMemo(() => (p.profile.quality || p.profile.distribution || p.profile.profile ? t.columns.map((_c, i) => profileOf(t, i, top)) : null), [t, p.profile.quality, p.profile.distribution, p.profile.profile, top]);
  const RH = 24;
  const start = Math.max(0, Math.floor(scroll / RH) - 10), end = Math.min(t.rows.length, start + Math.ceil(h / RH) + 30);
  const select = (col: string, e: React.MouseEvent) => {
    const cur = p.selectedCols;
    if (e.ctrlKey || e.metaKey) setPQ({ selectedCols: cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col] });
    else if (e.shiftKey && cur.length) { const a = t.idx(cur[cur.length - 1]), b = t.idx(col); const [lo, hi] = a < b ? [a, b] : [b, a]; setPQ({ selectedCols: t.names.slice(lo, hi + 1) }); }
    else setPQ({ selectedCols: [col] });
  };
  const isStruct = (v: any) => v instanceof MTable || v instanceof MRecord || Array.isArray(v) || v instanceof MFunction || v instanceof MBinary || v instanceof MType;
  const structKind = (i: number): 'table' | 'record' | 'list' | null => {
    const ty = t.columns[i].type;
    if (ty === 'table') return 'table'; if (ty === 'record') return 'record'; if (ty === 'list') return 'list';
    for (const r of t.rows.slice(0, 50)) { const v = r[i]; if (v instanceof MTable) return 'table'; if (v instanceof MRecord) return 'record'; if (Array.isArray(v)) return 'list'; if (v !== null) return null; }
    return null;
  };
  const selProfile = p.profile.profile && p.selectedCols.length === 1 && profiles ? { col: p.selectedCols[0], pr: profiles[t.idx(p.selectedCols[0])] } : null;
  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <div className="dgrid-wrap" ref={ref} onScroll={e => setScroll((e.target as HTMLElement).scrollTop)} style={{ fontFamily: (s.ui.pq as any).mono ? 'var(--mono)' : undefined }}>
      <table className="dgrid">
        <thead><tr>
          <th className="rn" onContextMenu={e => menuAt(e, [{ label: 'Use First Row as Headers', onClick: () => T.promote() }, { label: 'Use Headers as First Row', onClick: () => T.demote() }, { sep: true }, { label: 'Keep Top Rows…', onClick: () => s.openDialog({ type: 'pq:form', form: 'keepTop' }) }, { label: 'Remove Top Rows…', onClick: () => s.openDialog({ type: 'pq:form', form: 'removeTop' }) }, { label: 'Remove Duplicates', onClick: () => { setPQ({ selectedCols: [] }); T.removeDuplicates(); } }, { label: 'Remove Errors', onClick: () => { setPQ({ selectedCols: [] }); T.removeErrors(); } }, { sep: true }, { label: 'Add Custom Column…', onClick: () => s.openDialog({ type: 'pq:custom' }) }, { label: 'Add Index Column', onClick: () => T.index(1, 1) }])}>
            <div style={{ padding: '4px 4px' }} title="Table options"><I n="tableIcon" s={14} /></div>
          </th>
          {t.columns.map((c, i) => {
            const sel = p.selectedCols.includes(c.name);
            const pr = profiles?.[i];
            const sk = structKind(i);
            return <th key={c.name} className={sel ? 'selc' : ''} onContextMenu={e => menuAt(e, columnMenu(c.name, t))}>
              <div className="colh" onClick={e => select(c.name, e)} onDoubleClick={() => s.openDialog({ type: 'pq:rename', col: c.name })}>
                <span className="ty" title={`${typeName(c.type)} — click to change`} onClick={e => { e.stopPropagation(); if (!p.selectedCols.includes(c.name)) setPQ({ selectedCols: [c.name] }); menuAt(e, typeMenu(p.selectedCols.includes(c.name) ? p.selectedCols : [c.name])); }}>{pqTypeLabel(c.type)}</span>
                <span className="nm" title={c.name}>{c.name}</span>
                {sk ? <span className="dd" title={sk === 'list' ? 'Expand to New Rows' : 'Expand'} onClick={e => { e.stopPropagation(); if (sk === 'list') T.expand(c.name, [], false, 'list'); else s.openDialog({ type: 'pq:expand', col: c.name, kind: sk }); }}><I n="expandAll" s={14} /></span>
                  : <span className="dd" onClick={e => { e.stopPropagation(); setFilterMenu({ col: c.name, x: e.clientX, y: e.clientY + 8 }); }}><I n="chevronDown" s={12} /></span>}
              </div>
              {p.profile.quality && pr && <>
                <div className="qbar"><span style={{ width: `${(pr.valid / Math.max(1, pr.total)) * 100}%`, background: '#1aab40' }} /><span style={{ width: `${(pr.err / Math.max(1, pr.total)) * 100}%`, background: '#a4262c' }} /><span style={{ width: `${(pr.empty / Math.max(1, pr.total)) * 100}%`, background: '#c8c6c4' }} /></div>
                <div className="qstats">
                  <div><i style={{ background: '#1aab40' }} />Valid {Math.round((pr.valid / Math.max(1, pr.total)) * 100)}%</div>
                  <div style={{ color: pr.err ? '#a4262c' : undefined }}><i style={{ background: '#a4262c' }} />Error {pr.err ? Math.max(1, Math.round((pr.err / pr.total) * 100)) : 0}%</div>
                  <div><i style={{ background: '#c8c6c4' }} />Empty {pr.empty ? Math.max(1, Math.round((pr.empty / pr.total) * 100)) : 0}%</div>
                </div>
              </>}
              {p.profile.distribution && pr && <>
                <div className="dist">{pr.top10.slice(0, 20).map((x, k) => <span key={k} style={{ height: `${(x.n / pr.top10[0].n) * 100}%` }} title={`${displayValue(x.v)}: ${x.n}`} />)}</div>
                <div className="qstats">{pr.distinct} distinct, {pr.unique} unique</div>
              </>}
            </th>;
          })}
        </tr></thead>
        <tbody>
          {start > 0 && <tr style={{ height: start * RH }}><td colSpan={t.columns.length + 1} style={{ padding: 0, border: 0 }} /></tr>}
          {t.rows.slice(start, end).map((r, k) => {
            const ri = start + k;
            return <tr key={ri} style={{ height: RH }}>
              <td className="rn">{ri + 1}</td>
              {r.map((v, ci) => {
                const ty = t.columns[ci].type;
                const cls = v instanceof MError ? 'err' : v === null ? 'null' : isStruct(v) ? 'struct' : typeof v === 'number' ? 'num' : '';
                const txt = v === null ? 'null' : displayValue(v, ty);
                return <td key={ci} className={`${cls} ${p.selectedCols.includes(t.columns[ci].name) ? 'selc' : ''}`} onClick={() => onCell({ row: ri, col: ci, v })}
                  onContextMenu={e => menuAt(e, [
                    { label: 'Copy', icon: 'copy', onClick: () => { void navigator.clipboard?.writeText(txt).catch(() => {}); } },
                    { label: `${/int|decimal|currency|percent/.test(ty) ? 'Number' : /date/.test(ty) ? 'Date' : 'Text'} Filters`, items: [
                      { label: 'Equals', onClick: () => T.filterValues(t.columns[ci].name, [v], null) },
                      { label: 'Does Not Equal', onClick: () => T.filterValues(t.columns[ci].name, null, [v]) },
                    ] },
                    { label: 'Replace Values…', onClick: () => { setPQ({ selectedCols: [t.columns[ci].name] }); s.openDialog({ type: 'pq:replace', find: txt === 'null' ? 'null' : txt }); } },
                    { sep: true },
                    { label: 'Drill Down', onClick: () => T.drillDown(t.columns[ci].name, ri) },
                    { label: 'Add as New Query', onClick: () => import('./ops').then(o => { const q = currentQuery()!; o.addQuery({ name: t.columns[ci].name, code: `let\n    Source = #"${q.name}"{${ri}}[${t.columns[ci].name}]\nin\n    Source` }); }) },
                  ])}
                  style={{ whiteSpace: (s.ui.pq as any).whitespace ? 'pre' : undefined }}>{cls === 'struct' ? txt : txt}</td>;
              })}
            </tr>;
          })}
          {end < t.rows.length && <tr style={{ height: (t.rows.length - end) * RH }}><td colSpan={t.columns.length + 1} style={{ padding: 0, border: 0 }} /></tr>}
        </tbody>
      </table>
      {!t.rows.length && <div className="subtle" style={{ padding: 16 }}>This table has no rows.</div>}
    </div>
    {selProfile && <ColumnProfile col={selProfile.col} pr={selProfile.pr} t={t} />}
    {filterMenu && <FilterMenuDialog col={filterMenu.col} t={t} x={filterMenu.x} y={filterMenu.y} onClose={() => setFilterMenu(null)} />}
  </div>;
}

function ColumnProfile({ col, pr, t }: { col: string; pr: ReturnType<typeof profileOf>; t: MTable }) {
  const i = t.idx(col);
  const nums = t.rows.map(r => r[i]).filter(v => typeof v === 'number') as number[];
  const stats: [string, any][] = [['Count', pr.total], ['Error', pr.err], ['Empty', pr.empty], ['Distinct', pr.distinct], ['Unique', pr.unique]];
  if (nums.length) {
    const sum = nums.reduce((a, b) => a + b, 0); const avg = sum / nums.length;
    const sd = Math.sqrt(nums.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, nums.length - 1));
    stats.push(['Min', Math.min(...nums)], ['Max', Math.max(...nums)], ['Average', +avg.toFixed(4)], ['Standard deviation', +sd.toFixed(4)], ['Zero', nums.filter(x => x === 0).length], ['NaN', nums.filter(x => Number.isNaN(x)).length]);
  } else {
    const vals = t.rows.map(r => r[i]).filter(v => v !== null && !(v instanceof MError)).sort(compareValues);
    if (vals.length) stats.push(['Min', displayValue(vals[0], t.columns[i].type)], ['Max', displayValue(vals[vals.length - 1], t.columns[i].type)]);
  }
  return <div style={{ height: 190, borderTop: '1px solid #e1dfdd', display: 'grid', gridTemplateColumns: '260px 1fr', background: '#fff', flexShrink: 0 }}>
    <div style={{ padding: '8px 12px', overflow: 'auto', borderRight: '1px solid #e1dfdd' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Column statistics — {col}</div>
      <table className="grid-table" style={{ fontSize: 12 }}><tbody>{stats.map(([k, v]) => <tr key={k}><td style={{ color: '#605e5c', padding: '1px 8px 1px 0' }}>{k}</td><td style={{ padding: 1 }}>{String(v)}</td></tr>)}</tbody></table>
    </div>
    <div style={{ padding: '8px 12px', overflow: 'auto' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Value distribution</div>
      {pr.top10.slice(0, 12).map((x, k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 50px', gap: 8, alignItems: 'center', fontSize: 11.5 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.v === null ? 'null' : displayValue(x.v, t.columns[i].type)}</span>
        <span style={{ height: 10, background: '#e1dfdd' }}><span style={{ display: 'block', height: 10, width: `${(x.n / pr.top10[0].n) * 100}%`, background: '#118dff' }} /></span>
        <span style={{ textAlign: 'right' }}>{x.n}</span>
      </div>)}
    </div>
  </div>;
}

export { addStep, mStr };
