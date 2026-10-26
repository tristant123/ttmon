// Datasets and starting projects for the tutorials.
import { store, emptyProject, uid } from '../store';
import { Project, Visual, Relationship, Measure } from '../model/types';
import { sampleFiles } from '../data/sample';
import { clearQueryCache } from '../ui/report/vhelpers';
import { ROOT_FOLDER } from '../m/sources';
import { refreshModel, recalc } from '../model/refresh';
import { MEngine } from '../m/engine';

export const F = (name: string) => `${ROOT_FOLDER}\\${name}`;

export interface ScenarioQuery { name: string; code: string; load?: boolean; group?: string; storageMode?: 'Import' | 'DirectQuery' | 'DirectLake' }
export interface Scenario {
  queries: ScenarioQuery[];
  measures?: Omit<Measure, 'table'> & { table: string }[] | Measure[];
  relationships?: Omit<Relationship, 'id'>[];
  calcTables?: { name: string; expression: string; dateColumn?: string }[];
  calcColumns?: { table: string; name: string; expression: string }[];
  sortBy?: { table: string; column: string; by: string }[];
  formats?: { table: string; column: string; format: string }[];
  visuals?: Partial<Visual>[];
  pages?: { name: string; visuals: Partial<Visual>[] }[];
  roles?: Project['model']['roles'];
  hide?: { table: string; column: string }[];
  autodetect?: boolean;
  files?: boolean;
  openPQ?: string;
  view?: 'report' | 'table' | 'model' | 'dax';
  autoDateTime?: boolean;
  /** Leave privacy levels unset (the privacy lab). */
  privacyUnset?: boolean;
  /** Extra model settings applied after load. */
  model?: Partial<Project['model']>;
  tableModes?: Record<string, 'Import' | 'DirectQuery' | 'Dual' | 'DirectLake'>;
}

import { directSources, paramValues } from '../m/privacy';

/** Build a project (with its data) from a scenario without loading it into Desktop; used to seed the service. */
export function scenarioProject(name: string, sc: Scenario): Project {
  const p = emptyProject();
  p.name = name;
  p.settings.autoDateTime = sc.autoDateTime ?? true;
  p.settings.autodetectRelationships = false;
  p.queries = sc.queries.map(q => ({ id: uid('q'), name: q.name, code: q.code, load: q.load ?? true, refresh: true, group: q.group, storageMode: q.storageMode }));
  p.dataSources = {}; const params = paramValues(p.queries); for (const q of p.queries) for (const src of directSources(q.code, params)) p.dataSources[src.key] = { privacy: 'Organizational' };
  refreshModel(p, new MEngine(p.queries));
  const m = p.model;
  for (const ct of sc.calcTables ?? []) m.tables.push({ name: ct.name, columns: [], rows: [], expression: ct.expression, dateColumn: ct.dateColumn });
  for (const cc of sc.calcColumns ?? []) { const t = m.tables.find(x => x.name === cc.table); if (t) { t.columns.push({ name: cc.name, dataType: 'any', expression: cc.expression, summarizeBy: 'None' }); t.rows.forEach(r => r.push(null)); } }
  m.measures.push(...((sc.measures ?? []) as Measure[]));
  m.relationships.push(...(sc.relationships ?? []).map(r => ({ ...r, id: uid('rel') })));
  m.roles.push(...(sc.roles ?? []));
  if (sc.model) Object.assign(m, sc.model);
  recalc(m);
  for (const sb of sc.sortBy ?? []) { const c = m.tables.find(t => t.name === sb.table)?.columns.find(x => x.name === sb.column); if (c) c.sortByColumn = sb.by; }
  for (const f of sc.formats ?? []) { const c = m.tables.find(t => t.name === f.table)?.columns.find(x => x.name === f.column); if (c) c.formatString = f.format; }
  for (const h of sc.hide ?? []) { const c = m.tables.find(t => t.name === h.table)?.columns.find(x => x.name === h.column); if (c) c.hidden = true; }
  const mk = (v: Partial<Visual>): Visual => ({ id: uid('v'), type: 'clusteredColumn', x: 20, y: 20, w: 400, h: 260, wells: {}, filters: [], format: {}, ...v });
  if (sc.pages) p.report.pages = sc.pages.map(pg => ({ id: uid('pg'), name: pg.name, visuals: pg.visuals.map(mk), filters: [] }));
  else if (sc.visuals) p.report.pages[0].visuals = sc.visuals.map(mk);
  return p;
}

/** Build a fresh project from a scenario and load it. */

export async function loadScenario(name: string, sc: Scenario) {
  const s = store;
  if (sc.files !== false) await s.addFiles(sampleFiles());
  const p = emptyProject();
  p.name = name;
  p.settings.autoDateTime = sc.autoDateTime ?? true;
  p.settings.autodetectRelationships = !!sc.autodetect;
  p.queries = sc.queries.map(q => ({ id: uid('q'), name: q.name, code: q.code, load: q.load ?? true, refresh: true, group: q.group, storageMode: q.storageMode }));
  // labs start with their sample sources set to Organizational so combining them doesn't prompt (the privacy lab clears this)
  if (!sc.privacyUnset) { p.dataSources = {}; const params = paramValues(p.queries); for (const q of p.queries) for (const src of directSources(q.code, params)) p.dataSources[src.key] = { privacy: 'Organizational' }; }
  s.loadProject(p);
  const m = s.project.model;
  for (const ct of sc.calcTables ?? []) m.tables.push({ name: ct.name, columns: [], rows: [], expression: ct.expression, dateColumn: ct.dateColumn });
  for (const cc of sc.calcColumns ?? []) { const t = m.tables.find(x => x.name === cc.table); if (t) { t.columns.push({ name: cc.name, dataType: 'any', expression: cc.expression, summarizeBy: 'None' }); t.rows.forEach(r => r.push(null)); } }
  m.measures.push(...((sc.measures ?? []) as Measure[]));
  m.relationships.push(...(sc.relationships ?? []).map(r => ({ ...r, id: uid('rel') })));
  m.roles.push(...(sc.roles ?? []));
  if (sc.model) Object.assign(m, sc.model);
  for (const [t, mode] of Object.entries(sc.tableModes ?? {})) { const tt = m.tables.find(x => x.name === t); if (tt) tt.storageMode = mode; }
  s.recalcModel();
  for (const sb of sc.sortBy ?? []) { const c = m.tables.find(t => t.name === sb.table)?.columns.find(x => x.name === sb.column); if (c) c.sortByColumn = sb.by; }
  for (const f of sc.formats ?? []) { const c = m.tables.find(t => t.name === f.table)?.columns.find(x => x.name === f.column); if (c) c.formatString = f.format; }
  for (const h of sc.hide ?? []) { const c = m.tables.find(t => t.name === h.table)?.columns.find(x => x.name === h.column); if (c) c.hidden = true; }
  for (const t of m.tables) for (const c of t.columns) if (c.expression && ['int', 'decimal', 'currency'].includes(c.dataType) && !/key|id|year|number/i.test(c.name)) c.summarizeBy = 'Sum';
  const mk = (v: Partial<Visual>): Visual => ({ id: uid('v'), type: 'clusteredColumn', x: 20, y: 20, w: 400, h: 260, wells: {}, filters: [], format: {}, ...v });
  if (sc.pages) s.project.report.pages = sc.pages.map(pg => ({ id: uid('pg'), name: pg.name, visuals: pg.visuals.map(mk), filters: [] }));
  else if (sc.visuals) s.project.report.pages[0].visuals = sc.visuals.map(mk);
  s.undoStack = []; s.redoStack = [];
  s.ui = { ...s.ui, pageId: s.project.report.pages[0].id, view: sc.view ?? 'report', selected: [], cross: null, viewAs: null, formula: null, field: null, tableViewTable: null, modelLayout: {} };
  s.rebuildDax();
  clearQueryCache();
  s.persistSoon();
  s.emit();
  if (sc.openPQ) { const { openPowerQuery } = await import('../ui/actions'); openPowerQuery(sc.openPQ); }
}

// ---------- reusable M ----------
export const M = {
  salesClean: `let
    Source = Csv.Document(File.Contents("${F('Sales.csv')}"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"SalesOrderNumber", type text}, {"SalesOrderLineNumber", Int64.Type}, {"OrderDate", type date}, {"ShipDate", type date}, {"CustomerKey", Int64.Type}, {"ProductKey", Int64.Type}, {"StoreKey", Int64.Type}, {"OrderQuantity", Int64.Type}, {"UnitPrice", Currency.Type}, {"DiscountPct", type number}}),
    #"Removed Duplicates" = Table.Distinct(#"Changed Type"),
    #"Removed Errors" = Table.RemoveRowsWithErrors(#"Removed Duplicates", {"UnitPrice"}),
    #"Replaced Value" = Table.ReplaceValue(#"Removed Errors",null,1,Replacer.ReplaceValue,{"OrderQuantity"}),
    #"Added Sales Amount" = Table.AddColumn(#"Replaced Value", "SalesAmount", each [OrderQuantity] * [UnitPrice] * (1 - [DiscountPct]), Currency.Type)
in
    #"Added Sales Amount"`,
  salesRaw: `let
    Source = Csv.Document(File.Contents("${F('Sales.csv')}"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"SalesOrderNumber", type text}, {"SalesOrderLineNumber", Int64.Type}, {"OrderDate", type date}, {"ShipDate", type date}, {"CustomerKey", Int64.Type}, {"ProductKey", Int64.Type}, {"StoreKey", Int64.Type}, {"OrderQuantity", Int64.Type}, {"UnitPrice", Currency.Type}, {"DiscountPct", type number}})
in
    #"Changed Type"`,
  productClean: `let
    Source = Excel.Workbook(File.Contents("${F('Products.xlsx')}"), null, true),
    Products_Sheet = Source{[Item="Products",Kind="Sheet"]}[Data],
    #"Removed Top Rows" = Table.Skip(Products_Sheet,3),
    #"Promoted Headers" = Table.PromoteHeaders(#"Removed Top Rows", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"ProductKey", Int64.Type}, {"Product Name", type text}, {"Category", type text}, {"Subcategory", type text}, {"Color", type text}, {"Standard Cost", Currency.Type}, {"List Price", Currency.Type}}),
    #"Trimmed Text" = Table.TransformColumns(#"Changed Type",{{"Product Name", Text.Trim, type text}}),
    #"Capitalized Each Word" = Table.TransformColumns(#"Trimmed Text",{{"Product Name", Text.Proper, type text}})
in
    #"Capitalized Each Word"`,
  productRaw: `let
    Source = Excel.Workbook(File.Contents("${F('Products.xlsx')}"), null, true),
    Products_Sheet = Source{[Item="Products",Kind="Sheet"]}[Data]
in
    Products_Sheet`,
  customer: `let
    Source = Json.Document(File.Contents("${F('Customers.json')}")),
    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"CustomerKey", "FirstName", "LastName", "EmailAddress", "BirthDate", "Segment", "Address"}, {"CustomerKey", "FirstName", "LastName", "EmailAddress", "BirthDate", "Segment", "Address"}),
    #"Expanded Address" = Table.ExpandRecordColumn(#"Expanded Column1", "Address", {"City", "StateProvince", "Country", "Region"}, {"City", "StateProvince", "Country", "Region"}),
    #"Changed Type" = Table.TransformColumnTypes(#"Expanded Address",{{"CustomerKey", Int64.Type}, {"FirstName", type text}, {"LastName", type text}, {"EmailAddress", type text}, {"BirthDate", type date}, {"Segment", type text}, {"City", type text}, {"StateProvince", type text}, {"Country", type text}, {"Region", type text}}),
    #"Inserted Merged Column" = Table.AddColumn(#"Changed Type", "Customer Name", each Text.Combine({[FirstName], [LastName]}, " "), type text)
in
    #"Inserted Merged Column"`,
  store: `let
    Source = Xml.Tables(File.Contents("${F('Stores.xml')}")),
    Store = Source{[Name="Store"]}[Table],
    #"Changed Type" = Table.TransformColumnTypes(Store,{{"StoreKey", Int64.Type}, {"StoreName", type text}, {"Region", type text}, {"City", type text}, {"Manager", type text}, {"ManagerEmail", type text}})
in
    #"Changed Type"`,
};

export const DATE_TABLE = `ADDCOLUMNS(
    CALENDAR(DATE(2023, 1, 1), DATE(2025, 12, 31)),
    "Year", YEAR([Date]),
    "Quarter", "Qtr " & QUARTER([Date]),
    "Month Number", MONTH([Date]),
    "Month", FORMAT([Date], "mmm"),
    "Year Month", FORMAT([Date], "yyyy-mm"),
    "Weekday", FORMAT([Date], "ddd"),
    "Weekday Number", WEEKDAY([Date], 2)
)`;

export const STAR_RELS: Omit<Relationship, 'id'>[] = [
  { fromTable: 'Sales', fromColumn: 'ProductKey', toTable: 'Product', toColumn: 'ProductKey', cardinality: 'many-one', crossFilter: 'single', active: true },
  { fromTable: 'Sales', fromColumn: 'CustomerKey', toTable: 'Customer', toColumn: 'CustomerKey', cardinality: 'many-one', crossFilter: 'single', active: true },
  { fromTable: 'Sales', fromColumn: 'StoreKey', toTable: 'Store', toColumn: 'StoreKey', cardinality: 'many-one', crossFilter: 'single', active: true },
  { fromTable: 'Sales', fromColumn: 'OrderDate', toTable: 'Date', toColumn: 'Date', cardinality: 'many-one', crossFilter: 'single', active: true },
  { fromTable: 'Sales', fromColumn: 'ShipDate', toTable: 'Date', toColumn: 'Date', cardinality: 'many-one', crossFilter: 'single', active: false },
];

export const STAR_MEASURES: Measure[] = [
  { name: 'Total Sales', table: 'Sales', expression: 'SUM(Sales[SalesAmount])', formatString: '\\$#,0;(\\$#,0);\\$#,0' },
  { name: 'Total Quantity', table: 'Sales', expression: 'SUM(Sales[OrderQuantity])', formatString: '#,0' },
  { name: 'Order Count', table: 'Sales', expression: 'DISTINCTCOUNT(Sales[SalesOrderNumber])', formatString: '#,0' },
  { name: 'Total Cost', table: 'Sales', expression: 'SUMX(Sales, Sales[OrderQuantity] * RELATED(Product[Standard Cost]))', formatString: '\\$#,0;(\\$#,0);\\$#,0' },
  { name: 'Profit', table: 'Sales', expression: '[Total Sales] - [Total Cost]', formatString: '\\$#,0;(\\$#,0);\\$#,0' },
  { name: 'Margin %', table: 'Sales', expression: 'DIVIDE([Profit], [Total Sales])', formatString: '0.0%' },
];

export function starScenario(extra: Partial<Scenario> = {}): Scenario {
  return {
    queries: [{ name: 'Sales', code: M.salesClean }, { name: 'Product', code: M.productClean }, { name: 'Customer', code: M.customer }, { name: 'Store', code: M.store }],
    calcTables: [{ name: 'Date', expression: DATE_TABLE, dateColumn: 'Date' }],
    relationships: STAR_RELS,
    measures: STAR_MEASURES,
    sortBy: [{ table: 'Date', column: 'Month', by: 'Month Number' }, { table: 'Date', column: 'Weekday', by: 'Weekday Number' }],
    formats: [{ table: 'Date', column: 'Date', format: 'm/d/yyyy' }],
    hide: [{ table: 'Sales', column: 'ProductKey' }, { table: 'Sales', column: 'CustomerKey' }, { table: 'Sales', column: 'StoreKey' }],
    ...extra,
  };
}

export const OVERVIEW_PAGES: Scenario['pages'] = [{ name: 'Overview', visuals: [
      { type: 'card', x: 20, y: 16, w: 230, h: 110, wells: { values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'card', x: 262, y: 16, w: 230, h: 110, wells: { values: [{ table: 'Sales', measure: 'Profit' }] } },
      { type: 'card', x: 504, y: 16, w: 230, h: 110, wells: { values: [{ table: 'Sales', measure: 'Margin %' }] } },
      { type: 'card', x: 746, y: 16, w: 230, h: 110, wells: { values: [{ table: 'Sales', measure: 'Order Count' }] } },
      { type: 'slicer', x: 990, y: 16, w: 270, h: 250, wells: { field: [{ table: 'Store', column: 'Region' }] } },
      { type: 'clusteredColumn', x: 20, y: 140, w: 470, h: 280, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'line', x: 502, y: 140, w: 474, h: 280, wells: { axis: [{ table: 'Date', column: 'Year Month' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'matrix', x: 20, y: 432, w: 620, h: 270, wells: { rows: [{ table: 'Product', column: 'Category' }, { table: 'Product', column: 'Subcategory' }], cols: [{ table: 'Date', column: 'Year' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'donut', x: 652, y: 432, w: 324, h: 270, wells: { axis: [{ table: 'Customer', column: 'Segment' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'table', x: 990, y: 280, w: 270, h: 422, wells: { columns: [{ table: 'Store', column: 'StoreName' }, { table: 'Sales', measure: 'Total Sales' }, { table: 'Sales', measure: 'Margin %' }] } },
    ] }];

/** Sample data › "Load a ready-made star schema". */
export function quickModel() {
  void loadScenario('Contoso Sales', starScenario({ pages: OVERVIEW_PAGES }));
}

// small inline tables, so tutorials don't depend on files
export const T = (cols: [string, string][], rows: any[][]) =>
  `let\n    Source = #table(type table [${cols.map(([n, t]) => `${/^[A-Za-z_]\w*$/.test(n) ? n : `#"${n}"`} = ${t}`).join(', ')}], {\n        ${rows.map(r => `{${r.map(v => (v === null ? 'null' : typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v instanceof Date ? `#date(${v.getFullYear()}, ${v.getMonth() + 1}, ${v.getDate()})` : String(v))).join(', ')}}`).join(',\n        ')}\n    })\nin\n    Source`;
