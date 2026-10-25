// DAX evaluation engine: filter context, row context, context transition,
// relationship filter propagation (single/both, active/inactive), expanded tables.
import { DNode, DaxParser, walk } from './parser';
import { Model, ModelTable, Relationship, Measure, DatePart } from '../model/types';
import { keyOf, tupleKey, compareValues, isBlank, MTime, dateOnly } from '../core/values';

export class DaxError extends Error {}
export const derr = (m: string): never => { throw new DaxError(m); };

export interface VCol { name: string; t?: string; c?: string; part?: DatePart }
export class VTable {
  constructor(public cols: VCol[], public rows: any[][], public base?: string, public rowIdx?: number[]) {}
  colIndex(t: string | undefined, c: string): number {
    const lc = c.toLowerCase(), lt = t?.toLowerCase();
    let i = this.cols.findIndex(x => x.c?.toLowerCase() === lc && (!lt || x.t?.toLowerCase() === lt) && !x.part);
    if (i < 0 && !lt) i = this.cols.findIndex(x => x.name.toLowerCase() === lc);
    if (i < 0 && lt) i = this.cols.findIndex(x => x.name.toLowerCase() === `${lt}[${lc}]` || (x.name.toLowerCase() === lc && !x.t));
    return i;
  }
}

export interface ColRef { t: string; c: string }
export type Filter =
  | { kind: 'cols'; cols: ColRef[]; tuples: any[][]; keys: Set<string>; proj?: Map<string, { idx: number[]; keys: Set<string> }> }
  | { kind: 'rows'; t: string; rows: Set<number>; expanded: boolean; blocked?: Set<string>; exp?: Map<string, Set<number>> };

export interface RowCtx { vt: VTable; i: number }
export interface Ctx {
  filters: Filter[];
  rows: RowCtx[];
  vars: Map<string, any> | null;
  userel: string[];
  cross: Record<string, 'none' | 'both' | 'one'>;
  selected: Filter[] | null;
  scope: Set<string> | null;
  cache: Map<string, any>;
}

export function emptyCtx(): Ctx {
  return { filters: [], rows: [], vars: null, userel: [], cross: {}, selected: null, scope: null, cache: new Map() };
}
function derive(ctx: Ctx, patch: Partial<Ctx>): Ctx {
  return { ...ctx, ...patch, cache: patch.filters || patch.userel || patch.cross ? new Map() : ctx.cache };
}

const range = (n: number) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = i; return a; };

export class DaxEngine {
  tables = new Map<string, ModelTable>();
  measures = new Map<string, Measure>();
  parsed = new Map<string, DNode>();
  colKeysCache = new Map<string, string[]>();
  relIndex = new Map<string, Map<string, number>>();
  expandedCache = new Map<string, string[]>();
  measureStack: string[] = [];
  rls: Map<string, Set<number>> | null = null;
  userName = 'student@contoso.com';
  depth = 0;
  extraMeasures = new Map<string, Measure>(); // DEFINE MEASURE in DAX queries

  constructor(public model: Model) { this.reindex(); }

  reindex() {
    this.tables.clear(); this.measures.clear(); this.colKeysCache.clear(); this.relIndex.clear(); this.expandedCache.clear();
    for (const t of this.model.tables) this.tables.set(t.name.toLowerCase(), t);
    for (const m of this.model.measures) this.measures.set(m.name.toLowerCase(), m);
  }

  // ---------- lookup ----------
  table(name: string): ModelTable {
    const t = this.tables.get(name.toLowerCase());
    if (!t) derr(`Cannot find table '${name}'.`);
    return t!;
  }
  hasTable(name: string) { return this.tables.has(name.toLowerCase()); }
  colIdx(t: string, c: string): number {
    const tab = this.table(t);
    const lc = c.toLowerCase();
    const i = tab.columns.findIndex(x => x.name.toLowerCase() === lc);
    if (i < 0) derr(`Column '${c}' in table '${tab.name}' cannot be found or may not be used in this expression.`);
    return i;
  }
  canon(t: string, c: string): ColRef { const tab = this.table(t); return { t: tab.name, c: tab.columns[this.colIdx(t, c)].name }; }
  colKeys(t: string, ci: number): string[] {
    const k = `${t}\u0001${ci}`;
    let a = this.colKeysCache.get(k);
    if (!a) { const tab = this.table(t); a = tab.rows.map(r => keyOf(r[ci])); this.colKeysCache.set(k, a); }
    return a;
  }
  measure(name: string): Measure | undefined { return this.extraMeasures.get(name.toLowerCase()) ?? this.measures.get(name.toLowerCase()); }
  parse(src: string): DNode {
    let n = this.parsed.get(src);
    if (!n) { n = DaxParser.expr(src); this.parsed.set(src, n); }
    return n;
  }

  // ---------- relationships ----------
  activeRels(ctx: Ctx): Relationship[] {
    const rels = this.model.relationships;
    if (!ctx.userel.length) return rels.filter(r => r.active);
    const forced = rels.filter(r => ctx.userel.includes(r.id));
    const pairKey = (r: Relationship) => [r.fromTable, r.toTable].map(x => x.toLowerCase()).sort().join('|');
    const replaced = new Set(forced.map(pairKey));
    return [...rels.filter(r => r.active && !replaced.has(pairKey(r))), ...forced];
  }
  direction(r: Relationship, ctx: Ctx): 'none' | 'single' | 'both' {
    const o = ctx.cross[r.id];
    if (o === 'none') return 'none';
    if (o === 'both') return 'both';
    if (o === 'one') return 'single';
    if (r.cardinality === 'one-one') return 'both';
    return r.crossFilter;
  }
  /** Tables whose columns belong to the expanded version of t (reachable many→one). */
  expandedOf(t: string): string[] {
    const k = t.toLowerCase();
    let out = this.expandedCache.get(k);
    if (out) return out;
    out = [this.table(t).name];
    for (let i = 0; i < out.length; i++) {
      for (const r of this.model.relationships) {
        if (!r.active || r.cardinality === 'many-many') continue;
        if (r.fromTable.toLowerCase() === out[i].toLowerCase() && !out.some(x => x.toLowerCase() === r.toTable.toLowerCase())) out.push(this.table(r.toTable).name);
        if (r.cardinality === 'one-one' && r.toTable.toLowerCase() === out[i].toLowerCase() && !out.some(x => x.toLowerCase() === r.fromTable.toLowerCase())) out.push(this.table(r.fromTable).name);
      }
    }
    this.expandedCache.set(k, out);
    return out;
  }
  /** Rows of `target` related to the given rows of `src` along many→one active relationships. */
  relatedRows(src: string, rows: Set<number>, target: string): Set<number> {
    // BFS to find the path
    const prev = new Map<string, Relationship>();
    const q = [src.toLowerCase()]; const seen = new Set(q);
    while (q.length) {
      const cur = q.shift()!;
      if (cur === target.toLowerCase()) break;
      for (const r of this.model.relationships) {
        if (!r.active || r.cardinality === 'many-many') continue;
        const pairs: [string, string][] = [[r.fromTable, r.toTable]];
        if (r.cardinality === 'one-one') pairs.push([r.toTable, r.fromTable]);
        for (const [a, b] of pairs) {
          if (a.toLowerCase() === cur && !seen.has(b.toLowerCase())) { seen.add(b.toLowerCase()); prev.set(b.toLowerCase(), r); q.push(b.toLowerCase()); }
        }
      }
    }
    const path: Relationship[] = [];
    let cur = target.toLowerCase();
    while (cur !== src.toLowerCase()) { const r = prev.get(cur); if (!r) return new Set(range(this.table(target).rows.length)); path.unshift(r); cur = (r.toTable.toLowerCase() === cur ? r.fromTable : r.toTable).toLowerCase(); }
    let curT = src; let set = rows;
    for (const r of path) {
      const forward = r.fromTable.toLowerCase() === curT.toLowerCase();
      const [a, ac, b, bc] = forward ? [r.fromTable, r.fromColumn, r.toTable, r.toColumn] : [r.toTable, r.toColumn, r.fromTable, r.fromColumn];
      const ak = this.colKeys(this.table(a).name, this.colIdx(a, ac));
      const keys = new Set<string>(); for (const i of set) keys.add(ak[i]);
      const bk = this.colKeys(this.table(b).name, this.colIdx(b, bc));
      const next = new Set<number>(); bk.forEach((k, i) => { if (keys.has(k)) next.add(i); });
      set = next; curT = b;
    }
    return set;
  }

  // ---------- filter context → visible rows ----------
  directlyFiltered(t: string, ctx: Ctx): boolean {
    const lt = t.toLowerCase();
    if (this.rls?.has(this.table(t).name)) return true;
    for (const f of ctx.filters) {
      if (f.kind === 'rows') {
        if (f.t.toLowerCase() === lt) return true;
        if (f.expanded && !f.blocked?.has(this.table(t).name) && this.expandedOf(f.t).some(x => x.toLowerCase() === lt)) return true;
      } else if (f.cols.some(c => c.t.toLowerCase() === lt)) return true;
    }
    return false;
  }

  isFiltered(t: string, ctx: Ctx, visiting: Set<string> = new Set()): boolean {
    const name = this.table(t).name;
    const ck = 'F:' + name + (visiting.size ? '|' + [...visiting].sort().join(',') : '');
    const c = ctx.cache.get(ck); if (c !== undefined) return c;
    let res = this.directlyFiltered(name, ctx);
    if (!res) {
      visiting.add(name);
      for (const r of this.activeRels(ctx)) {
        const dir = this.direction(r, ctx);
        if (dir === 'none') continue;
        const from = this.table(r.fromTable).name, to = this.table(r.toTable).name;
        if (from === name && !visiting.has(to) && this.isFiltered(to, ctx, visiting)) { res = true; break; }
        if (to === name && dir === 'both' && !visiting.has(from) && this.isFiltered(from, ctx, visiting)) { res = true; break; }
      }
      visiting.delete(name);
    }
    ctx.cache.set(ck, res);
    return res;
  }

  visible(t: string, ctx: Ctx, visiting: Set<string> = new Set()): number[] {
    const tab = this.table(t); const name = tab.name;
    const ck = 'V:' + name + (visiting.size ? '|' + [...visiting].sort().join(',') : '');
    const c = ctx.cache.get(ck); if (c) return c;
    let rows: number[] | null = null;
    const apply = (pred: (i: number) => boolean) => { rows = (rows ?? range(tab.rows.length)).filter(pred); };
    for (const f of ctx.filters) {
      if (f.kind === 'rows') {
        if (f.t === name) apply(i => f.rows.has(i));
        else if (f.expanded && !f.blocked?.has(name) && this.expandedOf(f.t).includes(name)) {
          f.exp ??= new Map();
          let s = f.exp.get(name);
          if (!s) { s = this.relatedRows(f.t, f.rows, name); f.exp.set(name, s); }
          const ss = s; apply(i => ss.has(i));
        }
      } else {
        const p = this.projection(f, name);
        if (p) {
          const ks = p.idx.map(ci => this.colKeys(name, ci));
          if (ks.length === 1) { const k0 = ks[0]; apply(i => p.keys.has(k0[i])); }
          else apply(i => p.keys.has(ks.map(k => k[i]).join('\u0001')));
        }
      }
    }
    const rl = this.rls?.get(name);
    if (rl) apply(i => rl.has(i));
    visiting.add(name);
    for (const r of this.activeRels(ctx)) {
      const dir = this.direction(r, ctx);
      if (dir === 'none') continue;
      const from = this.table(r.fromTable).name, to = this.table(r.toTable).name;
      if (from === to) continue;
      if (from === name && !visiting.has(to) && this.isFiltered(to, ctx, new Set(visiting))) {
        const other = this.visible(to, ctx, visiting);
        const ok = this.colKeys(to, this.colIdx(to, r.toColumn));
        const keys = new Set<string>(); for (const i of other) keys.add(ok[i]);
        const mk = this.colKeys(name, this.colIdx(name, r.fromColumn));
        apply(i => keys.has(mk[i]));
      }
      if (to === name && dir === 'both' && !visiting.has(from) && this.isFiltered(from, ctx, new Set(visiting))) {
        const other = this.visible(from, ctx, visiting);
        const ok = this.colKeys(from, this.colIdx(from, r.fromColumn));
        const keys = new Set<string>(); for (const i of other) keys.add(ok[i]);
        const mk = this.colKeys(name, this.colIdx(name, r.toColumn));
        apply(i => keys.has(mk[i]));
      }
    }
    visiting.delete(name);
    const res = rows ?? range(tab.rows.length);
    ctx.cache.set(ck, res);
    return res;
  }

  projection(f: Filter & { kind: 'cols' }, table: string) {
    f.proj ??= new Map();
    if (f.proj.has(table)) return f.proj.get(table)!;
    const pos: number[] = []; const idx: number[] = [];
    f.cols.forEach((c, j) => { if (c.t === table) { pos.push(j); idx.push(this.colIdx(table, c.c)); } });
    if (!pos.length) { f.proj.set(table, undefined as any); return undefined; }
    const keys = pos.length === f.cols.length && pos.every((p, j) => p === j) ? f.keys : new Set(f.tuples.map(tu => tupleKey(pos.map(p => tu[p]))));
    const p = { idx, keys };
    f.proj.set(table, p);
    return p;
  }

  // ---------- filter construction / manipulation ----------
  colsFilter(cols: ColRef[], tuples: any[][]): Filter {
    const keys = new Set<string>(); const uniq: any[][] = [];
    for (const t of tuples) { const k = tupleKey(t); if (!keys.has(k)) { keys.add(k); uniq.push(t); } }
    return { kind: 'cols', cols, tuples: uniq, keys };
  }
  filterFromTable(vt: VTable): Filter | null {
    if (vt.base && vt.rowIdx) return { kind: 'rows', t: vt.base, rows: new Set(vt.rowIdx), expanded: true };
    const li = vt.cols.map((c, i) => ({ c, i })).filter(x => x.c.t && x.c.c);
    if (!li.length) return null;
    // a date-part column filters its base column by every date in that part
    if (li.some(x => x.c.part)) {
      const base = li.map(x => ({ t: x.c.t!, c: x.c.c! }));
      const tupleSet = new Set(vt.rows.map(r => tupleKey(li.map(x => r[x.i]))));
      const out: any[][] = [];
      const t0 = base[0].t;
      if (base.every(b => b.t === t0)) {
        const tab = this.table(t0); const cis = base.map(b => this.colIdx(b.t, b.c));
        for (const row of tab.rows) {
          const derived = li.map((x, j) => x.c.part ? datePartValue(row[cis[j]], x.c.part) : row[cis[j]]);
          if (tupleSet.has(tupleKey(derived))) out.push(cis.map(ci => row[ci]));
        }
        const uniqCols: ColRef[] = []; const pick: number[] = [];
        base.forEach((b, j) => { if (!uniqCols.some(u => u.c === b.c)) { uniqCols.push(b); pick.push(j); } });
        return this.colsFilter(uniqCols, out.map(r => pick.map(p => r[p])));
      }
    }
    return this.colsFilter(li.map(x => ({ t: x.c.t!, c: x.c.c! })), vt.rows.map(r => li.map(x => r[x.i])));
  }
  filterCols(f: Filter): ColRef[] {
    if (f.kind === 'cols') return f.cols;
    return this.table(f.t).columns.map(c => ({ t: f.t, c: c.name }));
  }
  /** Remove the given columns from a filter by projecting it onto the remaining ones. */
  removeColsFrom(f: Filter, remove: ColRef[]): Filter | null {
    const isRm = (c: ColRef) => remove.some(r => r.t === c.t && r.c.toLowerCase() === c.c.toLowerCase());
    if (f.kind === 'rows') {
      if (!remove.some(r => r.t === f.t)) {
        // removing columns of an expanded table blocks propagation to that table
        const tabs = [...new Set(remove.map(r => r.t))].filter(t => this.expandedOf(f.t).includes(t));
        if (!tabs.length || !f.expanded) return f;
        return { ...f, blocked: new Set([...(f.blocked ?? []), ...tabs]), exp: undefined };
      }
      const tab = this.table(f.t);
      const keep = tab.columns.map((c, i) => ({ c, i })).filter(x => !isRm({ t: f.t, c: x.c.name }));
      if (!keep.length) return null;
      return this.colsFilter(keep.map(x => ({ t: f.t, c: x.c.name })), [...f.rows].map(i => keep.map(x => tab.rows[i][x.i])));
    }
    const keepIdx = f.cols.map((c, i) => ({ c, i })).filter(x => !isRm(x.c));
    if (keepIdx.length === f.cols.length) return f;
    if (!keepIdx.length) return null;
    return this.colsFilter(keepIdx.map(x => x.c), f.tuples.map(t => keepIdx.map(x => t[x.i])));
  }
  removeTables(filters: Filter[], tables: string[]): Filter[] {
    const cols: ColRef[] = [];
    for (const t of tables) for (const c of this.table(t).columns) cols.push({ t: this.table(t).name, c: c.name });
    const out: Filter[] = [];
    for (const f of filters) {
      if (f.kind === 'rows' && tables.includes(f.t)) continue;
      const g = this.removeColsFrom(f, cols); if (g) out.push(g);
    }
    return out;
  }
  removeCols(filters: Filter[], cols: ColRef[]): Filter[] {
    const out: Filter[] = [];
    for (const f of filters) { const g = this.removeColsFrom(f, cols); if (g) out.push(g); }
    return out;
  }
  isDateKey(c: ColRef): boolean {
    const tab = this.table(c.t);
    if (tab.dateColumn && tab.dateColumn.toLowerCase() === c.c.toLowerCase()) return true;
    const col = tab.columns.find(x => x.name.toLowerCase() === c.c.toLowerCase());
    if (!col || (col.dataType !== 'date' && col.dataType !== 'datetime')) return false;
    return this.model.relationships.some(r => r.toTable.toLowerCase() === c.t.toLowerCase() && r.toColumn.toLowerCase() === c.c.toLowerCase());
  }
  applyFilter(filters: Filter[], f: Filter, keep: boolean): Filter[] {
    let out = filters;
    if (!keep) {
      const cols = this.filterCols(f);
      // a filter on the date column of a date table removes every filter on that table
      const dateTabs = [...new Set(cols.filter(c => this.isDateKey(c)).map(c => c.t))];
      if (dateTabs.length) out = this.removeTables(out, dateTabs.map(t => this.table(t).name).filter(t => !this.expandedOf(t).some(x => x !== t) || true));
      if (f.kind === 'rows') out = out.filter(e => !(e.kind === 'rows' && e.t === f.t));
      out = this.removeCols(out, cols);
    }
    return [...out, f];
  }

  // ---------- evaluation entry points ----------
  scalarOf(src: string, ctx: Ctx = emptyCtx()) { return this.scalar(this.parse(src), ctx); }
  tableOf(src: string, ctx: Ctx = emptyCtx()) { return this.tableExpr(this.parse(src), ctx); }

  scalar(n: DNode, ctx: Ctx): any {
    if (++this.depth > 4000) { this.depth = 0; derr('The expression is too deeply nested (possible circular dependency).'); }
    try { return this.scalarInner(n, ctx); } finally { this.depth--; }
  }

  scalarInner(n: DNode, ctx: Ctx): any {
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'bool': return n.v;
      case 'empty': return null;
      case 'col': return this.colValue(n, ctx);
      case 'name': {
        const v = ctx.vars?.get(n.name.toLowerCase());
        if (v !== undefined) return v instanceof VTable ? tableToScalar(v) : v;
        if (this.hasTable(n.name)) return tableToScalar(this.tableExpr(n, ctx));
        return derr(`Failed to resolve name '${n.name}'. It is not a valid table, variable, or function name.`);
      }
      case 'var': return this.withVars(n, ctx, c => this.scalar(n.ret, c));
      case 'un': {
        const v = this.scalar(n.e, ctx);
        if (n.op === 'NOT') return !truthy(v);
        if (v === null) return null;
        return -toNum(v);
      }
      case 'bin': return this.binary(n.op, n.l, n.r, ctx);
      case 'tc': return tableToScalar(this.tableExpr(n, ctx));
      case 'call': {
        const f = SCALAR[n.fn];
        if (f) return f(this, n.args, ctx);
        if (TABLE[n.fn]) return tableToScalar(TABLE[n.fn](this, n.args, ctx));
        return derr(`The function '${n.fn}' is not supported in this sandbox (or doesn't exist).`);
      }
    }
  }

  withVars<T>(n: DNode & { k: 'var' }, ctx: Ctx, f: (c: Ctx) => T): T {
    let c = ctx;
    for (const v of n.vars) {
      const val = isTableExpr(v.expr, this, c) ? this.tableExpr(v.expr, c) : this.scalar(v.expr, c);
      const vars = new Map(c.vars ?? []); vars.set(v.name.toLowerCase(), val);
      c = { ...c, vars };
    }
    return f(c);
  }

  binary(op: string, ln: DNode, rn: DNode, ctx: Ctx): any {
    if (op === '&&') return truthy(this.scalar(ln, ctx)) && truthy(this.scalar(rn, ctx));
    if (op === '||') return truthy(this.scalar(ln, ctx)) || truthy(this.scalar(rn, ctx));
    if (op === 'IN') {
      const vt = this.tableExpr(rn, ctx);
      const lv = ln.k === 'tc' && ln.rows.length === 1 ? ln.rows[0].map(x => this.scalar(x, ctx)) : [this.scalar(ln, ctx)];
      if (vt.cols.length !== lv.length) derr('Each tuple in the IN operator must have the same number of columns as the table.');
      return vt.rows.some(r => r.every((x, i) => daxEq(x, lv[i])));
    }
    const a = this.scalar(ln, ctx), b = this.scalar(rn, ctx);
    return binop(op, a, b);
  }

  colValue(n: DNode & { k: 'col' }, ctx: Ctx): any {
    // measure?
    if (!n.table) {
      const m = this.measure(n.col);
      if (m) return this.evalMeasure(m, ctx);
    } else if (!this.hasTable(n.table) && !ctx.vars?.has(n.table.toLowerCase())) derr(`Cannot find table '${n.table}'.`);
    else if (this.hasTable(n.table)) {
      const m = this.measure(n.col);
      if (m && m.table.toLowerCase() === n.table.toLowerCase() && !this.table(n.table).columns.some(c => c.name.toLowerCase() === n.col.toLowerCase())) return this.evalMeasure(m, ctx);
    }
    for (let k = ctx.rows.length - 1; k >= 0; k--) {
      const rc = ctx.rows[k];
      const i = rc.vt.colIndex(n.table && this.hasTable(n.table) ? this.table(n.table).name : n.table, n.col);
      if (i >= 0) return rc.vt.rows[rc.i][i];
    }
    if (!n.table) derr(`The value for '${n.col}' cannot be determined. Either the column doesn't exist, or there is no current row for this column.`);
    return derr(`A single value for column '${n.col}' in table '${n.table}' cannot be determined. This can happen when a measure formula refers to a column that contains many values without specifying an aggregation such as min, max, count, or sum to get a single result.`);
  }

  /** Context transition: turn every row context into an equivalent filter. */
  transition(ctx: Ctx): Filter[] {
    let filters = ctx.filters;
    for (const rc of ctx.rows) {
      let f: Filter | null = null;
      if (rc.vt.base && rc.vt.rowIdx) f = { kind: 'rows', t: rc.vt.base, rows: new Set([rc.vt.rowIdx[rc.i]]), expanded: true };
      else {
        const li = rc.vt.cols.map((c, i) => ({ c, i })).filter(x => x.c.t && x.c.c);
        if (li.length) f = this.filterFromTable(new VTable(li.map(x => x.c), [li.map(x => rc.vt.rows[rc.i][x.i])]));
      }
      if (f) filters = this.applyFilter(filters, f, false);
    }
    return filters;
  }

  evalMeasure(m: Measure, ctx: Ctx): any {
    const key = m.name.toLowerCase();
    if (this.measureStack.includes(key)) derr(`A circular dependency was detected: ${[...this.measureStack, key].map(x => `[${x}]`).join(' → ')}.`);
    const filters = ctx.rows.length ? this.transition(ctx) : ctx.filters;
    const c: Ctx = { ...ctx, filters, rows: [], vars: null, cache: ctx.rows.length ? new Map() : ctx.cache };
    this.measureStack.push(key);
    try {
      const node = this.parse(m.expression);
      return this.scalar(node, c);
    } catch (e) {
      if (e instanceof DaxError && !e.message.startsWith('[')) throw new DaxError(`[${m.name}]: ${e.message}`);
      throw e;
    } finally { this.measureStack.pop(); }
  }

  /** CALCULATE / CALCULATETABLE core. */
  calcContext(filterArgs: DNode[], ctx: Ctx): Ctx {
    type Op = { kind: 'filter'; f: Filter; keep: boolean } | { kind: 'all'; tables: string[]; cols: ColRef[]; everything?: boolean; except?: ColRef[] }
      | { kind: 'selected'; cols: ColRef[]; tables: string[]; everything?: boolean } | { kind: 'userel'; id: string } | { kind: 'cross'; id: string; dir: 'none' | 'both' | 'one' };
    const ops: Op[] = [];
    const evalArg = (a: DNode, keep: boolean) => {
      if (a.k === 'call') {
        switch (a.fn) {
          case 'ALL': case 'REMOVEFILTERS': case 'ALLNOBLANKROW': case 'ALLCROSSFILTERED': {
            if (!a.args.length) { ops.push({ kind: 'all', tables: [], cols: [], everything: true }); return; }
            const { tables, cols } = this.colsOrTables(a.args, ctx);
            ops.push({ kind: 'all', tables, cols }); return;
          }
          case 'ALLEXCEPT': {
            const t = this.tableName(a.args[0], ctx);
            const ex = a.args.slice(1).map(x => this.colRef(x));
            ops.push({ kind: 'all', tables: [t], cols: [], except: ex }); return;
          }
          case 'ALLSELECTED': {
            if (!a.args.length) { ops.push({ kind: 'selected', cols: [], tables: [], everything: true }); return; }
            const { tables, cols } = this.colsOrTables(a.args, ctx);
            ops.push({ kind: 'selected', tables, cols }); return;
          }
          case 'USERELATIONSHIP': {
            const c1 = this.colRef(a.args[0]), c2 = this.colRef(a.args[1]);
            const r = this.findRel(c1, c2);
            if (!r) derr(`USERELATIONSHIP: no relationship exists between ${c1.t}[${c1.c}] and ${c2.t}[${c2.c}].`);
            ops.push({ kind: 'userel', id: r!.id }); return;
          }
          case 'CROSSFILTER': {
            const c1 = this.colRef(a.args[0]), c2 = this.colRef(a.args[1]);
            const r = this.findRel(c1, c2);
            if (!r) derr('CROSSFILTER: no relationship exists between the two columns.');
            const d = a.args[2].k === 'name' ? a.args[2].name.toUpperCase() : String(this.scalar(a.args[2], ctx)).toUpperCase();
            ops.push({ kind: 'cross', id: r!.id, dir: d === 'NONE' ? 'none' : d === 'BOTH' ? 'both' : 'one' }); return;
          }
          case 'KEEPFILTERS': evalArg(a.args[0], true); return;
        }
      }
      if (isTableExpr(a, this, ctx)) {
        const vt = this.tableExpr(a, ctx);
        const f = this.filterFromTable(vt);
        if (f) ops.push({ kind: 'filter', f, keep });
        return;
      }
      // boolean filter: FILTER(ALL(columns referenced), predicate)
      const cols: ColRef[] = [];
      walk(a, x => {
        if (x.k === 'col' && x.table && this.hasTable(x.table) && !(this.measure(x.col) && !this.table(x.table).columns.some(c => c.name.toLowerCase() === x.col.toLowerCase()))) {
          const cr = this.canon(x.table, x.col);
          if (!cols.some(c => c.t === cr.t && c.c === cr.c)) cols.push(cr);
        }
      });
      if (!cols.length) derr('A filter argument of CALCULATE must reference at least one column (e.g. Product[Color] = "Red").');
      if (new Set(cols.map(c => c.t)).size > 1) derr('The expression contains columns from multiple tables, but only columns from a single table can be used in a True/False expression that is used as a table filter expression.');
      const all = this.distinctTuples(cols, emptyFilterCtx(ctx));
      const vt = new VTable(cols.map(c => ({ name: c.c, t: c.t, c: c.c })), all);
      const keepRows = all.filter((_r, i) => truthy(this.scalar(a, { ...ctx, rows: [...ctx.rows, { vt, i }] })));
      ops.push({ kind: 'filter', f: this.colsFilter(cols, keepRows), keep });
    };
    for (const a of filterArgs) if (a.k !== 'empty') evalArg(a, false);

    let filters = ctx.rows.length ? this.transition(ctx) : ctx.filters;
    let userel = ctx.userel, cross = ctx.cross;
    for (const op of ops) {
      if (op.kind === 'userel') userel = [...userel, op.id];
      if (op.kind === 'cross') cross = { ...cross, [op.id]: op.dir };
    }
    for (const op of ops) {
      if (op.kind === 'all') {
        if (op.everything) filters = [];
        else if (op.except) {
          const exp = op.tables.flatMap(t => this.expandedOf(t));
          const rm: ColRef[] = [];
          for (const t of exp) for (const c of this.table(t).columns) if (!op.except.some(e => e.t === t && e.c.toLowerCase() === c.name.toLowerCase())) rm.push({ t, c: c.name });
          filters = filters.filter(f => !(f.kind === 'rows' && exp.includes(f.t)) || op.except!.some(e => e.t === (f as any).t));
          filters = this.removeCols(filters, rm);
        } else {
          if (op.tables.length) filters = this.removeTables(filters, op.tables.flatMap(t => this.expandedOf(t)));
          if (op.cols.length) filters = this.removeCols(filters, op.cols);
        }
      }
      if (op.kind === 'selected') {
        const sel = ctx.selected ?? [];
        if (op.everything) filters = [...sel];
        else {
          const cols = [...op.cols, ...op.tables.flatMap(t => this.table(t).columns.map(c => ({ t, c: c.name })))];
          filters = this.removeCols(filters.filter(f => !(f.kind === 'rows' && op.tables.includes(f.t))), cols);
          for (const s of sel) {
            const sc = this.filterCols(s);
            const keepCols = sc.filter(c => cols.some(x => x.t === c.t && x.c === c.c));
            if (!keepCols.length) continue;
            const rest = sc.filter(c => !keepCols.includes(c));
            const p = this.removeColsFrom(s, rest);
            if (p) filters = [...filters, p];
          }
        }
      }
    }
    for (const op of ops) if (op.kind === 'filter') filters = this.applyFilter(filters, op.f, op.keep);
    return { ...ctx, filters, userel, cross, cache: new Map() };
  }

  findRel(a: ColRef, b: ColRef) {
    const eq = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
    return this.model.relationships.find(r =>
      (eq(r.fromTable, a.t) && eq(r.fromColumn, a.c) && eq(r.toTable, b.t) && eq(r.toColumn, b.c)) ||
      (eq(r.fromTable, b.t) && eq(r.fromColumn, b.c) && eq(r.toTable, a.t) && eq(r.toColumn, a.c)));
  }

  colRef(n: DNode): ColRef {
    if (n.k !== 'col' || !n.table) return derr('A column reference like Table[Column] is expected here.');
    return this.canon(n.table, n.col);
  }
  tableName(n: DNode, ctx: Ctx): string {
    if (n.k === 'name' && this.hasTable(n.name) && !ctx.vars?.has(n.name.toLowerCase())) return this.table(n.name).name;
    return derr('A table name is expected here.');
  }
  colsOrTables(args: DNode[], ctx: Ctx) {
    const tables: string[] = [], cols: ColRef[] = [];
    for (const a of args) {
      if (a.k === 'col') cols.push(this.colRef(a));
      else if (a.k === 'name') tables.push(this.tableName(a, ctx));
      else derr('ALL/REMOVEFILTERS accept table names or column references.');
    }
    return { tables, cols };
  }

  distinctTuples(cols: ColRef[], ctx: Ctx, onlyVisible = true): any[][] {
    const t = cols[0].t;
    if (cols.some(c => c.t !== t)) {
      // columns from several tables: use the many-side table that links them (like SUMMARIZE)
      derr('Columns must come from the same table here.');
    }
    const tab = this.table(t);
    const idx = cols.map(c => this.colIdx(t, c.c));
    const rows = onlyVisible ? this.visible(t, ctx) : range(tab.rows.length);
    const seen = new Set<string>(); const out: any[][] = [];
    const ks = idx.map(ci => this.colKeys(tab.name, ci));
    for (const i of rows) {
      const k = ks.length === 1 ? ks[0][i] : ks.map(x => x[i]).join('\u0001');
      if (!seen.has(k)) { seen.add(k); out.push(idx.map(ci => tab.rows[i][ci])); }
    }
    return out;
  }

  baseTable(t: string, ctx: Ctx): VTable {
    const tab = this.table(t);
    const rows = this.visible(tab.name, ctx);
    return new VTable(tab.columns.map(c => ({ name: c.name, t: tab.name, c: c.name })), rows.map(i => tab.rows[i]), tab.name, rows);
  }

  tableExpr(n: DNode, ctx: Ctx): VTable {
    switch (n.k) {
      case 'name': {
        const v = ctx.vars?.get(n.name.toLowerCase());
        if (v !== undefined) { if (v instanceof VTable) return v; return new VTable([{ name: 'Value' }], [[v]]); }
        if (!this.hasTable(n.name)) derr(`Cannot find table '${n.name}'.`);
        return this.baseTable(n.name, ctx);
      }
      case 'tc': {
        const rows = n.rows.map(r => r.map(x => this.scalar(x, ctx)));
        const w = Math.max(1, ...rows.map(r => r.length));
        return new VTable(Array.from({ length: w }, (_, i) => ({ name: w === 1 ? 'Value' : `Value${i + 1}` })), rows);
      }
      case 'var': return this.withVars(n, ctx, c => this.tableExpr(n.ret, c));
      case 'col': {
        if (!n.table) {
          const m = this.measure(n.col);
          if (m) return new VTable([{ name: 'Value' }], [[this.evalMeasure(m, ctx)]]);
        }
        const cr = this.colRef(n);
        return new VTable([{ name: cr.c, t: cr.t, c: cr.c }], this.distinctTuples([cr], ctx));
      }
      case 'call': {
        const f = TABLE[n.fn];
        if (f) return f(this, n.args, ctx);
        if (SCALAR[n.fn]) return new VTable([{ name: 'Value' }], [[SCALAR[n.fn](this, n.args, ctx)]]);
        return derr(`The function '${n.fn}' is not supported in this sandbox (or doesn't exist).`);
      }
      default:
        return derr('The expression specified in the query is not a valid table expression.');
    }
  }

  /** Iterate a table with a row context. */
  iterate(tableNode: DNode, exprNode: DNode, ctx: Ctx, each: (v: any, vt: VTable, i: number) => void) {
    const vt = this.tableExpr(tableNode, ctx);
    for (let i = 0; i < vt.rows.length; i++) {
      const c: Ctx = { ...ctx, rows: [...ctx.rows, { vt, i }] };
      each(this.scalar(exprNode, c), vt, i);
    }
  }

  /** Column values for aggregation functions: SUM(T[c]) etc. */
  columnValues(n: DNode, ctx: Ctx): any[] {
    if (n.k !== 'col') {
      // e.g. a table variable column
      return derr('The function only accepts a column reference as an argument.');
    }
    if (n.table && ctx.vars?.has(n.table.toLowerCase())) {
      const vt = ctx.vars.get(n.table.toLowerCase()) as VTable;
      const i = vt.colIndex(undefined, n.col);
      return vt.rows.map(r => r[i]);
    }
    if (!n.table) {
      // [Column] in a calculated column context resolves to the current table
      const rc = ctx.rows[ctx.rows.length - 1];
      if (rc?.vt.base) return this.columnValues({ k: 'col', table: rc.vt.base, col: n.col }, ctx);
      derr(`A column reference like Table[${n.col}] is expected.`);
    }
    const cr = this.colRef(n);
    const ci = this.colIdx(cr.t, cr.c); const tab = this.table(cr.t);
    return this.visible(cr.t, ctx).map(i => tab.rows[i][ci]);
  }

  /** RELATED(): follow many→one relationships from the current row. */
  related(cr: ColRef, ctx: Ctx): any {
    for (let k = ctx.rows.length - 1; k >= 0; k--) {
      const rc = ctx.rows[k];
      const direct = rc.vt.colIndex(cr.t, cr.c);
      if (direct >= 0) return rc.vt.rows[rc.i][direct];
      if (!rc.vt.base) continue;
      const path = this.relPath(rc.vt.base, cr.t, ctx);
      if (!path) continue;
      let t = rc.vt.base; let row: any[] | undefined = rc.vt.rows[rc.i];
      for (const r of path) {
        const forward = r.fromTable.toLowerCase() === t.toLowerCase();
        const [ac, b, bc] = forward ? [r.fromColumn, r.toTable, r.toColumn] : [r.toColumn, r.fromTable, r.fromColumn];
        const key = keyOf(row![this.colIdx(t, ac)]);
        const idx = this.uniqueIndex(b, bc);
        const j = idx.get(key);
        if (j === undefined) return null;
        row = this.table(b).rows[j]; t = this.table(b).name;
      }
      return row![this.colIdx(t, cr.c)];
    }
    return derr(`The column '${cr.t}[${cr.c}]' either doesn't exist or doesn't have a relationship to any table available in the current context.`);
  }
  relPath(from: string, to: string, ctx: Ctx): Relationship[] | null {
    const prev = new Map<string, Relationship>();
    const start = from.toLowerCase(), goal = to.toLowerCase();
    const q = [start]; const seen = new Set(q);
    const rels = this.activeRels(ctx);
    while (q.length) {
      const cur = q.shift()!;
      if (cur === goal) break;
      for (const r of rels) {
        if (r.cardinality === 'many-many') continue;
        if (r.fromTable.toLowerCase() === cur && !seen.has(r.toTable.toLowerCase())) { seen.add(r.toTable.toLowerCase()); prev.set(r.toTable.toLowerCase(), r); q.push(r.toTable.toLowerCase()); }
        if (r.cardinality === 'one-one' && r.toTable.toLowerCase() === cur && !seen.has(r.fromTable.toLowerCase())) { seen.add(r.fromTable.toLowerCase()); prev.set(r.fromTable.toLowerCase(), r); q.push(r.fromTable.toLowerCase()); }
      }
    }
    if (!seen.has(goal)) return null;
    const path: Relationship[] = []; let cur = goal;
    while (cur !== start) { const r = prev.get(cur)!; path.unshift(r); cur = (r.toTable.toLowerCase() === cur ? r.fromTable : r.toTable).toLowerCase(); }
    return path;
  }
  uniqueIndex(t: string, c: string): Map<string, number> {
    const k = `${t.toLowerCase()}|${c.toLowerCase()}`;
    let m = this.relIndex.get(k);
    if (!m) { m = new Map(); const ks = this.colKeys(this.table(t).name, this.colIdx(t, c)); ks.forEach((x, i) => { if (!m!.has(x)) m!.set(x, i); }); this.relIndex.set(k, m); }
    return m;
  }

  // ---------- SUMMARIZECOLUMNS / visual queries ----------
  summarizeColumns(groups: VCol[], filterTables: VTable[], exprs: { name: string; node?: DNode; fn?: (c: Ctx) => any }[], ctx: Ctx, opts: { keepBlanks?: boolean } = {}): VTable {
    let filters = ctx.filters;
    for (const vt of filterTables) { const f = this.filterFromTable(vt); if (f) filters = this.applyFilter(filters, f, false); }
    const base: Ctx = { ...ctx, filters, rows: [], cache: new Map() };
    base.selected = ctx.selected ?? filters;
    // group per table
    const byTable = new Map<string, VCol[]>();
    for (const g of groups) { const t = this.table(g.t!).name; if (!byTable.has(t)) byTable.set(t, []); byTable.get(t)!.push(g); }
    const perTable: { cols: VCol[]; tuples: any[][] }[] = [];
    for (const [t, cols] of byTable) {
      const tab = this.table(t);
      const idx = cols.map(c => this.colIdx(t, c.c!));
      const seen = new Set<string>(); const tuples: any[][] = [];
      for (const i of this.visible(t, base)) {
        const tu = cols.map((c, j) => c.part ? datePartValue(tab.rows[i][idx[j]], c.part) : tab.rows[i][idx[j]]);
        const k = tupleKey(tu);
        if (!seen.has(k)) { seen.add(k); tuples.push(tu); }
      }
      perTable.push({ cols, tuples });
    }
    // cross join
    let combos: any[][] = [[]];
    for (const p of perTable) { const next: any[][] = []; for (const c of combos) for (const t of p.tuples) next.push([...c, ...t]); combos = next; if (combos.length > 200000) derr('The visual has too many combinations to display (over 200,000).'); }
    if (!groups.length) combos = [[]];
    const orderCols = perTable.flatMap(p => p.cols);
    const scope = new Set(orderCols.map(c => `${c.t}|${c.c}`.toLowerCase()));
    const rows: any[][] = [];
    const multi = perTable.length > 1;
    const fact = multi && !exprs.length ? this.commonFact(perTable.map(p => this.table(p.cols[0].t!).name)) : null;
    for (const combo of combos) {
      let fs = base.filters; let off = 0;
      for (const p of perTable) {
        const vt = new VTable(p.cols, [combo.slice(off, off + p.cols.length)]); off += p.cols.length;
        const f = this.filterFromTable(vt); if (f) fs = this.applyFilter(fs, f, false);
      }
      const c: Ctx = { ...base, filters: fs, cache: new Map(), scope };
      const vals = exprs.map(e => e.fn ? e.fn(c) : this.scalar(e.node!, c));
      if (exprs.length && !opts.keepBlanks && vals.every(v => isBlank(v))) continue;
      if (fact && this.visible(fact, c).length === 0) continue;
      rows.push([...combo, ...vals]);
    }
    return new VTable([...orderCols, ...exprs.map(e => ({ name: e.name }))], rows);
  }
  commonFact(tables: string[]): string | null {
    for (const t of this.model.tables) {
      const exp = this.expandedOf(t.name);
      if (tables.every(x => exp.includes(x))) return t.name;
    }
    return null;
  }
}

function emptyFilterCtx(ctx: Ctx): Ctx { return { ...ctx, filters: [], rows: [], cache: new Map() }; }

// ---------- scalar helpers ----------
export function truthy(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') { if (v.toLowerCase() === 'true') return true; if (v.toLowerCase() === 'false' || v === '') return false; derr(`Cannot convert value '${v}' of type Text to type True/False.`); }
  if (v instanceof Date) return true;
  return !!v;
}
export function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return dateToSerial(v);
  if (v instanceof MTime) return v.ms / 86400000;
  if (typeof v === 'string') {
    const t = v.trim().replace(/,/g, '');
    if (t !== '' && !isNaN(Number(t))) return Number(t);
    derr(`Cannot convert value '${v}' of type Text to type Number.`);
  }
  return derr('Cannot convert value to type Number.');
}
export function toStr(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (v instanceof Date) { const d = v; const base = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; return d.getHours() || d.getMinutes() || d.getSeconds() ? `${base} ${d.toLocaleTimeString('en-US')}` : base; }
  if (typeof v === 'number') return String(+v.toPrecision(15));
  return String(v);
}
export function dateToSerial(d: Date) {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}
export function serialToDate(n: number) {
  const days = Math.floor(n); const d = new Date(1899, 11, 30 + days);
  const frac = n - days; if (frac) d.setTime(d.getTime() + Math.round(frac * 86400000));
  return d;
}
export function daxEq(a: any, b: any): boolean {
  if (a === null || a === undefined) return b === null || b === undefined || b === 0 || b === '' || b === false;
  if (b === null || b === undefined) return a === 0 || a === '' || a === false;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  if (a instanceof Date || b instanceof Date) return toNum(a) === toNum(b);
  if (typeof a === 'number' || typeof b === 'number') {
    if (typeof a === 'string' || typeof b === 'string') derr(`DAX comparison operations do not support comparing values of type Text with values of type Number. Consider using the VALUE or FORMAT function to convert one of the values.`);
    return toNum(a) === toNum(b);
  }
  return a === b;
}
function daxCmp(a: any, b: any): number {
  if (isBlank(a)) a = typeof b === 'string' ? '' : b instanceof Date ? 0 : typeof b === 'boolean' ? false : 0;
  if (isBlank(b)) b = typeof a === 'string' ? '' : a instanceof Date ? 0 : typeof a === 'boolean' ? false : 0;
  if (typeof a === 'string' && typeof b === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  if ((typeof a === 'string') !== (typeof b === 'string')) derr('DAX comparison operations do not support comparing values of type Text with values of type Number. Consider using the VALUE or FORMAT function to convert one of the values.');
  return toNum(a) - toNum(b);
}
export function binop(op: string, a: any, b: any): any {
  switch (op) {
    case '=': return daxEq(a, b);
    case '==': return isBlank(a) || isBlank(b) ? isBlank(a) && isBlank(b) : daxEq(a, b);
    case '<>': return !daxEq(a, b);
    case '<': return daxCmp(a, b) < 0;
    case '>': return daxCmp(a, b) > 0;
    case '<=': return daxCmp(a, b) <= 0;
    case '>=': return daxCmp(a, b) >= 0;
    case '&': return toStr(a) + toStr(b);
    case '+': case '-': {
      if (isBlank(a) && isBlank(b)) return null;
      if (a instanceof Date && !(b instanceof Date)) return serialToDate(dateToSerial(a) + (op === '+' ? toNum(b) : -toNum(b)));
      if (b instanceof Date && op === '+' && !(a instanceof Date)) return serialToDate(dateToSerial(b) + toNum(a));
      return op === '+' ? toNum(a) + toNum(b) : toNum(a) - toNum(b);
    }
    case '*': if (isBlank(a) || isBlank(b)) return null; return toNum(a) * toNum(b);
    case '/': {
      if (isBlank(a)) return null;
      const d = toNum(b);
      if (d === 0) { const n = toNum(a); return n === 0 ? NaN : n > 0 ? Infinity : -Infinity; }
      return toNum(a) / d;
    }
    case '^': if (isBlank(a)) return null; return Math.pow(toNum(a), toNum(b));
  }
  return derr(`Unknown operator ${op}`);
}
export function tableToScalar(vt: VTable): any {
  if (!vt.rows.length) return null;
  if (vt.cols.length !== 1 || vt.rows.length > 1) {
    if (vt.cols.length === 1 && new Set(vt.rows.map(r => keyOf(r[0]))).size === 1) return vt.rows[0][0];
    derr('A table of multiple values was supplied where a single value was expected.');
  }
  return vt.rows[0][0];
}

export function datePartValue(v: any, p: DatePart): any {
  if (!(v instanceof Date)) return null;
  switch (p) {
    case 'Year': return v.getFullYear();
    case 'Quarter': return Math.floor(v.getMonth() / 3) + 1;
    case 'Month': return v.getMonth() + 1;
    case 'Day': return v.getDate();
  }
}

// ---------- function registry ----------
export type ScalarFn = (e: DaxEngine, a: DNode[], c: Ctx) => any;
export type TableFn = (e: DaxEngine, a: DNode[], c: Ctx) => VTable;
export const SCALAR: Record<string, ScalarFn> = {};
export const TABLE: Record<string, TableFn> = {};

export function isTableExpr(n: DNode, e: DaxEngine, ctx: Ctx): boolean {
  switch (n.k) {
    case 'name': {
      const v = ctx.vars?.get(n.name.toLowerCase());
      if (v !== undefined) return v instanceof VTable;
      return e.hasTable(n.name);
    }
    case 'tc': return true;
    case 'call': return !!TABLE[n.fn] && !SCALAR[n.fn];
    case 'var': {
      let c = ctx;
      for (const v of n.vars) { const vars = new Map(c.vars ?? []); vars.set(v.name.toLowerCase(), isTableExpr(v.expr, e, c) ? new VTable([], []) : 0); c = { ...c, vars }; }
      return isTableExpr(n.ret, e, c);
    }
    default: return false;
  }
}

export { dateOnly, compareValues };
