// Builds the DAX evaluation behind each visual: filter context from report/page/visual
// filters, slicers, cross-filtering, drill state; then SUMMARIZECOLUMNS-style grouping.
import { DaxEngine, Ctx, Filter, VCol, VTable, emptyCtx, datePartValue, truthy } from '../dax/engine';
import { DNode } from '../dax/parser';
import { FieldRef, FilterSpec, Visual, Page, Model, ColumnMeta, Measure } from '../model/types';
import { compareValues, keyOf, isNumericType, MONTHS } from '../core/values';
import { formatValue } from '../core/format';
import { vdef, isBarLike } from './visuals';
import type { Store } from '../store';

export function colMeta(m: Model, f: FieldRef): ColumnMeta | undefined {
  if (!f.column) return undefined;
  return m.tables.find(t => t.name === f.table)?.columns.find(c => c.name === f.column);
}
export function measureMeta(m: Model, f: FieldRef): Measure | undefined {
  return f.measure ? m.measures.find(x => x.name === f.measure) : undefined;
}
export function isValueField(m: Model, f: FieldRef) {
  if (f.measure) return true;
  if (f.agg && f.agg !== 'None') return true;
  return false;
}

export function defaultAgg(m: Model, f: FieldRef): FieldRef['agg'] {
  const c = colMeta(m, f);
  if (!c) return undefined;
  if (c.summarizeBy && c.summarizeBy !== 'None') return c.summarizeBy;
  if (isNumericType(c.dataType)) return c.summarizeBy === 'None' ? 'Count' : 'Sum';
  return 'Count';
}

const AGG_LABEL: Record<string, string> = {
  Sum: 'Sum of', Average: 'Average of', Min: 'Min of', Max: 'Max of', Count: 'Count of', DistinctCount: 'Count of',
  StdDev: 'Standard deviation of', Variance: 'Variance of', Median: 'Median of', CountNonBlank: 'Count of', First: 'First', Last: 'Last',
};
export function fieldLabel(f: FieldRef): string {
  if (f.alias) return f.alias;
  if (f.measure) return f.measure;
  if (f.datePart) return f.datePart;
  if (f.hierarchy) return f.hierarchy;
  if (f.agg && f.agg !== 'None') return `${AGG_LABEL[f.agg] ?? f.agg} ${f.column}`;
  return f.column ?? '';
}
export const fieldKey = (f: FieldRef) => `${f.table}|${f.column ?? ''}|${f.measure ?? ''}|${f.datePart ?? ''}|${f.agg ?? ''}`;

/** The DAX expression for a value field (explicit or implicit measure). */
export function valueNode(m: Model, f: FieldRef): DNode {
  if (f.measure) return { k: 'col', col: f.measure };
  const col: DNode = { k: 'col', table: f.table, col: f.column! };
  const agg = f.agg && f.agg !== 'None' ? f.agg : defaultAgg(m, f);
  const fn = ({ Sum: 'SUM', Average: 'AVERAGE', Min: 'MIN', Max: 'MAX', Count: 'COUNTA', DistinctCount: 'DISTINCTCOUNT', StdDev: 'STDEV.S', Variance: 'VAR.S', Median: 'MEDIAN', CountNonBlank: 'COUNTA', First: 'MIN', Last: 'MAX' } as Record<string, string>)[agg ?? 'Count'] ?? 'COUNTA';
  return { k: 'call', fn, args: [col] };
}

export function formatFor(m: Model, f: FieldRef): string | undefined {
  if (f.measure) return measureMeta(m, f)?.formatString;
  if (f.datePart) return undefined;
  const c = colMeta(m, f);
  if (!c) return undefined;
  if (f.agg === 'Count' || f.agg === 'DistinctCount' || f.agg === 'CountNonBlank') return '#,0';
  if (c.formatString) return c.formatString;
  if (c.dataType === 'date') return 'm/d/yyyy';
  return undefined;
}

export function fmt(v: any, format?: string, f?: FieldRef): string {
  if (v === null || v === undefined) return '';
  if (f?.datePart === 'Month' && typeof v === 'number') return MONTHS[v - 1] ?? String(v);
  if (f?.datePart === 'Quarter' && typeof v === 'number') return `Qtr ${v}`;
  if (typeof v === 'number' && !format) {
    if (Number.isInteger(v)) return f?.datePart || (f?.column && /year/i.test(f.column)) ? String(v) : v.toLocaleString('en-US');
    return v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Math.abs(v) < 1000 ? 0 : 0 });
  }
  if (v instanceof Date && !format) return formatValue(v);
  return formatValue(v, format ? format.replace(/\\\$/g, '$') : format);
}

/** Expand a field into drill levels (auto date/time hierarchy, or a user hierarchy). */
export function levelsOf(m: Model, f: FieldRef, autoDate: boolean): FieldRef[] {
  if (f.hierarchy) {
    const h = m.hierarchies.find(x => x.table === f.table && x.name === f.hierarchy);
    if (h) return h.levels.map(l => ({ table: f.table, column: l }));
  }
  if (f.column && !f.datePart && !f.agg && autoDate) {
    const c = colMeta(m, f);
    const tab = m.tables.find(t => t.name === f.table);
    const isDateTableKey = tab?.dateColumn === f.column;
    if (c && (c.dataType === 'date' || c.dataType === 'datetime') && !isDateTableKey && !(f as any).noHierarchy) {
      return (['Year', 'Quarter', 'Month', 'Day'] as const).map(p => ({ table: f.table, column: f.column, datePart: p }));
    }
  }
  return [f];
}

export const toVCol = (f: FieldRef): VCol => ({ name: f.column!, t: f.table, c: f.column!, part: f.datePart });

// ---------- filters ----------
function distinctValues(eng: DaxEngine, f: FieldRef, ctx: Ctx): any[] {
  const tab = eng.table(f.table); const ci = eng.colIdx(f.table, f.column!);
  const seen = new Map<string, any>();
  for (const i of eng.visible(tab.name, ctx)) {
    const raw = tab.rows[i][ci];
    const v = f.datePart ? datePartValue(raw, f.datePart) : raw;
    const k = keyOf(v); if (!seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()];
}
export function allValues(eng: DaxEngine, f: FieldRef, ctx: Ctx = emptyCtx()): any[] {
  try { return distinctValues(eng, f, { ...ctx, filters: [], cache: new Map() }).sort(compareValues); } catch { return []; }
}

export function valuesFilter(eng: DaxEngine, f: FieldRef, vals: any[]): Filter | null {
  if (!f.column) return null;
  const col = toVCol(f);
  return eng.filterFromTable(new VTable([col], vals.map(v => [v])));
}

export function testCond(op: string, v: any, target: any): boolean {
  const s = (x: any) => (x === null || x === undefined ? '' : String(x).toLowerCase());
  const cmp = () => compareValues(v, typeof target === 'string' && typeof v === 'number' ? Number(target) : target instanceof Date || typeof target === 'number' ? target : typeof v === 'number' ? Number(target) : target);
  switch (op) {
    case 'is': return s(v) === s(target);
    case 'isNot': return s(v) !== s(target);
    case 'lt': return v !== null && cmp() < 0;
    case 'lte': return v !== null && cmp() <= 0;
    case 'gt': return v !== null && cmp() > 0;
    case 'gte': return v !== null && cmp() >= 0;
    case 'contains': return s(v).includes(s(target));
    case 'notContains': return !s(v).includes(s(target));
    case 'startsWith': return s(v).startsWith(s(target));
    case 'notStartsWith': return !s(v).startsWith(s(target));
    case 'isBlank': return v === null || v === undefined;
    case 'isNotBlank': return v !== null && v !== undefined;
    case 'isEmpty': return v === '' || v === null;
    case 'isNotEmpty': return v !== '' && v !== null;
  }
  return true;
}

function relativeRange(spec: FilterSpec & { type: 'relative' }): [Date, Date] {
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const add = (d: Date, n: number) => {
    switch (spec.unit) {
      case 'days': return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
      case 'weeks': return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n);
      case 'months': return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
      case 'years': return new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
    }
  };
  if (spec.mode === 'this') {
    if (spec.unit === 'days') return [today, today];
    if (spec.unit === 'weeks') { const s = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()); return [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)]; }
    if (spec.unit === 'months') return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)];
    return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
  }
  if (spec.mode === 'last') return [add(today, -spec.n), today];
  return [today, add(today, spec.n)];
}

/** Convert a filter-pane card to a DAX filter. Measure filters return 'post'. */
export function specToFilter(eng: DaxEngine, spec: FilterSpec, ctx: Ctx, store?: Store): Filter | null | 'post' {
  const f = spec.field;
  if (f.measure || (f.agg && f.agg !== 'None' && spec.type === 'advanced')) return spec.type === 'advanced' ? 'post' : null;
  if (!f.column) return null;
  try {
    switch (spec.type) {
      case 'none': return null;
      case 'basic': {
        if (!spec.values.length) return null;
        let vals = spec.values;
        if (spec.invert) { const ks = new Set(vals.map(keyOf)); vals = allValues(eng, f).filter(v => !ks.has(keyOf(v))); }
        return valuesFilter(eng, f, vals);
      }
      case 'advanced': {
        const conds = spec.conds.filter(c => c.op && (c.value !== '' && c.value !== undefined || /Blank|Empty/.test(c.op)));
        if (!conds.length) return null;
        const vals = allValues(eng, f).concat(allValues(eng, f).length ? [] : []);
        const withBlank = [...vals, null];
        const ok = withBlank.filter(v => spec.logic === 'and' ? conds.every(c => testCond(c.op, v, c.value)) : conds.some(c => testCond(c.op, v, c.value)));
        return valuesFilter(eng, f, ok);
      }
      case 'topn': {
        if (!spec.by || !spec.n) return null;
        const m = store?.project.model ?? eng.model;
        const vt = eng.summarizeColumns([toVCol(f)], [], [{ name: 'v', node: valueNode(m, spec.by) }], ctx);
        const rows = [...vt.rows].sort((a, b) => compareValues(b[1], a[1]) * (spec.dir === 'top' ? 1 : -1));
        return valuesFilter(eng, f, rows.slice(0, spec.n).map(r => r[0]));
      }
      case 'relative': {
        const [s, e] = relativeRange(spec);
        const vals = allValues(eng, { ...f, datePart: undefined }).filter(v => v instanceof Date && v >= s && v <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59));
        return valuesFilter(eng, { ...f, datePart: undefined }, vals);
      }
    }
  } catch { return null; }
  return null;
}

export interface Interaction { type: 'filter' | 'highlight' | 'none' }
const HIGHLIGHT_TARGETS = new Set(['stackedBar', 'stackedColumn', 'clusteredBar', 'clusteredColumn', 'stackedBar100', 'stackedColumn100', 'pie', 'donut', 'treemap', 'funnel', 'ribbon', 'waterfall']);
export function interactionFor(page: Page, src: Visual, target: Visual): 'filter' | 'highlight' | 'none' {
  const k = `${src.id}>${target.id}`;
  if (page.interactions?.[k]) return page.interactions[k];
  if (src.type === 'slicer') return 'filter';
  return HIGHLIGHT_TARGETS.has(target.type) ? 'highlight' : 'filter';
}

export interface VisualContext { ctx: Ctx; post: FilterSpec[]; highlight: Filter[] | null }

/** Filter context for a visual: report + page + visual filters, slicers, cross-filters, drillthrough. */
export function visualContext(store: Store, page: Page, v: Visual): VisualContext {
  const eng = store.dax;
  let ctx: Ctx = emptyCtx();
  const post: FilterSpec[] = [];
  const add = (f: Filter | null | 'post', spec?: FilterSpec) => {
    if (f === 'post') { if (spec) post.push(spec); return; }
    if (f) ctx = { ...ctx, filters: eng.applyFilter(ctx.filters, f, true), cache: new Map() };
  };
  for (const s of [...store.project.report.reportFilters, ...page.filters]) add(specToFilter(eng, s, ctx, store), s);
  // drillthrough
  if (page.drillthrough?.length && store.ui.drillthrough) for (const d of store.ui.drillthrough.filters) add(valuesFilter(eng, d.field, [d.value]));
  // slicers on the page
  for (const s of page.visuals) {
    if (s.id === v.id || s.type !== 'slicer' || !s.wells.field?.length) continue;
    if (interactionFor(page, s, v) === 'none') continue;
    const fld = s.wells.field[0];
    const lvls = s.wells.field.length === 1 ? levelsOf(store.project.model, fld, false) : s.wells.field;
    if (s.slicer?.range && fld.column) {
      const [lo, hi] = s.slicer.range;
      const vals = allValues(eng, fld).filter(x => (lo === null || lo === undefined || compareValues(x, lo) >= 0) && (hi === null || hi === undefined || compareValues(x, hi) <= 0));
      add(valuesFilter(eng, fld, vals));
    } else if (s.slicer?.values?.length) {
      // a hierarchy slicer stores [levelIndex, value] pairs
      const byField = new Map<number, any[]>();
      for (const item of s.slicer.values) { if (Array.isArray(item)) { const [li, val] = item; if (!byField.has(li)) byField.set(li, []); byField.get(li)!.push(val); } else { if (!byField.has(0)) byField.set(0, []); byField.get(0)!.push(item); } }
      for (const [li, vals] of byField) add(valuesFilter(eng, lvls[li] ?? fld, vals));
    }
  }
  // visual-level filters
  for (const s of v.filters) add(specToFilter(eng, s, ctx, store), s);
  // the visual's own selection state (for ALLSELECTED) is everything so far
  const selected = ctx.filters;
  // cross-filter / cross-highlight from another visual's selection
  let highlight: Filter[] | null = null;
  const cs = store.ui.cross;
  if (cs && cs.pageId === page.id && cs.visualId !== v.id) {
    const src = page.visuals.find(x => x.id === cs.visualId);
    const it = src ? interactionFor(page, src, v) : 'none';
    const fs = cs.filters.map(x => valuesFilter(eng, x.field, x.values)).filter(Boolean) as Filter[];
    if (it === 'filter') for (const f of fs) add(f);
    else if (it === 'highlight' && fs.length) highlight = fs;
  }
  ctx = { ...ctx, selected };
  return { ctx, post, highlight };
}

export interface QResult { cols: { field: FieldRef; label: string; isValue: boolean; format?: string }[]; rows: any[][]; error?: string }

/** Group by `groups` and evaluate `values`; post-filters from measure filters are applied. */
export function summarize(store: Store, groups: FieldRef[], values: FieldRef[], vc: VisualContext, opts: { keepBlanks?: boolean; extraFilters?: Filter[] } = {}): QResult {
  const eng = store.dax; const m = store.project.model;
  let ctx = vc.ctx;
  if (opts.extraFilters?.length) { let fs = ctx.filters; for (const f of opts.extraFilters) fs = eng.applyFilter(fs, f, true); ctx = { ...ctx, filters: fs, cache: new Map() }; }
  const exprs = values.map((f, i) => ({ name: 'v' + i, node: valueNode(m, f) }));
  const postSpecs = vc.post;
  const postExprs = postSpecs.map((s, i) => ({ name: 'p' + i, node: valueNode(m, s.field) }));
  const anyNoData = groups.some(g => g.showItemsNoData);
  const vt = eng.summarizeColumns(groups.map(toVCol), [], [...exprs, ...postExprs], ctx, { keepBlanks: opts.keepBlanks || anyNoData });
  let rows = vt.rows;
  if (!values.length && !postExprs.length) rows = vt.rows;
  if (postSpecs.length) {
    const off = groups.length + values.length;
    rows = rows.filter(r => postSpecs.every((s, i) => {
      if (s.type !== 'advanced') return true;
      const v = r[off + i];
      const conds = s.conds.filter(c => c.op);
      if (!conds.length) return true;
      const res = conds.map(c => testCond(c.op, v, c.value === '' ? null : Number(c.value)));
      return s.logic === 'and' ? res.every(Boolean) : res.some(Boolean);
    }));
    rows = rows.map(r => r.slice(0, off));
  }
  return {
    cols: [...groups.map(g => ({ field: g, label: fieldLabel(g), isValue: false, format: formatFor(m, g) })), ...values.map(f => ({ field: f, label: fieldLabel(f), isValue: true, format: formatFor(m, f) }))],
    rows,
  };
}

/** Sort rows using Sort by column for group fields. */
export function sortRows(store: Store, rows: any[][], groups: FieldRef[], by?: { index: number; desc: boolean }) {
  const m = store.project.model;
  const keyFns = groups.map(g => {
    const c = colMeta(m, g);
    if (!c?.sortByColumn || g.datePart) return (v: any) => v;
    const tab = m.tables.find(t => t.name === g.table)!;
    const ci = tab.columns.findIndex(x => x.name === g.column), si = tab.columns.findIndex(x => x.name === c.sortByColumn);
    const map = new Map<string, any>();
    if (ci >= 0 && si >= 0) for (const r of tab.rows) { const k = keyOf(r[ci]); if (!map.has(k)) map.set(k, r[si]); }
    return (v: any) => map.get(keyOf(v)) ?? v;
  });
  const out = [...rows];
  out.sort((a, b) => {
    if (by) { const fnk = by.index < groups.length ? keyFns[by.index] : (x: any) => x; const d = compareValues(fnk(a[by.index]), fnk(b[by.index])); if (d) return by.desc ? -d : d; }
    for (let i = 0; i < groups.length; i++) { const d = compareValues(keyFns[i](a[i]), keyFns[i](b[i])); if (d) return d; }
    return 0;
  });
  return out;
}

/** Current drill levels for the visual's hierarchy well. */
export function drillLevels(store: Store, v: Visual, wellKey: string) {
  const m = store.project.model;
  const fields = v.wells[wellKey] ?? [];
  const autoDate = store.project.settings.autoDateTime;
  const levels = fields.flatMap(f => levelsOf(m, f, autoDate).map(l => ({ ...l, agg: undefined, showItemsNoData: f.showItemsNoData })));
  const d = v.drill ?? { level: 0, path: [] };
  const level = Math.min(d.level, Math.max(0, levels.length - 1));
  const shown = d.expandAll ? levels.slice(0, level + 1) : levels.length ? [levels[level]] : [];
  const pathFilters: { field: FieldRef; value: any }[] = d.expandAll ? [] : (d.path ?? []).slice(0, level).map((val, i) => ({ field: levels[i], value: val }));
  return { levels, level, shown, pathFilters, canDrill: levels.length > 1 };
}

export function defaultSort(type: string, groups: FieldRef[], store: Store): { index: number; desc: boolean } | undefined {
  const m = store.project.model;
  if (!isBarLike(type) && !['pie', 'donut', 'treemap', 'funnel'].includes(type)) return undefined;
  const g = groups[0];
  if (!g) return undefined;
  const c = colMeta(m, g);
  if (g.datePart || (c && (isNumericType(c.dataType) || c.dataType === 'date' || c.dataType === 'datetime')) || c?.sortByColumn) return undefined;
  return { index: groups.length, desc: true };
}

export function evalCard(store: Store, page: Page, v: Visual, f: FieldRef): any {
  const vc = visualContext(store, page, v);
  return store.dax.scalar(valueNode(store.project.model, f), vc.ctx);
}

export { truthy, vdef };
