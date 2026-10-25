import { store, Store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { visualContext, VisualContext, valuesFilter, drillLevels, fieldLabel, colMeta } from '../../report/query';
import { Filter } from '../../dax/engine';
import { keyOf } from '../../core/values';
import { themeColors } from './themes';

const cache = new Map<string, { data?: any; error?: string; ms: number }>();

export function pageStateKey(s: Store, page: Page) {
  return JSON.stringify([s.project.report.reportFilters, page.filters, page.interactions, page.visuals.filter(v => v.type === 'slicer').map(v => [v.id, v.wells, v.slicer]), s.ui.drillthrough]);
}

/** Memoised query evaluation for a visual. */
export function useQuery<T>(v: Visual, page: Page, f: (vc: VisualContext) => T, extra = ''): { data?: T; error?: string; ms: number } {
  const s = store;
  const key = [s.engineVersion, JSON.stringify(s.ui.viewAs), pageStateKey(s, page), v.id, JSON.stringify([v.type, v.wells, v.filters, v.drill, v.sort, v.format?.topN]),
    s.ui.cross && s.ui.cross.pageId === page.id && s.ui.cross.visualId !== v.id ? JSON.stringify(s.ui.cross) : '', s.ui.cross?.visualId === v.id ? 'self:' + JSON.stringify(s.ui.cross) : '', extra].join('§');
  const hit = cache.get(key);
  if (hit) return hit;
  const t0 = performance.now();
  let res: { data?: T; error?: string; ms: number };
  try {
    const vc = visualContext(s, page, v);
    res = { data: f(vc), ms: 0 };
  } catch (e) {
    res = { error: (e as Error).message, ms: 0 };
  }
  res.ms = performance.now() - t0;
  if (cache.size > 400) cache.clear();
  cache.set(key, res);
  if (s.ui.panes.perf) { s.ui.perf = [{ visual: v.id, ms: res.ms, at: Date.now() }, ...s.ui.perf.filter(p => p.visual !== v.id)].slice(0, 40); }
  return res;
}
export function clearQueryCache() { cache.clear(); }

export function colors() { return themeColors(store.project.report.theme); }

export function pathFilters(v: Visual, wellKey: string): Filter[] {
  const lv = drillLevels(store, v, wellKey);
  return lv.pathFilters.map(p => valuesFilter(store.dax, p.field, [p.value])).filter(Boolean) as Filter[];
}

/** What a click on a data point does: cross-filter, or drill when drill mode is on. */
export function pointClick(page: Page, v: Visual, wellKey: string, groupVals: any[], groups: FieldRef[], legend?: { field: FieldRef; value: any }, ev?: MouseEvent) {
  const s = store;
  const lv = drillLevels(s, v, wellKey);
  if (v.format?.drillMode && lv.canDrill && lv.level < lv.levels.length - 1 && !lv.shown.slice(1).length) {
    const path = [...(v.drill?.path ?? [])]; path[lv.level] = groupVals[0];
    s.updateVisual(v.id, x => { x.drill = { level: lv.level + 1, path, expandAll: false }; }, false);
    return;
  }
  const filters = groups.map((g, i) => ({ field: g, values: [groupVals[i]] }));
  if (legend) filters.push({ field: legend.field, values: [legend.value] });
  // include drill path so a drilled-down point filters the right parent
  lv.pathFilters.forEach(p => filters.push({ field: p.field, values: [p.value] }));
  const cur = s.ui.cross;
  const same = cur && cur.visualId === v.id && JSON.stringify(cur.filters.map(f => f.values.map(keyOf))) === JSON.stringify(filters.map(f => f.values.map(keyOf)));
  if (ev?.ctrlKey && cur && cur.visualId === v.id) {
    // multi-select: merge values into the first group field
    const merged = cur.filters.map((f, i) => ({ ...f, values: [...f.values, ...(filters[i]?.values ?? [])] }));
    s.setUI({ cross: { pageId: page.id, visualId: v.id, filters: merged }, selected: [v.id] });
    return;
  }
  s.setUI({ cross: same ? null : { pageId: page.id, visualId: v.id, filters }, selected: [v.id] });
}

export function isSelectedPoint(v: Visual, groupVals: any[], legendVal?: any): boolean | null {
  const c = store.ui.cross;
  if (!c || c.visualId !== v.id) return null;
  const vals = [...groupVals, ...(legendVal !== undefined ? [legendVal] : [])];
  return c.filters.slice(0, vals.length).every((f, i) => f.values.some(x => keyOf(x) === keyOf(vals[i])));
}

export function labelFor(f: FieldRef) { return fieldLabel(f); }
export function isDateLike(f: FieldRef) { const c = colMeta(store.project.model, f); return !!c && (c.dataType === 'date' || c.dataType === 'datetime') && !f.datePart; }
