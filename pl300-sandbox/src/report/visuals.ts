// Visual types offered in the Visualizations pane, with the field wells Power BI shows for each.
export interface WellDef { key: string; label: string; kind: 'group' | 'value' | 'any'; max?: number }
export interface VisualDef { type: string; name: string; wells: WellDef[]; chart?: boolean; group: 'chart' | 'table' | 'card' | 'filter' | 'ai' | 'element' }

const axis = (label = 'X-axis'): WellDef => ({ key: 'axis', label, kind: 'group' });
const legend: WellDef = { key: 'legend', label: 'Legend', kind: 'group', max: 1 };
const values = (label = 'Y-axis'): WellDef => ({ key: 'values', label, kind: 'value' });
const tooltips: WellDef = { key: 'tooltips', label: 'Tooltips', kind: 'value' };

export const VISUALS: VisualDef[] = [
  { type: 'stackedBar', name: 'Stacked bar chart', group: 'chart', chart: true, wells: [axis('Y-axis'), values('X-axis'), legend, tooltips] },
  { type: 'stackedColumn', name: 'Stacked column chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'clusteredBar', name: 'Clustered bar chart', group: 'chart', chart: true, wells: [axis('Y-axis'), values('X-axis'), legend, tooltips] },
  { type: 'clusteredColumn', name: 'Clustered column chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'stackedBar100', name: '100% Stacked bar chart', group: 'chart', chart: true, wells: [axis('Y-axis'), values('X-axis'), legend, tooltips] },
  { type: 'stackedColumn100', name: '100% Stacked column chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'line', name: 'Line chart', group: 'chart', chart: true, wells: [axis(), values(), { ...legend, label: 'Legend' }, { key: 'secondary', label: 'Secondary y-axis', kind: 'value' }, tooltips] },
  { type: 'area', name: 'Area chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'stackedArea', name: 'Stacked area chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'lineClusteredColumn', name: 'Line and clustered column chart', group: 'chart', chart: true, wells: [axis(), { key: 'values', label: 'Column y-axis', kind: 'value' }, { key: 'lineValues', label: 'Line y-axis', kind: 'value' }, { ...legend, label: 'Column legend' }, tooltips] },
  { type: 'lineStackedColumn', name: 'Line and stacked column chart', group: 'chart', chart: true, wells: [axis(), { key: 'values', label: 'Column y-axis', kind: 'value' }, { key: 'lineValues', label: 'Line y-axis', kind: 'value' }, { ...legend, label: 'Column legend' }, tooltips] },
  { type: 'ribbon', name: 'Ribbon chart', group: 'chart', chart: true, wells: [axis(), values(), legend, tooltips] },
  { type: 'waterfall', name: 'Waterfall chart', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Category', kind: 'group' }, { key: 'breakdown', label: 'Breakdown', kind: 'group', max: 1 }, values('Y-axis'), tooltips] },
  { type: 'funnel', name: 'Funnel', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Category', kind: 'group' }, { key: 'values', label: 'Values', kind: 'value', max: 1 }, tooltips] },
  { type: 'scatter', name: 'Scatter chart', group: 'chart', chart: true, wells: [{ key: 'details', label: 'Values', kind: 'group' }, { key: 'x', label: 'X-axis', kind: 'value', max: 1 }, { key: 'y', label: 'Y-axis', kind: 'value', max: 1 }, legend, { key: 'size', label: 'Size', kind: 'value', max: 1 }, { key: 'play', label: 'Play axis', kind: 'group', max: 1 }, tooltips] },
  { type: 'pie', name: 'Pie chart', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Legend', kind: 'group' }, { key: 'values', label: 'Values', kind: 'value', max: 1 }, { key: 'details', label: 'Details', kind: 'group', max: 1 }, tooltips] },
  { type: 'donut', name: 'Donut chart', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Legend', kind: 'group' }, { key: 'values', label: 'Values', kind: 'value', max: 1 }, { key: 'details', label: 'Details', kind: 'group', max: 1 }, tooltips] },
  { type: 'treemap', name: 'Treemap', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Category', kind: 'group' }, { key: 'details', label: 'Details', kind: 'group', max: 1 }, { key: 'values', label: 'Values', kind: 'value', max: 1 }, tooltips] },
  { type: 'map', name: 'Map', group: 'chart', chart: true, wells: [{ key: 'axis', label: 'Location', kind: 'group' }, legend, { key: 'values', label: 'Bubble size', kind: 'value', max: 1 }, tooltips] },
  { type: 'gauge', name: 'Gauge', group: 'card', chart: true, wells: [{ key: 'values', label: 'Value', kind: 'value', max: 1 }, { key: 'min', label: 'Minimum value', kind: 'value', max: 1 }, { key: 'max', label: 'Maximum value', kind: 'value', max: 1 }, { key: 'target', label: 'Target value', kind: 'value', max: 1 }, tooltips] },
  { type: 'card', name: 'Card', group: 'card', wells: [{ key: 'values', label: 'Fields', kind: 'value', max: 1 }] },
  { type: 'cardNew', name: 'Card (new)', group: 'card', wells: [{ key: 'values', label: 'Data', kind: 'value' }] },
  { type: 'multiRowCard', name: 'Multi-row card', group: 'card', wells: [{ key: 'values', label: 'Fields', kind: 'any' }] },
  { type: 'kpi', name: 'KPI', group: 'card', wells: [{ key: 'values', label: 'Value', kind: 'value', max: 1 }, { key: 'axis', label: 'Trend axis', kind: 'group', max: 1 }, { key: 'target', label: 'Target', kind: 'value', max: 1 }] },
  { type: 'slicer', name: 'Slicer', group: 'filter', wells: [{ key: 'field', label: 'Field', kind: 'group' }] },
  { type: 'table', name: 'Table', group: 'table', wells: [{ key: 'columns', label: 'Columns', kind: 'any' }] },
  { type: 'matrix', name: 'Matrix', group: 'table', wells: [{ key: 'rows', label: 'Rows', kind: 'group' }, { key: 'cols', label: 'Columns', kind: 'group' }, { key: 'values', label: 'Values', kind: 'value' }] },
  { type: 'decompositionTree', name: 'Decomposition tree', group: 'ai', wells: [{ key: 'values', label: 'Analyze', kind: 'value', max: 1 }, { key: 'explain', label: 'Explain by', kind: 'group' }] },
  { type: 'keyInfluencers', name: 'Key influencers', group: 'ai', wells: [{ key: 'values', label: 'Analyze', kind: 'value', max: 1 }, { key: 'explain', label: 'Explain by', kind: 'group' }] },
  { type: 'qna', name: 'Q&A', group: 'ai', wells: [] },
  { type: 'smartNarrative', name: 'Narrative', group: 'ai', wells: [] },
  { type: 'textbox', name: 'Text box', group: 'element', wells: [] },
  { type: 'button', name: 'Button', group: 'element', wells: [] },
  { type: 'shape', name: 'Shape', group: 'element', wells: [] },
  { type: 'image', name: 'Image', group: 'element', wells: [] },
];

export const vdef = (t: string) => VISUALS.find(v => v.type === t) ?? VISUALS[0];
export const groupWells = (t: string) => vdef(t).wells.filter(w => w.kind === 'group').map(w => w.key);

export const isBarLike = (t: string) => /^(stacked|clustered)(Bar|Column)(100)?$/.test(t) || t === 'ribbon';
export const isHorizontal = (t: string) => /Bar/.test(t);
