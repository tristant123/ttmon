import type { DataType } from '../core/values';
import type { Query } from '../m/engine';

export type Summarize = 'Sum' | 'Average' | 'Min' | 'Max' | 'Count' | 'DistinctCount' | 'None';
export type DataCategory = 'Uncategorized' | 'Address' | 'City' | 'Continent' | 'Country' | 'County' | 'Latitude' | 'Longitude' | 'Place' | 'Postal code' | 'State or Province' | 'Web URL' | 'Image URL' | 'Barcode';

export interface ColumnMeta {
  name: string;
  dataType: DataType;            // model types: text int decimal currency bool date datetime time
  formatString?: string;
  dataCategory?: DataCategory;
  summarizeBy?: Summarize;
  sortByColumn?: string;
  hidden?: boolean;
  displayFolder?: string;
  description?: string;
  expression?: string;           // calculated column DAX
  isKey?: boolean;
}

export interface ModelTable {
  name: string;
  columns: ColumnMeta[];
  rows: any[][];                 // runtime data, not persisted for query tables
  expression?: string;           // calculated table DAX
  hidden?: boolean;
  dateColumn?: string;           // "Mark as date table"
  description?: string;
  storageMode?: StorageMode;
  loadErrors?: number;
  calculationGroup?: { precedence: number; items: CalcItem[] };
  /** Field parameter table (Modeling › New parameter › Fields). */
  fieldParameter?: boolean;
  /** Name of the data source the table comes from (for DirectQuery / Direct Lake behaviour). */
  source?: string;
}

export type StorageMode = 'Import' | 'DirectQuery' | 'Dual' | 'DirectLake';

export interface CalcItem { name: string; expression: string; ordinal?: number; formatStringExpression?: string; description?: string }

export interface Measure {
  name: string;
  table: string;                 // home table
  expression: string;
  formatString?: string;
  displayFolder?: string;
  description?: string;
  hidden?: boolean;
}

export type Cardinality = 'many-one' | 'one-one' | 'many-many';

export interface Relationship {
  id: string;
  fromTable: string;   // the "many" side (or either side for 1:1 / *:*)
  fromColumn: string;
  toTable: string;     // the "one" side
  toColumn: string;
  cardinality: Cardinality;
  crossFilter: 'single' | 'both';  // single = filters flow from toTable to fromTable
  active: boolean;
}

export interface Hierarchy { name: string; table: string; levels: string[]; hidden?: boolean }

export interface Role { name: string; filters: Record<string, string>; members?: string[] }

export interface Model {
  tables: ModelTable[];
  measures: Measure[];
  relationships: Relationship[];
  hierarchies: Hierarchy[];
  roles: Role[];
  discourageImplicitMeasures?: boolean;
}

// ---------- report ----------

export type DatePart = 'Year' | 'Quarter' | 'Month' | 'Day';

export interface FieldRef {
  table: string;
  column?: string;               // column field
  measure?: string;              // measure field
  hierarchy?: string;            // user hierarchy
  datePart?: DatePart;           // a level of the automatic date hierarchy
  agg?: Summarize | 'StdDev' | 'Variance' | 'Median' | 'CountNonBlank' | 'First' | 'Last';
  alias?: string;                // "Rename for this visual"
  showAs?: 'none' | 'pctGrandTotal' | 'pctColumnTotal' | 'pctRowTotal' | 'pctParent';
  showItemsNoData?: boolean;
  /** A visual calculation (lives in the visual): its name, DAX over the visual matrix, and format. */
  visualCalc?: string;
  calcExpr?: string;
  calcFormat?: string;
  /** Hidden on the visual (still usable by visual calculations). */
  hiddenInVisual?: boolean;
}

export type FilterSpec =
  | { id: string; field: FieldRef; type: 'basic'; values: any[]; invert?: boolean; requireSingle?: boolean; locked?: boolean; hidden?: boolean }
  | { id: string; field: FieldRef; type: 'advanced'; logic: 'and' | 'or'; conds: { op: string; value: any }[]; locked?: boolean; hidden?: boolean }
  | { id: string; field: FieldRef; type: 'topn'; dir: 'top' | 'bottom'; n: number; by: FieldRef; locked?: boolean; hidden?: boolean }
  | { id: string; field: FieldRef; type: 'relative'; unit: 'days' | 'weeks' | 'months' | 'years'; mode: 'last' | 'this' | 'next'; n: number; locked?: boolean; hidden?: boolean }
  | { id: string; field: FieldRef; type: 'none'; locked?: boolean; hidden?: boolean };

export interface Visual {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  z?: number;
  wells: Record<string, FieldRef[]>;
  filters: FilterSpec[];
  format: Record<string, any>;
  drill?: { level: number; path: any[]; expandAll?: boolean };  // drill state for hierarchies on the axis/rows
  sort?: { by: string; desc: boolean };
  hidden?: boolean;
  title?: string;
  // slicer state
  slicer?: { values: any[]; range?: [any, any]; search?: string };
  text?: string;                  // text box / button text
  action?: { type: 'bookmark' | 'page' | 'back' | 'drillthrough'; target?: string };
  /** Sync slicers: slicers with the same group share their selection (unless syncOff). */
  syncGroup?: string;
  syncOff?: boolean;
  /** Visual calculations (stored in the visual, not the model). */
  visualCalcs?: { name: string; expression: string; format?: string; hidden?: boolean }[];
  altText?: string;
  tabOrder?: number;
}

export interface Page {
  id: string;
  name: string;
  visuals: Visual[];
  filters: FilterSpec[];
  hidden?: boolean;
  drillthrough?: FieldRef[];
  isTooltip?: boolean;
  interactions?: Record<string, 'filter' | 'highlight' | 'none'>;  // `${sourceId}>${targetId}`
  background?: string;
  size?: '16:9' | '4:3' | 'Letter' | 'Tooltip' | 'Custom';
  width?: number; height?: number;
  /** Fields that make this tooltip page appear automatically (Tooltip fields well). */
  tooltipFields?: FieldRef[];
  /** Automatic page refresh (DirectQuery). */
  refresh?: { on: boolean; type: 'fixed' | 'change'; seconds: number; measure?: string };
  /** Mobile layout: positions of visuals on the phone canvas. */
  mobile?: Record<string, { x: number; y: number; w: number; h: number }>;
}

export interface Bookmark {
  id: string;
  name: string;
  pageId: string;
  state: { pageFilters: FilterSpec[]; visuals: Record<string, { hidden?: boolean; slicer?: Visual['slicer']; filters: FilterSpec[]; drill?: Visual['drill'] }> };
  data: boolean; display: boolean; currentPage: boolean;
}

export interface Report {
  pages: Page[];
  reportFilters: FilterSpec[];
  bookmarks: Bookmark[];
  theme: string;
  /** File › Options › Report settings. */
  settings?: { personalize?: boolean; exportData?: 'none' | 'summarized' | 'underlying'; visualHeaders?: boolean; persistentFilters?: boolean };
  /** Microsoft Purview sensitivity label applied in Desktop. */
  sensitivity?: string;
}

export interface StoredFileMeta { name: string; folder: string; size: number; modified: number }

export interface Project {
  version: 1;
  name: string;
  queries: Query[];
  model: Model;
  report: Report;
  settings: { autoDateTime: boolean; autodetectRelationships: boolean; ignorePrivacy?: boolean };
  /** Data source settings: privacy level and credentials per source key (see m/privacy.ts). */
  dataSources?: Record<string, import('../m/privacy').SourceSettings>;
}
