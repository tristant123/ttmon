// Visual calculations: DAX evaluated over the visual matrix (the visual's rows and columns), not the model.
// A lattice holds one level per combination of row-hierarchy depth and column-hierarchy depth; functions such as
// RUNNINGSUM, MOVINGAVERAGE, PREVIOUS, NEXT, FIRST, LAST move along an axis, and COLLAPSE / EXPAND move between levels.
import { DNode, DaxParser } from '../dax/parser';
import { DaxEngine, SCALAR, emptyCtx, binop, truthy, toNum, DaxError } from '../dax/engine';
import { FieldRef } from '../model/types';
import { keyOf, compareValues } from '../core/values';

export interface CalcDef { name: string; expr: string }

/** A level of the visual matrix: rows with group values, then value columns, then visual calculations. */
export interface Level { kr: number; kc: number; groups: FieldRef[]; names: string[]; rows: any[][] }

type Axis = 'ROWS' | 'COLUMNS';
interface At { lv: Level; i: number; set?: number[] }

const err = (m: string): never => { throw new DaxError(m); };
const lower = (s: string) => s.toLowerCase();

export class Lattice {
  levels = new Map<string, Level>();
  parsed: DNode[];
  constructor(
    public eng: DaxEngine,
    public rowGroups: FieldRef[], public colGroups: FieldRef[],
    public rowLevels: number[], public colLevels: number[],
    /** Base values for a combination of groups (rows sorted in axis order). */
    public base: (groups: FieldRef[]) => { names: string[]; rows: any[][] },
    public groupName: (f: FieldRef) => string,
    public calcs: CalcDef[],
  ) {
    this.parsed = calcs.map(c => { try { return DaxParser.expr(c.expr); } catch (e) { return err(`Visual calculation '${c.name}': ${(e as Error).message}`); } });
  }

  level(kr: number, kc: number): Level {
    const key = `${kr}|${kc}`;
    let lv = this.levels.get(key);
    if (lv) return lv;
    const groups = [...this.rowGroups.slice(0, kr), ...this.colGroups.slice(0, kc)];
    const b = this.base(groups);
    lv = { kr, kc, groups, names: [...groups.map(this.groupName), ...b.names], rows: b.rows.map(r => [...r]) };
    this.levels.set(key, lv);
    // visual calculations, in order (each may use the ones before it)
    this.calcs.forEach((c, ci) => {
      lv!.names.push(c.name);
      lv!.rows.forEach(r => r.push(null));
      const col = lv!.names.length - 1;
      lv!.rows.forEach((r, i) => { r[col] = this.eval(this.parsed[ci], { lv: lv!, i }, new Map()); });
    });
    return lv;
  }

  // ---------- navigation ----------
  rowKey(lv: Level, i: number, n = lv.kr) { return lv.rows[i].slice(0, n).map(keyOf).join('|'); }
  colKey(lv: Level, i: number, n = lv.kc) { return lv.rows[i].slice(lv.kr, lv.kr + n).map(keyOf).join('|'); }
  /** Rows on the same line of the axis (same column position for ROWS), in order, optionally reset by parents. */
  partition(at: At, axis: Axis, reset: number): number[] {
    const { lv } = at;
    const same = (j: number) => axis === 'ROWS'
      ? this.colKey(lv, j) === this.colKey(lv, at.i) && (reset <= 0 || this.rowKey(lv, j, reset) === this.rowKey(lv, at.i, reset))
      : this.rowKey(lv, j) === this.rowKey(lv, at.i) && (reset <= 0 || this.colKey(lv, j, reset) === this.colKey(lv, at.i, reset));
    const out: number[] = [];
    for (let j = 0; j < lv.rows.length; j++) if (same(j)) out.push(j);
    return out;
  }
  move(at: At, axis: Axis, dir: 'collapse' | 'collapseAll' | 'expand' | 'expandAll'): { lv: Level; idx: number[] } {
    const { lv } = at;
    const levels = axis === 'ROWS' ? this.rowLevels : this.colLevels;
    const cur = axis === 'ROWS' ? lv.kr : lv.kc;
    const pos = levels.indexOf(cur);
    const target = dir === 'collapse' ? levels[Math.max(0, pos - 1)] : dir === 'collapseAll' ? levels[0] : dir === 'expand' ? levels[Math.min(levels.length - 1, pos + 1)] : levels[levels.length - 1];
    const tl = axis === 'ROWS' ? this.level(target, lv.kc) : this.level(lv.kr, target);
    const n = Math.min(target, cur);
    const match = (j: number) => axis === 'ROWS'
      ? this.rowKey(tl, j, n) === this.rowKey(lv, at.i, n) && this.colKey(tl, j) === this.colKey(lv, at.i)
      : this.colKey(tl, j, n) === this.colKey(lv, at.i, n) && this.rowKey(tl, j) === this.rowKey(lv, at.i);
    const idx: number[] = []; for (let j = 0; j < tl.rows.length; j++) if (match(j)) idx.push(j);
    return { lv: tl, idx };
  }

  // ---------- evaluation ----------
  eval(n: DNode, at: At, vars: Map<string, any>): any {
    switch (n.k) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'empty': return null;
      case 'name': {
        if (vars.has(lower(n.name))) return vars.get(lower(n.name));
        return err(`Failed to resolve name '${n.name}'.`);
      }
      case 'col': {
        if (n.table) return err(`Visual calculations can only refer to fields on the visual. Use [${n.col}] without a table name.`);
        const i = at.lv.names.findIndex(x => lower(x) === lower(n.col));
        if (i < 0) {
          // a group field that's collapsed at this level is blank
          if ([...this.rowGroups, ...this.colGroups].some(g => lower(this.groupName(g)) === lower(n.col))) return null;
          return err(`The field [${n.col}] isn't on the visual. Visual calculations can only use fields that are on the visual (hidden ones included).`);
        }
        if (at.set) return at.set.length === 1 ? at.lv.rows[at.set[0]][i] : null;
        return at.lv.rows[at.i][i];
      }
      case 'var': { const v2 = new Map(vars); for (const x of n.vars) v2.set(lower(x.name), this.eval(x.expr, at, v2)); return this.eval(n.ret, at, v2); }
      case 'un': { const v = this.eval(n.e, at, vars); if (n.op === 'NOT') return !truthy(v); return v === null ? null : -toNum(v); }
      case 'bin': {
        if (n.op === '&&') return truthy(this.eval(n.l, at, vars)) && truthy(this.eval(n.r, at, vars));
        if (n.op === '||') return truthy(this.eval(n.l, at, vars)) || truthy(this.eval(n.r, at, vars));
        return binop(n.op, this.eval(n.l, at, vars), this.eval(n.r, at, vars));
      }
      case 'tc': return err('Table constructors aren\'t supported in visual calculations.');
      case 'call': return this.call(n, at, vars);
    }
  }

  axisArg(a: DNode | undefined, dflt: Axis = 'ROWS'): Axis {
    if (!a || a.k === 'empty') return dflt;
    if (a.k === 'name' && /^(ROWS|COLUMNS|ROWS COLUMNS|COLUMNS ROWS)$/i.test(a.name)) return a.name.toUpperCase().startsWith('COL') ? 'COLUMNS' : 'ROWS';
    return err('The axis must be ROWS or COLUMNS.');
  }
  resetArg(a: DNode | undefined, axis: Axis): number {
    if (!a || a.k === 'empty') return 0;
    const depth = axis === 'ROWS' ? this.rowGroups.length : this.colGroups.length;
    if (a.k === 'name' && /^NONE$/i.test(a.name)) return 0;
    if (a.k === 'name' && /^HIGHESTPARENT$/i.test(a.name)) return 1;
    if (a.k === 'name' && /^LOWESTPARENT$/i.test(a.name)) return Math.max(0, depth - 1);
    if (a.k === 'num') return a.v >= 0 ? a.v : Math.max(0, depth + a.v);
    return 0;
  }
  /** Find an optional axis / reset argument by kind, since they're positional after optional numbers. */
  splitOpts(args: DNode[]) {
    const axis = args.find(a => a.k === 'name' && /^(ROWS|COLUMNS)$/i.test(a.name));
    const reset = args.find(a => a.k === 'name' && /^(NONE|HIGHESTPARENT|LOWESTPARENT)$/i.test(a.name));
    const nums = args.filter(a => a.k === 'num' || (a.k === 'un' && a.e.k === 'num'));
    return { axis, reset, nums };
  }

  call(n: DNode & { k: 'call' }, at: At, vars: Map<string, any>): any {
    const a = n.args;
    const ev = (x: DNode, where: At) => this.eval(x, where, vars);
    const over = (idx: number[], lv = at.lv) => idx.map(j => ev(a[0], { lv, i: j }));
    switch (n.fn) {
      case 'RUNNINGSUM': {
        const o = this.splitOpts(a.slice(1)); const axis = this.axisArg(o.axis); const part = this.partition(at, axis, this.resetArg(o.reset, axis));
        const upto = part.slice(0, part.indexOf(at.i) + 1);
        const vals = over(upto); return vals.every(v => v === null) ? null : vals.reduce((s, v) => s + (v === null ? 0 : toNum(v)), 0);
      }
      case 'MOVINGAVERAGE': {
        const w = Math.max(1, toNum(ev(a[1], at)));
        const includeCurrent = a[2] && a[2].k === 'bool' ? a[2].v : true;
        const o = this.splitOpts(a.slice(2)); const axis = this.axisArg(o.axis); const part = this.partition(at, axis, this.resetArg(o.reset, axis));
        const p = part.indexOf(at.i);
        const idx = includeCurrent ? part.slice(Math.max(0, p - w + 1), p + 1) : part.slice(Math.max(0, p - w), p);
        const vals = over(idx).filter(v => v !== null).map(toNum); return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }
      case 'PREVIOUS': case 'NEXT': {
        const o = this.splitOpts(a.slice(1)); const steps = o.nums.length ? Math.abs(toNum(ev(o.nums[0], at))) : 1;
        const axis = this.axisArg(o.axis); const part = this.partition(at, axis, this.resetArg(o.reset, axis));
        const j = part[part.indexOf(at.i) + (n.fn === 'PREVIOUS' ? -steps : steps)];
        return j === undefined ? null : ev(a[0], { lv: at.lv, i: j });
      }
      case 'FIRST': case 'LAST': {
        const o = this.splitOpts(a.slice(1)); const axis = this.axisArg(o.axis); const part = this.partition(at, axis, this.resetArg(o.reset, axis));
        const j = n.fn === 'FIRST' ? part[0] : part[part.length - 1];
        return j === undefined ? null : ev(a[0], { lv: at.lv, i: j });
      }
      case 'COLLAPSE': case 'COLLAPSEALL': {
        const m = this.move(at, this.axisArg(a[1]), n.fn === 'COLLAPSE' ? 'collapse' : 'collapseAll');
        return m.idx.length ? ev(a[0], { lv: m.lv, i: m.idx[0] }) : null;
      }
      case 'EXPAND': case 'EXPANDALL': {
        const m = this.move(at, this.axisArg(a[1]), n.fn === 'EXPAND' ? 'expand' : 'expandAll');
        if (!m.idx.length) return null;
        return ev(a[0], { lv: m.lv, i: m.idx[0], set: m.idx });
      }
      case 'ISATLEVEL': {
        if (a[0]?.k !== 'col') return err('ISATLEVEL expects a field on the visual, for example ISATLEVEL([Year]).');
        return at.lv.names.slice(0, at.lv.groups.length).some(x => lower(x) === lower((a[0] as any).col));
      }
      case 'ROWNUMBER': { const part = this.partition(at, 'ROWS', 0); return part.indexOf(at.i) + 1; }
      case 'SUM': case 'AVERAGE': case 'MIN': case 'MAX': case 'COUNT': case 'COUNTA': case 'COUNTROWS': {
        // inside EXPAND these aggregate the child rows; otherwise a field already has one value per cell
        const idx = at.set ?? [at.i];
        const vals = (n.fn === 'COUNTROWS' ? idx.map(() => 1) : idx.map(j => ev(a[0], { lv: at.lv, i: j }))).filter(v => v !== null);
        if (n.fn === 'COUNT' || n.fn === 'COUNTA' || n.fn === 'COUNTROWS') return vals.length;
        if (!vals.length) return null;
        const nums = vals.map(toNum);
        if (n.fn === 'SUM') return nums.reduce((s, v) => s + v, 0);
        if (n.fn === 'AVERAGE') return nums.reduce((s, v) => s + v, 0) / nums.length;
        return n.fn === 'MIN' ? Math.min(...nums) : Math.max(...nums);
      }
      case 'IF': { const c = truthy(ev(a[0], at)); return c ? ev(a[1], at) : a[2] ? ev(a[2], at) : null; }
      case 'SWITCH': {
        const x = ev(a[0], at);
        for (let k = 1; k + 1 < a.length; k += 2) { const cv = ev(a[k], at); if (x === true ? truthy(cv) : compareValues(x, cv) === 0) return ev(a[k + 1], at); }
        return a.length % 2 === 0 ? ev(a[a.length - 1], at) : null;
      }
    }
    // any other scalar DAX function: evaluate the arguments here, then call the engine
    const f = SCALAR[n.fn];
    if (!f) return err(`The function '${n.fn}' can't be used in a visual calculation.`);
    const ctx = emptyCtx();
    ctx.vars = new Map();
    const lits: DNode[] = a.map((x, k) => {
      if (x.k === 'empty') return x;
      if (x.k === 'name' && !vars.has(lower(x.name))) return x;
      const v = ev(x, at); const nm = `__vc${k}`; ctx.vars!.set(nm, v); return { k: 'name', name: nm };
    });
    return f(this.eng, lits, ctx);
  }
}

/** Templates offered by Power BI Desktop's visual calculation editor. */
export const VC_TEMPLATES: { name: string; expr: (f: string) => string; tip: string }[] = [
  { name: 'Running sum', expr: f => `RUNNINGSUM([${f}])`, tip: 'Adds up the values along the axis.' },
  { name: 'Moving average', expr: f => `MOVINGAVERAGE([${f}], 3)`, tip: 'Average over a window of rows.' },
  { name: 'Percent of parent', expr: f => `DIVIDE([${f}], COLLAPSE([${f}], ROWS))`, tip: 'Share of the value one level up the hierarchy.' },
  { name: 'Percent of grand total', expr: f => `DIVIDE([${f}], COLLAPSEALL([${f}], ROWS))`, tip: 'Share of the total.' },
  { name: 'Average of children', expr: f => `EXPAND(AVERAGE([${f}]), ROWS)`, tip: 'Average of the values one level down.' },
  { name: 'Versus previous', expr: f => `[${f}] - PREVIOUS([${f}])`, tip: 'Difference from the previous row.' },
  { name: 'Versus next', expr: f => `[${f}] - NEXT([${f}])`, tip: 'Difference from the next row.' },
  { name: 'Versus first', expr: f => `[${f}] - FIRST([${f}])`, tip: 'Difference from the first row.' },
  { name: 'Versus last', expr: f => `[${f}] - LAST([${f}])`, tip: 'Difference from the last row.' },
];
