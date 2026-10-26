import { store, uid } from '../../store';
import { Page, Visual, FieldRef } from '../../model/types';
import { menuAt, MenuItem } from '../common';
import { fmt, formatFor, fieldLabel } from '../../report/query';

/** Right-click on a data point: Drill through, Include, Exclude, Copy. */
export function dataPointMenu(e: MouseEvent, page: Page, v: Visual, point: { field: FieldRef; value: any }[]) {
  const s = store;
  const targets = s.project.report.pages.filter(p => p.id !== page.id && p.drillthrough?.length && p.drillthrough.every(d => point.some(x => x.field.table === d.table && x.field.column === d.column && !x.field.datePart)));
  const items: MenuItem[] = [];
  items.push({ label: 'Drill through', icon: 'chevronRight', disabled: !targets.length, items: targets.map(t => ({ label: t.name, onClick: () => {
    s.setUI({ drillthrough: { from: page.id, filters: point.filter(x => t.drillthrough!.some(d => d.table === x.field.table && d.column === x.field.column)) }, pageId: t.id, selected: [], cross: null });
  } })) });
  if (['clusteredColumn', 'clusteredBar', 'stackedColumn', 'stackedBar', 'line', 'area', 'stackedArea', 'lineClusteredColumn', 'lineStackedColumn'].includes(v.type) && (v.wells.values?.length ?? 0) > 0) {
    items.push({ label: 'Analyze', icon: 'analyze', items: [
      { label: 'Explain the increase', onClick: () => void import('./analyze').then(a => a.openAnalyze(page, v, point, 'explain')) },
      { label: 'Explain the decrease', onClick: () => void import('./analyze').then(a => a.openAnalyze(page, v, point, 'explain')) },
      { label: 'Find where this distribution is different', onClick: () => void import('./analyze').then(a => a.openAnalyze(page, v, point, 'distribution')) },
    ] });
  }
  const first = point[0];
  if (first?.field.column) {
    const label = fmt(first.value, formatFor(s.project.model, first.field), first.field) || '(Blank)';
    items.push({ sep: true });
    items.push({ label: `Include "${label}"`, icon: 'filter', onClick: () => s.updateVisual(v.id, x => { x.filters.push({ id: uid('f'), field: { ...first.field, agg: undefined }, type: 'basic', values: [first.value] }); }) });
    items.push({ label: `Exclude "${label}"`, icon: 'x', onClick: () => s.updateVisual(v.id, x => { x.filters.push({ id: uid('f'), field: { ...first.field, agg: undefined }, type: 'basic', values: [first.value], invert: true }); }) });
  }
  items.push({ sep: true });
  items.push({ label: 'Copy value', icon: 'copy', onClick: () => { void navigator.clipboard?.writeText(point.map(p => `${fieldLabel(p.field)}: ${fmt(p.value, formatFor(s.project.model, p.field), p.field)}`).join('\n')).catch(() => {}); } });
  menuAt(e, items);
}
