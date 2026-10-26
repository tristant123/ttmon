// Central application state. Mutable store + version counter, consumed with useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import { MEngine, Query } from './m/engine';
import { setSourceHost, StoredFile } from './m/sources';
import { DaxEngine, emptyCtx } from './dax/engine';
import './dax/functions';
import { Project, Page, Visual, FieldRef, FilterSpec, Model } from './model/types';
import { refreshModel, recalc, autodetectRelationships } from './model/refresh';
import { MTable } from './core/values';
import { contosoDW } from './data/sample';

export const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 10);

export type View = 'report' | 'table' | 'model' | 'dax';
export interface Dialog { type: string; [k: string]: any }
export interface CrossSel { pageId: string; visualId: string; filters: { field: FieldRef; values: any[] }[] }

export interface PQState {
  queries: Query[];
  selected: string | null;
  step: number | null;          // index of selected applied step (null = last)
  selectedCols: string[];
  dirty: boolean;
  profile: { quality: boolean; distribution: boolean; profile: boolean; whole: boolean };
  formulaBar: boolean;
  showSettings: boolean;
  ribbon: string;
}

export interface UI {
  view: View;
  pageId: string;
  selected: string[];
  ribbon: string;
  pq: PQState | null;
  dialogs: Dialog[];
  tableViewTable: string | null;
  field: { table: string; column?: string; measure?: string } | null;
  formula: { kind: 'measure' | 'column' | 'table' | 'calcitem'; table: string; text: string; editing?: string } | null;
  panes: { filters: boolean; viz: boolean; data: boolean; bookmarks: boolean; selection: boolean; perf: boolean; properties: boolean; sync: boolean };
  vizTab: 'build' | 'format' | 'analytics';
  cross: CrossSel | null;
  viewAs: { roles: string[]; user?: string } | null;
  toast: { text: string; kind?: 'info' | 'error' } | null;
  daxQueries: { id: string; name: string; text: string }[];
  daxActive: string;
  daxResult: { cols: string[]; rows: any[][]; ms: number; error?: string } | null;
  tutorial: { id: string; step: number } | null;
  showTutorials: boolean;
  zoom: number;
  modelLayout: Record<string, { x: number; y: number }>;
  focus: string | null;
  backstage: boolean;
  tooltipHover: null;
  perf: { visual: string; ms: number; at: number }[];
  drillthrough: { from: string; filters: { field: FieldRef; value: any }[] } | null;
  gridlines: boolean;
  snap: boolean;
  editInteractions: boolean;
  clipboard: Visual[] | null;
  painter: Record<string, any> | null;
  mobileLayout?: boolean;
  /** Which app is on screen: Power BI Desktop or the (simulated) Power BI service. */
  app?: 'desktop' | 'service';
  assistant?: boolean;
}

export function emptyProject(): Project {
  const p: Page = { id: uid('pg'), name: 'Page 1', visuals: [], filters: [] };
  return {
    version: 1, name: 'Untitled',
    queries: [],
    model: { tables: [], measures: [], relationships: [], hierarchies: [], roles: [] },
    report: { pages: [p], reportFilters: [], bookmarks: [], theme: 'Default' },
    settings: { autoDateTime: true, autodetectRelationships: true },
  };
}

const LS_KEY = 'pl300-sandbox-project';
const DB_NAME = 'pl300-sandbox';

// ---------- IndexedDB for uploaded files ----------
function idb(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function idbPut(key: string, val: any) {
  const db = await idb(); if (!db) return;
  await new Promise<void>(res => { try { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(val, key); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } });
}
async function idbGet(key: string): Promise<any> {
  const db = await idb(); if (!db) return undefined;
  return new Promise(res => { try { const tx = db.transaction('files', 'readonly'); const r = tx.objectStore('files').get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); } });
}

export class Store {
  version = 0;
  project: Project = emptyProject();
  files: StoredFile[] = [];
  parquet = new Map<StoredFile, MTable>();
  dax: DaxEngine = new DaxEngine(this.project.model);
  engineVersion = 0;
  refreshErrors: { table: string; message: string }[] = [];
  undoStack: string[] = [];
  redoStack: string[] = [];
  listeners = new Set<() => void>();
  saveTimer: any = null;
  ui: UI = {
    view: 'report', pageId: this.project.report.pages[0].id, selected: [], ribbon: 'Home', pq: null, dialogs: [],
    tableViewTable: null, field: null, formula: null,
    panes: { filters: true, viz: true, data: true, bookmarks: false, selection: false, perf: false, properties: true, sync: false },
    vizTab: 'build', cross: null, viewAs: null, toast: null,
    daxQueries: [{ id: 'q1', name: 'Query 1', text: '// Write a DAX query and select Run (Ctrl+Enter)\nEVALUATE\n' }], daxActive: 'q1', daxResult: null,
    tutorial: null, showTutorials: false, zoom: 0, modelLayout: {}, focus: null, backstage: false, tooltipHover: null, perf: [], drillthrough: null, gridlines: false, snap: false, editInteractions: false, clipboard: null, painter: null,
  };

  constructor() {
    setSourceHost({ files: () => this.files, parquet: f => this.parquet.get(f), sql: contosoDW });
  }

  subscribe = (f: () => void) => { this.listeners.add(f); return () => this.listeners.delete(f); };
  emit() { this.version++; for (const f of this.listeners) f(); }
  set(f: (s: this) => void) { f(this); this.emit(); }
  setUI(patch: Partial<UI>) { this.ui = { ...this.ui, ...patch }; this.emit(); }

  // ---------- undo ----------
  snapshot() { return JSON.stringify(stripRows(this.project), replacer); }
  /** Record an undo point, run a project mutation, then persist. */
  change(f: (p: Project) => void, opts: { recalc?: boolean; noUndo?: boolean } = {}) {
    if (!opts.noUndo) { this.undoStack.push(this.snapshot()); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
    f(this.project);
    if (opts.recalc) this.recalcModel();
    else this.rebuildDax();
    this.persistSoon();
    this.emit();
  }
  undo() { this.restore(this.undoStack, this.redoStack); }
  redo() { this.restore(this.redoStack, this.undoStack); }
  restore(from: string[], to: string[]) {
    const s = from.pop(); if (!s) return;
    to.push(this.snapshot());
    const old = this.project;
    const next = JSON.parse(s, reviver) as Project;
    // keep loaded data for query tables
    for (const t of next.model.tables) {
      const o = old.model.tables.find(x => x.name === t.name);
      if (o && !t.expression) {
        t.rows = o.rows.map(r => t.columns.map(c => { const i = o.columns.findIndex(x => x.name === c.name); return i < 0 ? null : r[i]; }));
      } else t.rows = t.rows ?? [];
    }
    this.project = next;
    if (!next.report.pages.some(p => p.id === this.ui.pageId)) this.ui = { ...this.ui, pageId: next.report.pages[0].id };
    this.ui = { ...this.ui, selected: this.ui.selected.filter(id => this.findVisual(id)) };
    this.recalcModel();
    this.persistSoon();
    this.emit();
  }

  // ---------- engines ----------
  rebuildDax() {
    this.dax = new DaxEngine(this.project.model);
    this.applyRls();
    this.engineVersion++;
  }
  recalcModel() {
    const errs = recalc(this.project.model);
    this.refreshErrors = errs;
    this.rebuildDax();
    return errs;
  }
  applyRls() {
    const va = this.ui.viewAs;
    this.dax.rls = null;
    if (!va || !va.roles.length) return;
    if (va.user) this.dax.userName = va.user;
    const map = new Map<string, Set<number>>();
    const roles = this.project.model.roles.filter(r => va.roles.includes(r.name));
    for (const role of roles) {
      for (const [t, expr] of Object.entries(role.filters)) {
        if (!expr.trim()) continue;
        try {
          const tab = this.dax.table(t);
          const node = this.dax.parse(expr);
          const base = this.dax.baseTable(tab.name, emptyCtx());
          const set = map.get(tab.name) ?? new Set<number>();
          // multiple roles are unioned per table
          tab.rows.forEach((_r, i) => { if (this.dax.scalar(node, { ...emptyCtx(), rows: [{ vt: base, i }] }) === true) set.add(i); });
          map.set(tab.name, set);
        } catch (e) { this.toast(`Role '${role.name}' on ${t}: ${(e as Error).message}`, 'error'); }
      }
    }
    // a role that doesn't filter a table leaves it unrestricted only if no other role filters it
    this.dax.rls = map;
  }

  privacyConfig() { return { levels: this.project.dataSources ?? {}, ignore: !!this.project.settings.ignorePrivacy }; }
  queryEngine(queries = this.project.queries) { return new MEngine(queries, this.privacyConfig()); }

  /** Refresh: run Power Query and reload every table. */
  refresh(opts: { autodetect?: boolean; only?: string[] } = {}) {
    const m = this.queryEngine();
    const res = refreshModel(this.project, m, opts.only);
    if ((opts.autodetect ?? this.project.settings.autodetectRelationships) && res.loaded.length) {
      const rels = autodetectRelationships(this.project.model);
      this.project.model.relationships.push(...rels.filter(r => res.loaded.includes(r.fromTable) || res.loaded.includes(r.toTable)));
    }
    this.refreshErrors = res.errors;
    this.rebuildDax();
    this.persistSoon();
    this.emit();
    return res;
  }

  // ---------- files ----------
  async addFiles(files: StoredFile[]) {
    for (const f of files) {
      const i = this.files.findIndex(x => x.name.toLowerCase() === f.name.toLowerCase() && x.folder.toLowerCase() === f.folder.toLowerCase());
      if (i >= 0) this.files[i] = f; else this.files.push(f);
      if (/\.parquet$/i.test(f.name)) {
        try { this.parquet.set(f, await decodeParquet(f.bytes)); } catch (e) { this.toast(`Couldn't read ${f.name}: ${(e as Error).message}`, 'error'); }
      }
    }
    await this.persistFiles();
    this.emit();
  }
  async persistFiles() {
    await idbPut('files', this.files.map(f => ({ ...f, bytes: f.bytes })));
  }

  // ---------- persistence ----------
  persistSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, this.snapshot()); } catch { /* storage unavailable */ }
    }, 400);
  }
  async load(): Promise<boolean> {
    let saved: string | null = null;
    try { saved = localStorage.getItem(LS_KEY); } catch { /* ignore */ }
    const files = (await idbGet('files')) as StoredFile[] | undefined;
    if (files) { this.files = files.map(f => ({ ...f, bytes: new Uint8Array(f.bytes) })); for (const f of this.files) if (/\.parquet$/i.test(f.name)) { try { this.parquet.set(f, await decodeParquet(f.bytes)); } catch { /* ignore */ } } }
    if (!saved) return false;
    try {
      this.project = JSON.parse(saved, reviver);
      for (const t of this.project.model.tables) t.rows = t.rows ?? [];
      this.ui = { ...this.ui, pageId: this.project.report.pages[0].id };
      this.refresh({ autodetect: false });
      return true;
    } catch { return false; }
  }
  newProject() {
    this.project = emptyProject();
    this.undoStack = []; this.redoStack = [];
    this.ui = { ...this.ui, pageId: this.project.report.pages[0].id, selected: [], pq: null, cross: null, viewAs: null, view: 'report', tableViewTable: null, field: null, formula: null };
    this.rebuildDax();
    this.persistSoon();
    this.emit();
  }
  loadProject(p: Project, files?: StoredFile[]) {
    this.project = p;
    for (const t of p.model.tables) t.rows = t.rows ?? [];
    if (files) this.files = files;
    this.undoStack = []; this.redoStack = [];
    this.ui = { ...this.ui, pageId: p.report.pages[0].id, selected: [], pq: null, cross: null, viewAs: null, tableViewTable: null, field: null, formula: null };
    this.refresh({ autodetect: false });
    void this.persistFiles();
  }

  // ---------- helpers ----------
  toast(text: string, kind: 'info' | 'error' = 'info') {
    this.ui = { ...this.ui, toast: { text, kind } }; this.emit();
    const t = this.ui.toast;
    setTimeout(() => { if (this.ui.toast === t) this.setUI({ toast: null }); }, kind === 'error' ? 7000 : 3500);
  }
  page(): Page { return this.project.report.pages.find(p => p.id === this.ui.pageId) ?? this.project.report.pages[0]; }
  findVisual(id: string): Visual | undefined { for (const p of this.project.report.pages) { const v = p.visuals.find(x => x.id === id); if (v) return v; } return undefined; }
  selectedVisual(): Visual | undefined { return this.ui.selected.length === 1 ? this.findVisual(this.ui.selected[0]) : undefined; }
  openDialog(d: Dialog) { this.setUI({ dialogs: [...this.ui.dialogs, d] }); }
  closeDialog() { this.setUI({ dialogs: this.ui.dialogs.slice(0, -1) }); }
  model(): Model { return this.project.model; }

  updateVisual(id: string, f: (v: Visual) => void, undo = true) {
    this.change(p => { for (const pg of p.report.pages) { const v = pg.visuals.find(x => x.id === id); if (v) f(v); } }, { noUndo: !undo });
  }

  allFilters(page: Page): FilterSpec[] { return [...this.project.report.reportFilters, ...page.filters]; }
}

export function stripRows(p: Project): Project {
  return { ...p, model: { ...p.model, tables: p.model.tables.map(t => ({ ...t, rows: [] as any[][] })) } };
}

// Dates survive JSON round trips as ISO strings tagged with a prefix
export function replacer(this: any, k: string, v: any) {
  const raw = this[k];
  if (raw instanceof Date) return { __d: raw.getTime() };
  return v;
}
export function reviver(_k: string, v: any) {
  if (v && typeof v === 'object' && '__d' in v && Object.keys(v).length === 1) return new Date(v.__d);
  return v;
}

export async function decodeParquet(bytes: Uint8Array): Promise<MTable> {
  const { parquetReadObjects, parquetMetadataAsync, parquetSchema } = await import('hyparquet');
  const file = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const meta = await parquetMetadataAsync(file);
  const schema = parquetSchema(meta);
  const rows: any[] = await parquetReadObjects({ file, metadata: meta });
  const cols = schema.children.map((c: any) => c.element.name as string);
  const typeOf = (c: any): any => {
    const el = c.element; const ct = el.converted_type; const lt = el.logical_type?.type;
    if (lt === 'DATE' || ct === 'DATE') return 'date';
    if (lt === 'TIMESTAMP' || ct === 'TIMESTAMP_MILLIS' || ct === 'TIMESTAMP_MICROS') return 'datetime';
    if (lt === 'STRING' || ct === 'UTF8') return 'text';
    if (el.type === 'BOOLEAN') return 'bool';
    if (el.type === 'INT32' || el.type === 'INT64') return lt === 'DECIMAL' || ct === 'DECIMAL' ? 'decimal' : 'int';
    if (el.type === 'FLOAT' || el.type === 'DOUBLE') return 'decimal';
    if (el.type === 'BYTE_ARRAY') return 'text';
    return 'any';
  };
  const types = schema.children.map(typeOf);
  return new MTable(cols.map((name: string, i: number) => ({ name, type: types[i] })), rows.map(r => cols.map((c: string, i: number) => {
    let v = r[c];
    if (typeof v === 'bigint') v = Number(v);
    if (v instanceof Date && types[i] === 'date') v = new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
    if (v instanceof Uint8Array) v = new TextDecoder().decode(v);
    return v ?? null;
  })));
}

export const store = new Store();
// make it reachable from the console for debugging
(globalThis as any).__pbi = store;

export function useStore() {
  useSyncExternalStore(store.subscribe, () => store.version);
  return store;
}
