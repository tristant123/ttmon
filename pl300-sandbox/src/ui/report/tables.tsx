// Table and Matrix visuals, including totals, subtotals, stepped layout and conditional formatting.
import React, { useMemo } from 'react';
import { store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { summarize, sortRows, fmt, formatFor, fieldLabel, isValueField, drillLevels, fieldKey, valuesFilter, colMeta, dynamicFormat, visualContext } from '../../report/query';
import { useQuery, pointClick, isSelectedPoint, pathFilters } from './vhelpers';
import { VisError, NoData } from './charts';
import { keyOf, compareValues, isNumericType } from '../../core/values';
import { dataPointMenu } from './menus';
import { Filter } from '../../dax/engine';

function cfStyle(v: Visual, f: FieldRef, val: any, stats: { min: number; max: number }): React.CSSProperties {
  const cf = v.format?.cf?.[fieldKey(f)];
  if (!cf || typeof val !== 'number') return {};
  const st: React.CSSProperties = {};
  const t = stats.max === stats.min ? 1 : (val - stats.min) / (stats.max - stats.min);
  const mix = (a: string, b: string) => {
    const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * t)).join(',')})`;
  };
  if (cf.background) st.background = mix(cf.background.min ?? '#ffffff', cf.background.max ?? '#118dff');
  if (cf.fontRules?.length) for (const r of cf.fontRules) { if ((r.op === 'gt' && val > r.value) || (r.op === 'lt' && val < r.value) || (r.op === 'gte' && val >= r.value) || (r.op === 'lte' && val <= r.value)) st.color = r.color; }
  if (cf.dataBars) {
    const w = stats.max > 0 ? Math.max(0, (val / stats.max) * 100) : 0;
    st.backgroundImage = `linear-gradient(90deg, ${cf.dataBars.color ?? '#9ecbff'} ${w}%, transparent ${w}%)`;
    st.backgroundRepeat = 'no-repeat'; st.backgroundSize = '100% 70%'; st.backgroundPosition = 'left center';
  }
  return st;
}

const fontSize = (v: Visual) => v.format?.fontSize ?? 12;

const safeCtx = (page: Page, v: Visual) => { try { return visualContext(store, page, v).ctx; } catch { return undefined; } };

export function TableVisual({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const cols = v.wells.columns ?? [];
  const groups = cols.filter(f => !isValueField(m, f));
  const values = cols.filter(f => isValueField(m, f));
  const q = useQuery(v, page, vc => {
    if (!cols.length) return null;
    const res = summarize(s, groups, values, vc);
    const hl = vc.highlight ? summarize(s, groups, values, vc, { extraFilters: vc.highlight }) : null;
    const total = values.length && v.format?.totals !== false ? summarize(s, [], values, vc).rows[0] ?? null : null;
    return { res, total, hl };
  });
  const sortIdx = v.sort ? cols.findIndex(f => fieldKey(f) === v.sort!.by) : -1;
  const body = useMemo(() => {
    if (!q.data) return null;
    const { res } = q.data;
    // map display order (cols) → result index (groups then values)
    const map = cols.map(f => { const gi = groups.indexOf(f); return gi >= 0 ? gi : groups.length + values.indexOf(f); });
    let rows = sortRows(s, res.rows, groups, sortIdx >= 0 ? { index: map[sortIdx], desc: v.sort!.desc } : undefined);
    if (v.format?.topN) rows = rows.slice(0, v.format.topN);
    const stats = values.map((_f, j) => { const xs = rows.map(r => r[groups.length + j]).filter(x => typeof x === 'number'); return { min: Math.min(...xs), max: Math.max(...xs) }; });
    return { rows, map, stats };
  }, [q.data, v.sort, v.format?.topN]);
  if (!cols.length) return <NoData msg="Add data fields to Columns." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data || !body) return null;
  const hlKeys = q.data.hl ? new Set(q.data.hl.rows.map(r => r.slice(0, groups.length).map(keyOf).join('|'))) : null;
  const vcx = safeCtx(page, v);
  return <div style={{ overflow: 'auto', position: 'absolute', inset: 0, fontSize: fontSize(v) }}>
    <table className="grid-table vtable">
      <thead><tr>{cols.map((f, i) => {
        const num = isValueField(m, f) || isNumericType(colMeta(m, f)?.dataType ?? 'text');
        return <th key={i} className={num ? 'num' : ''} onClick={() => s.updateVisual(v.id, x => { x.sort = { by: fieldKey(f), desc: x.sort?.by === fieldKey(f) ? !x.sort.desc : num }; }, false)}>
          {fieldLabel(f)}{sortIdx === i ? (v.sort!.desc ? ' ▾' : ' ▴') : ''}</th>;
      })}</tr></thead>
      <tbody>
        {body.rows.map((r, ri) => {
          const gv = r.slice(0, groups.length);
          const sel = isSelectedPoint(v, gv);
          const dim = sel === false || (hlKeys && !hlKeys.has(gv.map(keyOf).join('|')));
          return <tr key={ri} className={dim ? 'dim' : ''} onClick={e => groups.length && pointClick(page, v, 'columns', gv, groups, undefined, e.nativeEvent)}
            onContextMenu={e => { e.preventDefault(); dataPointMenu(e.nativeEvent, page, v, groups.map((g, i) => ({ field: g, value: gv[i] }))); }}>
            {cols.map((f, ci) => {
              const val = r[body.map[ci]];
              const isV = isValueField(m, f);
              const num = typeof val === 'number';
              const c = colMeta(m, f);
              const url = c?.dataCategory === 'Web URL' && typeof val === 'string';
              const img = c?.dataCategory === 'Image URL' && typeof val === 'string';
              return <td key={ci} className={num ? 'num' : ''} style={isV ? cfStyle(v, f, val, body.stats[values.indexOf(f)]) : undefined}>
                {img ? <img src={val} alt="" style={{ height: 24 }} /> : url ? <a href={val} target="_blank" rel="noreferrer">{val}</a> : fmt(val, (isV && dynamicFormat(s, f, groups.map((g, i) => ({ field: g, value: gv[i] })), vcx)) || formatFor(m, f), f)}
              </td>;
            })}
          </tr>;
        })}
        {q.data.total && <tr className="total">{cols.map((f, ci) => {
          const vi = values.indexOf(f);
          return <td key={ci} className={vi >= 0 ? 'num' : ''}>{ci === 0 && vi < 0 ? 'Total' : vi >= 0 ? fmt(q.data!.total![vi], formatFor(m, f), f) : ''}</td>;
        })}</tr>}
      </tbody>
    </table>
  </div>;
}

interface MNode { key: string; vals: any[]; depth: number; children: MNode[]; cells: Map<string, any[]>; total: any[] }

export function MatrixVisual({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const rl = drillLevels(s, v, 'rows');
  const rowLevels = rl.levels; // all levels; visibility handled by expansion
  const colFields = (v.wells.cols ?? []).flatMap(f => drillLevels(s, { ...v, wells: { x: [f] }, drill: { level: 0, path: [] } }, 'x').levels.slice(0, 1));
  const values = v.wells.values ?? [];
  const expandedLevel = v.drill?.expandAll ? v.drill.level : 0;
  const expandedKeys = new Set<string>(v.format?.expanded ?? []);
  const q = useQuery(v, page, vc => {
    if (!rowLevels.length && !colFields.length && !values.length) return null;
    const pf: Filter[] = v.drill?.expandAll ? [] : pathFilters(v, 'rows');
    const start = v.drill?.expandAll ? 0 : rl.level;
    const levels = rowLevels.slice(start);
    const depthMax = Math.min(levels.length, Math.max(expandedLevel - start + 1, 1) + (expandedKeys.size ? levels.length : 0));
    const per: { rows: any[][] }[] = [];
    for (let d = 0; d < Math.max(1, depthMax); d++) {
      if (!levels.length) break;
      per.push({ rows: summarize(s, [...levels.slice(0, d + 1), ...colFields], values, vc, { extraFilters: pf }).rows });
    }
    const rowTotals = levels.length ? Array.from({ length: Math.max(1, depthMax) }, (_x, d) => summarize(s, levels.slice(0, d + 1), values, vc, { extraFilters: pf }).rows) : [];
    const colTotals = colFields.length ? summarize(s, colFields, values, vc, { extraFilters: pf }).rows : [];
    const grand = summarize(s, [], values, vc, { extraFilters: pf }).rows[0] ?? values.map(() => null);
    const colKeys: any[][] = []; const seen = new Set<string>();
    for (const r of sortRows(s, colTotals, colFields)) { const k = r.slice(0, colFields.length).map(keyOf).join('|'); if (!seen.has(k)) { seen.add(k); colKeys.push(r.slice(0, colFields.length)); } }
    // build tree
    const roots: MNode[] = [];
    const byKey = new Map<string, MNode>();
    rowTotals.forEach((rows, d) => {
      for (const r of sortRows(s, rows, levels.slice(0, d + 1))) {
        const vals = r.slice(0, d + 1); const key = vals.map(keyOf).join('|');
        const node: MNode = { key, vals, depth: d, children: [], cells: new Map(), total: r.slice(d + 1) };
        byKey.set(key, node);
        if (d === 0) roots.push(node); else byKey.get(vals.slice(0, d).map(keyOf).join('|'))?.children.push(node);
      }
    });
    per.forEach((p, d) => { for (const r of p.rows) { const node = byKey.get(r.slice(0, d + 1).map(keyOf).join('|')); if (node) node.cells.set(r.slice(d + 1, d + 1 + colFields.length).map(keyOf).join('|'), r.slice(d + 1 + colFields.length)); } });
    const colTotalMap = new Map(colTotals.map(r => [r.slice(0, colFields.length).map(keyOf).join('|'), r.slice(colFields.length)]));
    return { roots, colKeys, colTotalMap, grand, levels, depthMax };
  }, JSON.stringify([...expandedKeys]));
  if (!rowLevels.length && !colFields.length && !values.length) return <NoData msg="Add data fields to Rows, Columns or Values." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data) return null;
  const d = q.data;
  const showRowTotals = v.format?.rowSubtotals !== false;
  const showColTotals = v.format?.colSubtotals !== false && colFields.length > 0;
  const stepped = v.format?.stepped !== false;
  const colKeyStr = (ck: any[]) => ck.map(keyOf).join('|');
  const allNums: number[][] = values.map(() => []);
  const collect = (n: MNode) => { for (const ck of d.colKeys) { const c = n.cells.get(colKeyStr(ck)); c?.forEach((x, j) => typeof x === 'number' && allNums[j].push(x)); } if (!colFields.length) n.total.forEach((x, j) => typeof x === 'number' && allNums[j].push(x)); n.children.forEach(collect); };
  d.roots.forEach(collect);
  const stats = allNums.map(xs => ({ min: Math.min(...xs), max: Math.max(...xs) }));
  const toggle = (key: string) => s.updateVisual(v.id, x => { const e = new Set<string>(x.format?.expanded ?? []); if (e.has(key)) e.delete(key); else e.add(key); x.format = { ...(x.format ?? {}), expanded: [...e] }; }, false);
  const vcx = safeCtx(page, v);
  const valueCells = (cells: any[] | undefined, key: string, pairs: { field: FieldRef; value: any }[] = []) => values.map((f, j) => <td key={key + j} className="num" style={cfStyle(v, f, cells?.[j], stats[j])}>{fmt(cells?.[j], dynamicFormat(s, f, pairs, vcx) || formatFor(m, f), f)}</td>);
  const rowsOut: React.ReactNode[] = [];
  const startLevel = v.drill?.expandAll ? 0 : rl.level;
  const walk = (n: MNode) => {
    const open = n.depth < expandedLevel - startLevel || expandedKeys.has(n.key);
    const canOpen = n.depth < d.levels.length - 1;
    const lvl = d.levels[n.depth];
    const sel = isSelectedPoint(v, n.vals);
    rowsOut.push(<tr key={n.key} className={`${n.children.length && open ? 'sub' : ''} ${sel === false ? 'dim' : ''}`}
      onClick={e => pointClick(page, v, 'rows', n.vals, d.levels.slice(0, n.depth + 1), undefined, e.nativeEvent)}
      onContextMenu={e => { e.preventDefault(); dataPointMenu(e.nativeEvent, page, v, n.vals.map((x, i) => ({ field: d.levels[i], value: x }))); }}>
      <td style={{ paddingLeft: 8 + (stepped ? n.depth * 16 : 0) }}>
        {canOpen && v.format?.plusMinus !== false ? <span className="exp" onClick={e => { e.stopPropagation(); toggle(n.key); }}>{open ? '−' : '+'}</span> : canOpen ? null : <span style={{ display: 'inline-block', width: v.format?.plusMinus !== false && d.levels.length > 1 ? 18 : 0 }} />}
        {fmt(n.vals[n.depth], formatFor(m, lvl), lvl) || '(Blank)'}
      </td>
      {colFields.length ? d.colKeys.map(ck => valueCells(n.cells.get(colKeyStr(ck)), colKeyStr(ck), [...n.vals.slice(0, n.depth + 1).map((x, i) => ({ field: d.levels[i], value: x })), ...ck.map((x, i) => ({ field: colFields[i], value: x }))])) : null}
      {(!colFields.length || showColTotals) && valueCells(n.total, 'tot', n.vals.slice(0, n.depth + 1).map((x, i) => ({ field: d.levels[i], value: x })))}
    </tr>);
    if (open) n.children.forEach(walk);
  };
  d.roots.forEach(walk);
  return <div style={{ overflow: 'auto', position: 'absolute', inset: 0, fontSize: fontSize(v) }}>
    <table className="grid-table vtable">
      <thead>
        {colFields.length > 0 && <tr><th />{d.colKeys.map(ck => <th key={colKeyStr(ck)} colSpan={values.length || 1} style={{ textAlign: 'center', borderBottom: '1px solid #e1dfdd' }}>{ck.map((x, i) => fmt(x, formatFor(m, colFields[i]), colFields[i])).join(' ') || '(Blank)'}</th>)}{showColTotals && <th colSpan={values.length || 1} style={{ textAlign: 'center' }}>Total</th>}</tr>}
        <tr><th>{d.levels.map(l => fieldLabel(l)).slice(0, 1).join('')}{d.levels.length > 1 ? '' : ''}</th>
          {(colFields.length ? d.colKeys : [[]]).map((ck, i) => values.map((f, j) => <th key={i + '-' + j} className="num">{fieldLabel(f)}</th>))}
          {showColTotals && values.map((f, j) => <th key={'t' + j} className="num">{fieldLabel(f)}</th>)}
        </tr>
      </thead>
      <tbody>
        {rowsOut}
        {showRowTotals && d.roots.length > 0 && <tr className="total"><td>Total</td>
          {colFields.length ? d.colKeys.map(ck => values.map((f, j) => <td key={colKeyStr(ck) + j} className="num">{fmt(d.colTotalMap.get(colKeyStr(ck))?.[j], dynamicFormat(s, f, ck.map((x, i) => ({ field: colFields[i], value: x })), vcx) || formatFor(m, f), f)}</td>)) : null}
          {(!colFields.length || showColTotals) && values.map((f, j) => <td key={'g' + j} className="num">{fmt(d.grand[j], dynamicFormat(s, f, [], vcx) || formatFor(m, f), f)}</td>)}
        </tr>}
        {!d.roots.length && values.length > 0 && <tr className="total"><td>Total</td>{d.colKeys.map(ck => values.map((f, j) => <td key={colKeyStr(ck) + j} className="num">{fmt(d.colTotalMap.get(colKeyStr(ck))?.[j], formatFor(m, f), f)}</td>))}{values.map((f, j) => <td key={'g' + j} className="num">{fmt(d.grand[j], formatFor(m, f), f)}</td>)}</tr>}
      </tbody>
    </table>
  </div>;
}

export { valuesFilter, compareValues };
