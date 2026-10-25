// Project files: save/open the sandbox project, import Power BI templates (.pbit) and
// semantic models (model.bim / .pbip), export the model as TMSL (.bim).
import { unzipSync, strFromU8 } from 'fflate';
import { store, uid, stripRows, replacer, reviver, emptyProject } from '../store';
import { Project, ModelTable, Relationship, Measure, Visual, Page, FieldRef, Role, Hierarchy } from '../model/types';
import type { StoredFile } from '../m/sources';
import { download, pickFiles } from '../ui/common';
import { Query } from '../m/engine';
import { DataType } from '../core/values';
import { clearQueryCache } from '../ui/report/vhelpers';

const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function serializeProject(): string {
  const s = store;
  return JSON.stringify({ format: 'pl300-sandbox', version: 1, saved: new Date().toISOString(), project: stripRows(s.project), files: s.files.map(f => ({ name: f.name, folder: f.folder, modified: f.modified, data: b64(f.bytes) })) }, replacer);
}

export function saveProjectFile() {
  const s = store;
  try { localStorage.setItem('pl300-sandbox-project', s.snapshot()); } catch { /* ignore */ }
  void s.persistFiles();
  download(`${s.project.name || 'Untitled'}.pbisandbox`, serializeProject(), 'application/json');
}

export async function openProjectFile() {
  const files = await pickFiles('.pbisandbox,.json,.pbit,.bim,.pbix,.pbip', false);
  const f = files[0]; if (!f) return;
  await openAnyFile(f);
}

export async function openAnyFile(f: File) {
  const s = store;
  const ext = f.name.split('.').pop()!.toLowerCase();
  const bytes = new Uint8Array(await f.arrayBuffer());
  try {
    if (ext === 'pbix') {
      s.openDialog({ type: 'message', title: 'Open a .pbix file', text: 'A .pbix stores its data in Power BI\'s compressed VertiPaq format, which only Power BI itself can read. To bring a report into the sandbox, open it in Power BI Desktop and choose File › Export › Power BI template (.pbit), then open the .pbit here. The template carries your queries, model, measures, relationships, roles and report pages; then upload the source files it uses.' });
      return;
    }
    if (ext === 'pbit') { importPbit(bytes, f.name.replace(/\.pbit$/i, '')); return; }
    const text = new TextDecoder().decode(bytes);
    const json = JSON.parse(text, reviver);
    if (json.format === 'pl300-sandbox') {
      const files: StoredFile[] = json.files.map((x: any) => ({ name: x.name, folder: x.folder, modified: x.modified, bytes: unb64(x.data) }));
      s.loadProject(json.project as Project, files);
      clearQueryCache();
      s.toast(`Opened ${f.name}`);
      return;
    }
    if (json.model || json.compatibilityLevel) { importTmsl(json, f.name.replace(/\.(bim|json)$/i, ''), null); return; }
    throw new Error('Unrecognized file. Open a .pbisandbox project, a .pbit template or a model.bim file.');
  } catch (e) {
    s.openDialog({ type: 'message', title: 'Couldn\'t open the file', text: (e as Error).message });
  }
}

function decodeUtf16(u: Uint8Array) {
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder('utf-16le').decode(u.subarray(2));
  if (u.length > 1 && u[1] === 0) return new TextDecoder('utf-16le').decode(u);
  return new TextDecoder().decode(u);
}

export function importPbit(bytes: Uint8Array, name: string) {
  const zip = unzipSync(bytes);
  const key = Object.keys(zip).find(k => /DataModelSchema$/i.test(k));
  if (!key) throw new Error('This .pbit has no DataModelSchema. It may use a live connection or be a report-only template.');
  const schema = JSON.parse(decodeUtf16(zip[key]));
  const layoutKey = Object.keys(zip).find(k => /Report\/Layout$/i.test(k));
  const layout = layoutKey ? JSON.parse(decodeUtf16(zip[layoutKey])) : null;
  importTmsl(schema, name, layout);
  void strFromU8;
}

const tmslType = (t: string): DataType => ({ string: 'text', int64: 'int', double: 'decimal', decimal: 'currency', boolean: 'bool', dateTime: 'datetime', date: 'date' } as Record<string, DataType>)[t] ?? 'text';
const joinExpr = (e: any): string => (Array.isArray(e) ? e.join('\n') : String(e ?? ''));

export function importTmsl(schema: any, name: string, layout: any) {
  const s = store;
  const m = schema.model ?? schema;
  const p = emptyProject();
  p.name = name;
  const queries: Query[] = [];
  const tables: ModelTable[] = [];
  const measures: Measure[] = [];
  const hierarchies: Hierarchy[] = [];
  for (const t of m.tables ?? []) {
    if (/^(LocalDateTable_|DateTableTemplate_)/.test(t.name)) continue;
    const part = (t.partitions ?? [])[0];
    const src = part?.source ?? {};
    const calcCols = (t.columns ?? []).filter((c: any) => c.type === 'calculated');
    const meta = (t.columns ?? []).filter((c: any) => c.type !== 'rowNumber').map((c: any) => ({
      name: c.name, dataType: tmslType(c.dataType), formatString: c.formatString, hidden: c.isHidden, summarizeBy: c.summarizeBy ? (c.summarizeBy === 'none' ? 'None' : c.summarizeBy[0].toUpperCase() + c.summarizeBy.slice(1)) : undefined,
      sortByColumn: c.sortByColumn, dataCategory: c.dataCategory, displayFolder: c.displayFolder, description: c.description, expression: c.type === 'calculated' ? joinExpr(c.expression) : undefined,
    }));
    if (src.type === 'calculated') tables.push({ name: t.name, columns: meta.filter((c: any) => c.expression), rows: [], expression: joinExpr(src.expression), hidden: t.isHidden, description: t.description });
    else {
      queries.push({ id: uid('q'), name: t.name, code: joinExpr(src.expression) || 'let\n    Source = ""\nin\n    Source', load: true, refresh: true, description: t.description });
      tables.push({ name: t.name, columns: meta, rows: [], hidden: t.isHidden, description: t.description, storageMode: part?.mode === 'directQuery' ? 'DirectQuery' : part?.mode === 'dual' ? 'Dual' : 'Import' });
    }
    void calcCols;
    if (t.dataCategory === 'Time') { const key = (t.columns ?? []).find((c: any) => c.isKey); if (key) tables[tables.length - 1].dateColumn = key.name; }
    for (const ms of t.measures ?? []) measures.push({ name: ms.name, table: t.name, expression: joinExpr(ms.expression), formatString: ms.formatString, displayFolder: ms.displayFolder, description: ms.description, hidden: ms.isHidden });
    for (const h of t.hierarchies ?? []) hierarchies.push({ name: h.name, table: t.name, levels: (h.levels ?? []).sort((a: any, b: any) => (a.ordinal ?? 0) - (b.ordinal ?? 0)).map((l: any) => l.column) });
  }
  for (const e of m.expressions ?? []) if (e.kind === 'm' || !e.kind) queries.push({ id: uid('q'), name: e.name, code: joinExpr(e.expression), load: false, refresh: true, group: e.queryGroup });
  const keep = new Set(tables.map(t => t.name));
  const rels: Relationship[] = (m.relationships ?? []).filter((r: any) => keep.has(r.fromTable) && keep.has(r.toTable)).map((r: any) => ({
    id: uid('rel'), fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn,
    cardinality: (r.fromCardinality ?? 'many') === 'one' && (r.toCardinality ?? 'one') === 'one' ? 'one-one' : (r.toCardinality === 'many') ? 'many-many' : 'many-one',
    crossFilter: r.crossFilteringBehavior === 'bothDirections' ? 'both' : 'single', active: r.isActive !== false,
  }));
  const roles: Role[] = (m.roles ?? []).map((r: any) => ({ name: r.name, filters: Object.fromEntries((r.tablePermissions ?? []).map((tp: any) => [tp.name, joinExpr(tp.filterExpression)])) }));
  p.queries = queries;
  p.model = { tables, measures, relationships: rels, hierarchies, roles };
  if (layout) p.report = importLayout(layout, p);
  s.loadProject(p);
  clearQueryCache();
  const missing = s.refreshErrors.filter(e => /DataSource|File/.test(e.message));
  s.openDialog({ type: 'message', title: `Imported ${name}`, text: `Imported ${queries.length} queries, ${tables.length} tables, ${measures.length} measures, ${rels.length} relationships, ${roles.length} roles${layout ? ` and ${p.report.pages.length} report pages` : ''}.${missing.length ? `\n\n${missing.length} tables couldn't load because their source files aren't in the sandbox. Upload them with Get data › Text/CSV or Excel (any folder; files are matched by name), or point the queries at Sql.Database("localhost", "ContosoDW"), then select Refresh.` : ''}` });
}

const VT: Record<string, string> = {
  clusteredColumnChart: 'clusteredColumn', columnChart: 'stackedColumn', barChart: 'stackedBar', clusteredBarChart: 'clusteredBar', hundredPercentStackedColumnChart: 'stackedColumn100', hundredPercentStackedBarChart: 'stackedBar100',
  lineChart: 'line', areaChart: 'area', stackedAreaChart: 'stackedArea', lineClusteredColumnComboChart: 'lineClusteredColumn', lineStackedColumnComboChart: 'lineStackedColumn', ribbonChart: 'ribbon', waterfallChart: 'waterfall',
  funnel: 'funnel', scatterChart: 'scatter', pieChart: 'pie', donutChart: 'donut', treemap: 'treemap', map: 'map', filledMap: 'map', gauge: 'gauge', card: 'card', cardVisual: 'cardNew', multiRowCard: 'multiRowCard', kpi: 'kpi',
  slicer: 'slicer', tableEx: 'table', pivotTable: 'matrix', textbox: 'textbox', actionButton: 'button', shape: 'shape', basicShape: 'shape', image: 'image', decompositionTreeVisual: 'decompositionTree', keyDriversVisual: 'keyInfluencers', qnaVisual: 'qna',
};
const ROLE: Record<string, Record<string, string>> = {
  default: { Category: 'axis', Y: 'values', Series: 'legend', Tooltips: 'tooltips', Values: 'values', Rows: 'rows', Columns: 'cols', X: 'x', Size: 'size', Details: 'details', Target: 'target', TargetValue: 'target', MinValue: 'min', MaxValue: 'max', Indicator: 'values', TrendLine: 'axis', Goal: 'target', Breakdown: 'breakdown', Y2: 'lineValues', ColumnY: 'values', LineY: 'lineValues', Analyze: 'values', ExplainBy: 'explain', Fields: 'values', Data: 'values' },
};

function fieldFromSelect(sel: any, aliases: Record<string, string>): FieldRef | null {
  const ent = (src: any) => aliases[src?.SourceRef?.Source] ?? src?.SourceRef?.Entity;
  if (sel.Column) return { table: ent(sel.Column.Expression), column: sel.Column.Property };
  if (sel.Measure) return { table: ent(sel.Measure.Expression), measure: sel.Measure.Property };
  if (sel.Aggregation) {
    const f = fieldFromSelect(sel.Aggregation.Expression, aliases); if (!f) return null;
    const fn = ['Sum', 'Average', 'DistinctCount', 'Min', 'Max', 'Count', 'CountNonBlank', 'Median', 'StdDev', 'Variance'][sel.Aggregation.Function] as any;
    return { ...f, agg: fn ?? 'Sum' };
  }
  if (sel.HierarchyLevel) { const h = sel.HierarchyLevel.Expression?.Hierarchy; const lvl = sel.HierarchyLevel.Level; const tbl = ent(h?.Expression?.PropertyVariationSource?.Expression ?? h?.Expression); const col = h?.Expression?.PropertyVariationSource?.Property; if (col) return { table: tbl, column: col, datePart: ['Year', 'Quarter', 'Month', 'Day'].includes(lvl) ? lvl : undefined }; return { table: tbl, column: lvl }; }
  return null;
}

function importLayout(layout: any, p: Project): Project['report'] {
  const pages: Page[] = [];
  for (const sec of [...(layout.sections ?? [])].sort((a: any, b: any) => (a.ordinal ?? 0) - (b.ordinal ?? 0))) {
    const page: Page = { id: uid('pg'), name: sec.displayName ?? sec.name, visuals: [], filters: [] };
    const sx = 1280 / (sec.width || 1280), sy = 720 / (sec.height || 720);
    for (const vc of sec.visualContainers ?? []) {
      let cfg: any; try { cfg = JSON.parse(vc.config); } catch { continue; }
      const sv = cfg.singleVisual; if (!sv) continue;
      const type = VT[sv.visualType]; if (!type) continue;
      const aliases: Record<string, string> = {};
      for (const f of sv.prototypeQuery?.From ?? []) aliases[f.Name] = f.Entity;
      const byRef: Record<string, FieldRef> = {};
      for (const sel of sv.prototypeQuery?.Select ?? []) { const f = fieldFromSelect(sel, aliases); if (f) byRef[sel.Name] = f; }
      const wells: Record<string, FieldRef[]> = {};
      for (const [role, items] of Object.entries(sv.projections ?? {})) {
        let key = ROLE.default[role] ?? role.toLowerCase();
        if (type === 'table') key = 'columns'; if (type === 'slicer') key = 'field';
        if ((type === 'pie' || type === 'donut' || type === 'treemap' || type === 'funnel') && role === 'Category') key = 'axis';
        if (type === 'scatter' && role === 'Category') key = 'details';
        if (type === 'kpi' && role === 'TrendLine') key = 'axis';
        for (const it of items as any[]) { const f = byRef[it.queryRef]; if (f) (wells[key] ??= []).push(f); }
      }
      const pos = cfg.layouts?.[0]?.position ?? vc;
      const title = sv.vcObjects?.title?.[0]?.properties?.text?.expr?.Literal?.Value;
      page.visuals.push({ id: uid('v'), type, x: Math.round((pos.x ?? vc.x) * sx), y: Math.round((pos.y ?? vc.y) * sy), w: Math.round((pos.width ?? vc.width) * sx), h: Math.round((pos.height ?? vc.height) * sy), z: pos.z, wells, filters: [], format: title ? { title: String(title).replace(/^'|'$/g, '') } : {},
        text: type === 'textbox' ? (sv.objects?.general?.[0]?.properties?.paragraphs ?? []).flatMap((pp: any) => pp.textRuns?.map((r: any) => r.value) ?? []).join('\n') : undefined });
    }
    pages.push(page);
  }
  if (!pages.length) pages.push({ id: uid('pg'), name: 'Page 1', visuals: [], filters: [] });
  void p;
  return { pages, reportFilters: [], bookmarks: [], theme: 'Default' };
}

/** Export the semantic model as TMSL (model.bim), readable by Tabular Editor and .pbip projects. */
export function exportBim() {
  const s = store; const m = s.project.model;
  const dt = (t: DataType) => ({ text: 'string', int: 'int64', decimal: 'double', currency: 'decimal', bool: 'boolean', date: 'dateTime', datetime: 'dateTime', time: 'dateTime' } as Record<string, string>)[t] ?? 'string';
  const split = (x: string) => x.split('\n');
  const bim = {
    name: s.project.name, compatibilityLevel: 1567,
    model: {
      culture: 'en-US', defaultPowerBIDataSourceVersion: 'powerBI_V3',
      tables: m.tables.map(t => ({
        name: t.name, isHidden: t.hidden || undefined, dataCategory: t.dateColumn ? 'Time' : undefined,
        columns: t.columns.map(c => (c.expression ? { type: 'calculated', name: c.name, dataType: dt(c.dataType), expression: c.expression, formatString: c.formatString, isHidden: c.hidden || undefined, summarizeBy: (c.summarizeBy ?? 'None').toLowerCase() } : { name: c.name, dataType: dt(c.dataType), sourceColumn: c.name, formatString: c.formatString, isHidden: c.hidden || undefined, summarizeBy: (c.summarizeBy ?? 'None').toLowerCase(), sortByColumn: c.sortByColumn, dataCategory: c.dataCategory, displayFolder: c.displayFolder, isKey: t.dateColumn === c.name || undefined })),
        partitions: [t.expression ? { name: t.name, mode: 'import', source: { type: 'calculated', expression: t.expression } } : { name: t.name, mode: (t.storageMode ?? 'Import').toLowerCase().replace('directquery', 'directQuery'), source: { type: 'm', expression: split(s.project.queries.find(q => q.name === t.name)?.code ?? '') } }],
        measures: m.measures.filter(x => x.table === t.name).map(x => ({ name: x.name, expression: x.expression, formatString: x.formatString, displayFolder: x.displayFolder, description: x.description })),
        hierarchies: m.hierarchies.filter(h => h.table === t.name).map(h => ({ name: h.name, levels: h.levels.map((l, i) => ({ name: l, ordinal: i, column: l })) })),
      })),
      relationships: m.relationships.map(r => ({ name: r.id, fromTable: r.fromTable, fromColumn: r.fromColumn, toTable: r.toTable, toColumn: r.toColumn, isActive: r.active ? undefined : false, crossFilteringBehavior: r.crossFilter === 'both' ? 'bothDirections' : undefined, fromCardinality: r.cardinality === 'one-one' ? 'one' : undefined, toCardinality: r.cardinality === 'many-many' ? 'many' : undefined })),
      roles: m.roles.map(r => ({ name: r.name, modelPermission: 'read', tablePermissions: Object.entries(r.filters).filter(([, e]) => e.trim()).map(([t, e]) => ({ name: t, filterExpression: e })) })),
      expressions: s.project.queries.filter(q => !q.load).map(q => ({ name: q.name, kind: 'm', expression: split(q.code) })),
    },
  };
  download(`${s.project.name || 'model'}.bim`, JSON.stringify(bim, null, 2), 'application/json');
}

export function exportTableCsv(tableName: string) {
  const t = store.project.model.tables.find(x => x.name === tableName); if (!t) return;
  const esc = (v: any) => { const s0 = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v); return /[",\n]/.test(s0) ? `"${s0.replace(/"/g, '""')}"` : s0; };
  download(`${t.name}.csv`, [t.columns.map(c => esc(c.name)).join(','), ...t.rows.map(r => r.map(esc).join(','))].join('\r\n'), 'text/csv');
}

export { uid };
