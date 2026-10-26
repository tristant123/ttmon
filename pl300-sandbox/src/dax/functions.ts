// DAX function library.
import { DNode } from './parser';
import {
  DaxEngine, Ctx, VTable, VCol, SCALAR, TABLE, derr, truthy, toNum, toStr, daxEq, isTableExpr, tableToScalar,
  serialToDate, dateToSerial, emptyCtx, ColRef, Filter,
} from './engine';
import { isBlank, keyOf, tupleKey, compareValues, MTime, dateOnly, parseDate } from '../core/values';
import { formatValue, vbaNumberFormat, weekNum } from '../core/format';

type E = DaxEngine;
const S = (e: E, n: DNode, c: Ctx) => e.scalar(n, c);
const TB = (e: E, n: DNode, c: Ctx) => e.tableExpr(n, c);
const argc = (name: string, a: DNode[], min: number, max = min) => {
  const n = a.filter((x, i) => !(x.k === 'empty' && i === a.length - 1 && i >= min)).length;
  if (n < min || n > max) derr(`Too ${n < min ? 'few' : 'many'} arguments were passed to the ${name} function. The ${min === max ? '' : 'minimum '}argument count for the function is ${min}.`);
};
const fn = (name: string, f: (e: E, a: DNode[], c: Ctx) => any, min = 0, max = min) => {
  SCALAR[name] = (e, a, c) => { argc(name, a, min, max); return f(e, a, c); };
};
const tfn = (name: string, f: (e: E, a: DNode[], c: Ctx) => VTable, min = 0, max = min) => {
  TABLE[name] = (e, a, c) => { argc(name, a, min, max); return f(e, a, c); };
};
const opt = (e: E, a: DNode[], i: number, c: Ctx, d: any) => (a[i] === undefined || a[i].k === 'empty' ? d : S(e, a[i], c));
const nums = (vs: any[]) => vs.filter(v => !isBlank(v) && typeof v !== 'string' && typeof v !== 'boolean').map(toNum);

// ---------- aggregations ----------
function aggCol(name: string, f: (vs: any[]) => any) {
  fn(name, (e, a, c) => f(e.columnValues(a[0], c)), 1);
}
const sum = (vs: number[]) => (vs.length ? vs.reduce((x, y) => x + y, 0) : null);
const avg = (vs: number[]) => (vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null);
const variance = (vs: number[], sample: boolean) => { if (vs.length < (sample ? 2 : 1)) return null; const m = avg(vs)!; return vs.reduce((s, v) => s + (v - m) ** 2, 0) / (vs.length - (sample ? 1 : 0)); };
const median = (vs: number[]) => { if (!vs.length) return null; const s = [...vs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctInc = (vs: number[], k: number) => { if (!vs.length) return null; const s = [...vs].sort((a, b) => a - b); const r = k * (s.length - 1); const lo = Math.floor(r); return s[lo] + (r - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
const pctExc = (vs: number[], k: number) => { const s = [...vs].sort((a, b) => a - b); const r = k * (s.length + 1) - 1; if (r < 0 || r > s.length - 1) derr('PERCENTILE.EXC: k is out of range.'); const lo = Math.floor(r); return s[lo] + (r - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };
function minmax(vs: any[], dir: 1 | -1) {
  let best: any = null;
  for (const v of vs) { if (isBlank(v)) continue; if (best === null || compareValues(v, best) * dir > 0) best = v; }
  return best;
}
aggCol('SUM', vs => sum(nums(vs)));
aggCol('AVERAGE', vs => avg(nums(vs)));
aggCol('AVERAGEA', vs => avg(vs.filter(v => !isBlank(v)).map(v => (typeof v === 'string' ? 0 : toNum(v)))));
aggCol('MEDIAN', vs => median(nums(vs)));
aggCol('PRODUCT', vs => { const n = nums(vs); return n.length ? n.reduce((x, y) => x * y, 1) : null; });
aggCol('COUNT', vs => { const n = vs.filter(v => !isBlank(v) && (typeof v === 'number' || v instanceof Date)).length; return n || null; });
aggCol('COUNTA', vs => { const n = vs.filter(v => !isBlank(v)).length; return n || null; });
aggCol('COUNTBLANK', vs => { const n = vs.filter(v => isBlank(v) || v === '').length; return n || null; });
aggCol('DISTINCTCOUNT', vs => { const n = new Set(vs.map(keyOf)).size; return n || null; });
aggCol('DISTINCTCOUNTNOBLANK', vs => { const n = new Set(vs.filter(v => !isBlank(v)).map(keyOf)).size; return n || null; });
aggCol('STDEV.S', vs => { const v = variance(nums(vs), true); return v === null ? null : Math.sqrt(v); });
aggCol('STDEV.P', vs => { const v = variance(nums(vs), false); return v === null ? null : Math.sqrt(v); });
aggCol('VAR.S', vs => variance(nums(vs), true));
aggCol('VAR.P', vs => variance(nums(vs), false));
fn('MIN', (e, a, c) => {
  if (a.length === 2) { const x = S(e, a[0], c), y = S(e, a[1], c); if (isBlank(x)) return y; if (isBlank(y)) return x; return compareValues(x, y) <= 0 ? x : y; }
  return minmax(e.columnValues(a[0], c), -1);
}, 1, 2);
fn('MAX', (e, a, c) => {
  if (a.length === 2) { const x = S(e, a[0], c), y = S(e, a[1], c); if (isBlank(x)) return y; if (isBlank(y)) return x; return compareValues(x, y) >= 0 ? x : y; }
  return minmax(e.columnValues(a[0], c), 1);
}, 1, 2);
fn('MINA', (e, a, c) => minmax(e.columnValues(a[0], c).map(v => (typeof v === 'boolean' ? +v : v)), -1), 1);
fn('MAXA', (e, a, c) => minmax(e.columnValues(a[0], c).map(v => (typeof v === 'boolean' ? +v : v)), 1), 1);
fn('PERCENTILE.INC', (e, a, c) => pctInc(nums(e.columnValues(a[0], c)), toNum(S(e, a[1], c))), 2);
fn('PERCENTILE.EXC', (e, a, c) => pctExc(nums(e.columnValues(a[0], c)), toNum(S(e, a[1], c))), 2);
fn('COUNTROWS', (e, a, c) => { const n = a.length ? TB(e, a[0], c).rows.length : 0; return n || null; }, 0, 1);

// iterators
function iter(name: string, f: (vs: any[], e: E, a: DNode[], c: Ctx) => any, min = 2, max = 2) {
  fn(name, (e, a, c) => { const vs: any[] = []; e.iterate(a[0], a[1], c, v => vs.push(v)); return f(vs, e, a, c); }, min, max);
}
iter('SUMX', vs => sum(nums(vs)));
iter('AVERAGEX', vs => avg(nums(vs)));
iter('MEDIANX', vs => median(nums(vs)));
iter('PRODUCTX', vs => { const n = nums(vs); return n.length ? n.reduce((x, y) => x * y, 1) : null; });
iter('MINX', vs => minmax(vs, -1));
iter('MAXX', vs => minmax(vs, 1));
iter('COUNTX', vs => { const n = vs.filter(v => !isBlank(v) && (typeof v === 'number' || v instanceof Date)).length; return n || null; });
iter('COUNTAX', vs => { const n = vs.filter(v => !isBlank(v)).length; return n || null; });
iter('STDEVX.S', vs => { const v = variance(nums(vs), true); return v === null ? null : Math.sqrt(v); });
iter('STDEVX.P', vs => { const v = variance(nums(vs), false); return v === null ? null : Math.sqrt(v); });
iter('VARX.S', vs => variance(nums(vs), true));
iter('VARX.P', vs => variance(nums(vs), false));
iter('PERCENTILEX.INC', (vs, e, a, c) => pctInc(nums(vs), toNum(S(e, a[2], c))), 3, 3);
iter('PERCENTILEX.EXC', (vs, e, a, c) => pctExc(nums(vs), toNum(S(e, a[2], c))), 3, 3);
fn('CONCATENATEX', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const items: { v: any; o: any[] }[] = [];
  for (let i = 0; i < vt.rows.length; i++) {
    const rc: Ctx = { ...c, rows: [...c.rows, { vt, i }] };
    const o: any[] = [];
    for (let k = 3; k < a.length; k += 2) o.push(S(e, a[k], rc));
    items.push({ v: S(e, a[1], rc), o });
  }
  if (a.length > 3) {
    const dirs: number[] = []; for (let k = 4; k < a.length + 1; k += 2) dirs.push(a[k] && a[k].k === 'name' && (a[k] as any).name.toUpperCase() === 'DESC' ? -1 : 1);
    items.sort((x, y) => { for (let j = 0; j < x.o.length; j++) { const r = compareValues(x.o[j], y.o[j]) * (dirs[j] ?? 1); if (r) return r; } return 0; });
  }
  return items.map(x => toStr(x.v)).join(a[2] ? toStr(opt(e, a, 2, c, '')) : '');
}, 2, 20);

// ---------- CALCULATE family ----------
fn('CALCULATE', (e, a, c) => { const c2 = e.calcContext(a.slice(1), c); return S(e, a[0], c2); }, 1, 99);
tfn('CALCULATETABLE', (e, a, c) => { const c2 = e.calcContext(a.slice(1), c); return TB(e, a[0], c2); }, 1, 99);
tfn('FILTER', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const keep: number[] = [];
  for (let i = 0; i < vt.rows.length; i++) if (truthy(S(e, a[1], { ...c, rows: [...c.rows, { vt, i }] }))) keep.push(i);
  return new VTable(vt.cols, keep.map(i => vt.rows[i]), vt.base, vt.rowIdx ? keep.map(i => vt.rowIdx![i]) : undefined);
}, 2);
function allTable(e: E, a: DNode[], c: Ctx, name: string): VTable {
  if (!a.length) derr(`${name}() with no arguments can only be used as a CALCULATE filter modifier.`);
  const nc: Ctx = { ...c, filters: [], rows: [], cache: new Map() };
  if (a.length === 1 && a[0].k === 'name') return e.baseTable(e.tableName(a[0], c), nc);
  const cols = a.map(x => e.colRef(x));
  if (new Set(cols.map(x => x.t)).size > 1) derr(`All column arguments of ${name} must be from the same table.`);
  return new VTable(cols.map(x => ({ name: x.c, t: x.t, c: x.c })), e.distinctTuples(cols, nc));
}
tfn('ALL', (e, a, c) => allTable(e, a, c, 'ALL'), 0, 99);
tfn('ALLNOBLANKROW', (e, a, c) => allTable(e, a, c, 'ALLNOBLANKROW'), 0, 99);
tfn('REMOVEFILTERS', (e, a, c) => allTable(e, a, c, 'REMOVEFILTERS'), 0, 99);
tfn('ALLCROSSFILTERED', (e, a, c) => allTable(e, a, c, 'ALLCROSSFILTERED'), 1, 1);
tfn('ALLEXCEPT', (e, a, c) => {
  const c2 = e.calcContext([{ k: 'call', fn: 'ALLEXCEPT', args: a }], { ...c, rows: [] });
  return e.baseTable(e.tableName(a[0], c), c2);
}, 2, 99);
tfn('ALLSELECTED', (e, a, c) => {
  const sel: Ctx = { ...c, filters: c.selected ?? [], rows: [], cache: new Map() };
  if (!a.length) derr('ALLSELECTED() without arguments can only be used as a CALCULATE modifier.');
  if (a[0].k === 'name') return e.baseTable(e.tableName(a[0], c), sel);
  const cols = a.map(x => e.colRef(x));
  return new VTable(cols.map(x => ({ name: x.c, t: x.t, c: x.c })), e.distinctTuples(cols, sel));
}, 0, 99);
tfn('KEEPFILTERS', (e, a, c) => TB(e, a[0], c), 1);
function valuesOf(e: E, a: DNode[], c: Ctx): VTable {
  const n = a[0];
  if (n.k === 'col' && n.table && e.hasTable(n.table) && !c.vars?.has(n.table.toLowerCase())) {
    const cr = e.colRef(n);
    return new VTable([{ name: cr.c, t: cr.t, c: cr.c }], e.distinctTuples([cr], c));
  }
  const vt = TB(e, n, c);
  if (vt.base) return vt;
  return distinctRows(vt);
}
function distinctRows(vt: VTable) {
  const seen = new Set<string>(); const rows: any[][] = [];
  for (const r of vt.rows) { const k = tupleKey(r); if (!seen.has(k)) { seen.add(k); rows.push(r); } }
  return new VTable(vt.cols, rows);
}
tfn('VALUES', valuesOf, 1);
tfn('DISTINCT', (e, a, c) => { const v = valuesOf(e, a, c); return v.base ? distinctRows(new VTable(v.cols, v.rows)) : v; }, 1);
tfn('FILTERS', valuesOf, 1);
tfn('RELATEDTABLE', (e, a, c) => { const c2 = e.calcContext([], c); return e.baseTable(e.tableName(a[0], c), c2); }, 1);
fn('RELATED', (e, a, c) => e.related(e.colRef(a[0]), c), 1);
fn('EARLIER', (e, a, c) => {
  const n = toNum(opt(e, a, 1, c, 1));
  if (c.rows.length <= n) derr('EARLIER/EARLIEST refers to an earlier row context which doesn\'t exist.');
  return e.colValue(a[0] as any, { ...c, rows: c.rows.slice(0, c.rows.length - n) });
}, 1, 2);
fn('EARLIEST', (e, a, c) => { if (c.rows.length < 2) derr('EARLIEST refers to an earlier row context which doesn\'t exist.'); return e.colValue(a[0] as any, { ...c, rows: c.rows.slice(0, 1) }); }, 1);
fn('USERELATIONSHIP', () => derr('USERELATIONSHIP can only be used as a filter argument of CALCULATE or CALCULATETABLE.'), 2);
fn('CROSSFILTER', () => derr('CROSSFILTER can only be used as a filter argument of CALCULATE or CALCULATETABLE.'), 3);

// calculation group functions
fn('SELECTEDMEASURE', (e, _a, c) => { if (!c.selMeasure) derr('SELECTEDMEASURE can only be used in a calculation item expression.'); return e.evalMeasure(c.selMeasure!, c); }, 0);
fn('SELECTEDMEASURENAME', (_e, _a, c) => { if (!c.selMeasure) derr('SELECTEDMEASURENAME can only be used in a calculation item expression.'); return c.selMeasure!.name; }, 0);
fn('SELECTEDMEASUREFORMATSTRING', (_e, _a, c) => { if (!c.selMeasure) derr('SELECTEDMEASUREFORMATSTRING can only be used in a calculation item or a dynamic format string.'); return c.selMeasure!.formatString ?? ''; }, 0);
fn('ISSELECTEDMEASURE', (_e, a, c) => {
  if (!c.selMeasure) derr('ISSELECTEDMEASURE can only be used in a calculation item expression.');
  return a.some(x => x.k === 'col' && x.col.toLowerCase() === c.selMeasure!.name.toLowerCase());
}, 1, 99);

fn('SELECTEDVALUE', (e, a, c) => { const v = valuesOf(e, [a[0]], c); return v.rows.length === 1 ? v.rows[0][0] : opt(e, a, 1, c, null); }, 1, 2);
fn('HASONEVALUE', (e, a, c) => valuesOf(e, [a[0]], c).rows.length === 1, 1);
fn('HASONEFILTER', (e, a, c) => {
  const cr = e.colRef(a[0]);
  const direct = c.filters.filter(f => e.filterCols(f).some(x => x.t === cr.t && x.c === cr.c));
  if (!direct.length) return false;
  return valuesOf(e, [a[0]], c).rows.length === 1;
}, 1);
fn('ISFILTERED', (e, a, c) => {
  if (a[0].k === 'name') { const t = e.tableName(a[0], c); return c.filters.some(f => e.filterCols(f).some(x => x.t === t)); }
  const cr = e.colRef(a[0]);
  return c.filters.some(f => e.filterCols(f).some(x => x.t === cr.t && x.c === cr.c));
}, 1);
fn('ISCROSSFILTERED', (e, a, c) => {
  const t = a[0].k === 'name' ? e.tableName(a[0], c) : e.colRef(a[0]).t;
  return e.isFiltered(t, c);
}, 1);
fn('ISINSCOPE', (e, a, c) => { const cr = e.colRef(a[0]); return !!c.scope?.has(`${cr.t}|${cr.c}`.toLowerCase()) && valuesOf(e, [a[0]], c).rows.length === 1; }, 1);
fn('ISEMPTY', (e, a, c) => TB(e, a[0], c).rows.length === 0, 1);
fn('CONTAINS', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const pairs: { i: number; v: any }[] = [];
  for (let k = 1; k < a.length; k += 2) {
    const cn = a[k] as any; const i = vt.colIndex(cn.table && e.hasTable(cn.table) ? e.table(cn.table).name : cn.table, cn.col);
    if (i < 0) derr('CONTAINS: the column must belong to the table in the first argument.');
    pairs.push({ i, v: S(e, a[k + 1], c) });
  }
  return vt.rows.some(r => pairs.every(p => daxEq(r[p.i], p.v)));
}, 3, 99);
fn('CONTAINSROW', (e, a, c) => { const vt = TB(e, a[0], c); const vs = a.slice(1).map(x => S(e, x, c)); return vt.rows.some(r => vs.every((v, i) => daxEq(r[i], v))); }, 2, 99);
fn('LOOKUPVALUE', (e, a, c) => {
  const res = e.colRef(a[0]); const tab = e.table(res.t);
  const ri = e.colIdx(res.t, res.c);
  const conds: { i: number; v: any }[] = [];
  let k = 1;
  for (; k + 1 < a.length; k += 2) { const cr = e.colRef(a[k]); if (cr.t !== res.t) derr('LOOKUPVALUE search columns must be in the same table as the result column.'); conds.push({ i: e.colIdx(cr.t, cr.c), v: S(e, a[k + 1], c) }); }
  const alt = k < a.length ? S(e, a[k], c) : null;
  const found = new Map<string, any>();
  for (const r of tab.rows) if (conds.every(p => daxEq(r[p.i], p.v))) found.set(keyOf(r[ri]), r[ri]);
  if (found.size > 1) derr('A table of multiple values was supplied where a single value was expected. (LOOKUPVALUE found more than one distinct result.)');
  return found.size ? [...found.values()][0] : alt;
}, 3, 99);

fn('RANKX', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const vals: any[] = [];
  for (let i = 0; i < vt.rows.length; i++) vals.push(S(e, a[1], { ...c, rows: [...c.rows, { vt, i }] }));
  const v = a[2] && a[2].k !== 'empty' ? S(e, a[2], c) : S(e, a[1], c);
  const ordNode = a[3];
  const asc = ordNode && ordNode.k === 'name' ? ordNode.name.toUpperCase() === 'ASC' : ordNode && ordNode.k !== 'empty' ? toNum(S(e, ordNode, c)) === 1 : false;
  const dense = a[4] && a[4].k === 'name' && a[4].name.toUpperCase() === 'DENSE';
  if (isBlank(v)) return null;
  const better = (x: any) => (asc ? toNum(x) < toNum(v) : toNum(x) > toNum(v));
  const cands = vals.filter(x => !isBlank(x));
  if (dense) return new Set(cands.filter(better).map(keyOf)).size + 1;
  return cands.filter(better).length + 1;
}, 2, 5);

// ---------- logical ----------
fn('IF', (e, a, c) => (truthy(S(e, a[0], c)) ? opt(e, a, 1, c, null) : opt(e, a, 2, c, null)), 2, 3);
fn('IF.EAGER', (e, a, c) => { const t = opt(e, a, 1, c, null), f = opt(e, a, 2, c, null); return truthy(S(e, a[0], c)) ? t : f; }, 2, 3);
fn('SWITCH', (e, a, c) => {
  const v = S(e, a[0], c);
  for (let i = 1; i + 1 < a.length; i += 2) if (daxEq(v, S(e, a[i], c)) && !(isBlank(v) !== isBlank(S(e, a[i], c)) && typeof v === 'boolean')) return S(e, a[i + 1], c);
  return a.length % 2 === 0 ? S(e, a[a.length - 1], c) : null;
}, 3, 999);
fn('AND', (e, a, c) => truthy(S(e, a[0], c)) && truthy(S(e, a[1], c)), 2);
fn('OR', (e, a, c) => truthy(S(e, a[0], c)) || truthy(S(e, a[1], c)), 2);
fn('NOT', (e, a, c) => !truthy(S(e, a[0], c)), 1);
fn('TRUE', () => true); fn('FALSE', () => false);
fn('BLANK', () => null);
fn('ISBLANK', (e, a, c) => isBlank(S(e, a[0], c)), 1);
fn('ISERROR', (e, a, c) => { try { const v = S(e, a[0], c); return typeof v === 'number' && !isFinite(v); } catch { return true; } }, 1);
fn('IFERROR', (e, a, c) => { try { const v = S(e, a[0], c); if (typeof v === 'number' && !isFinite(v)) return S(e, a[1], c); return v; } catch { return S(e, a[1], c); } }, 2);
fn('ISNUMBER', (e, a, c) => typeof S(e, a[0], c) === 'number', 1);
fn('ISTEXT', (e, a, c) => typeof S(e, a[0], c) === 'string', 1);
fn('ISNONTEXT', (e, a, c) => typeof S(e, a[0], c) !== 'string', 1);
fn('ISLOGICAL', (e, a, c) => typeof S(e, a[0], c) === 'boolean', 1);
fn('ISEVEN', (e, a, c) => Math.trunc(toNum(S(e, a[0], c))) % 2 === 0, 1);
fn('ISODD', (e, a, c) => Math.abs(Math.trunc(toNum(S(e, a[0], c))) % 2) === 1, 1);
fn('COALESCE', (e, a, c) => { for (const x of a) { const v = S(e, x, c); if (!isBlank(v)) return v; } return null; }, 2, 99);
fn('ERROR', (e, a, c) => derr(toStr(S(e, a[0], c))), 1);

// ---------- math ----------
const num1 = (name: string, f: (x: number) => number) => fn(name, (e, a, c) => { const v = S(e, a[0], c); return isBlank(v) && name !== 'INT' ? (['ABS', 'SIGN', 'SQRT'].includes(name) ? null : f(0)) : f(toNum(v)); }, 1);
fn('DIVIDE', (e, a, c) => { const n = S(e, a[0], c), d = S(e, a[1], c); if (isBlank(d) || toNum(d) === 0) return opt(e, a, 2, c, null); if (isBlank(n)) return null; return toNum(n) / toNum(d); }, 2, 3);
num1('ABS', Math.abs); num1('SQRT', Math.sqrt); num1('EXP', Math.exp); num1('LN', Math.log); num1('LOG10', Math.log10);
num1('SIGN', Math.sign); num1('INT', Math.floor); num1('FACT', x => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; });
num1('EVEN', x => { const r = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -r : r; });
num1('ODD', x => { let r = Math.ceil(Math.abs(x)); if (r % 2 === 0) r++; return x < 0 ? -r : r; });
num1('RADIANS', x => (x * Math.PI) / 180); num1('DEGREES', x => (x * 180) / Math.PI);
num1('SIN', Math.sin); num1('COS', Math.cos); num1('TAN', Math.tan);
fn('LOG', (e, a, c) => Math.log(toNum(S(e, a[0], c))) / Math.log(toNum(opt(e, a, 1, c, 10))), 1, 2);
fn('PI', () => Math.PI);
const roundAway = (x: number, d: number) => { const f = 10 ** d; return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f; };
fn('ROUND', (e, a, c) => roundAway(toNum(S(e, a[0], c)), toNum(opt(e, a, 1, c, 0))), 1, 2);
fn('ROUNDUP', (e, a, c) => { const f = 10 ** toNum(opt(e, a, 1, c, 0)); const x = toNum(S(e, a[0], c)); return Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9) / f; }, 1, 2);
fn('ROUNDDOWN', (e, a, c) => { const f = 10 ** toNum(opt(e, a, 1, c, 0)); const x = toNum(S(e, a[0], c)); return Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9) / f; }, 1, 2);
fn('TRUNC', (e, a, c) => { const f = 10 ** toNum(opt(e, a, 1, c, 0)); return Math.trunc(toNum(S(e, a[0], c)) * f) / f; }, 1, 2);
fn('MOD', (e, a, c) => { const n = toNum(S(e, a[0], c)), d = toNum(S(e, a[1], c)); if (d === 0) derr('MOD: division by zero.'); return n - d * Math.floor(n / d); }, 2);
fn('QUOTIENT', (e, a, c) => Math.trunc(toNum(S(e, a[0], c)) / toNum(S(e, a[1], c))), 2);
fn('POWER', (e, a, c) => Math.pow(toNum(S(e, a[0], c)), toNum(S(e, a[1], c))), 2);
fn('CEILING', (e, a, c) => { const s = toNum(opt(e, a, 1, c, 1)); return s ? Math.ceil(toNum(S(e, a[0], c)) / s) * s : 0; }, 1, 2);
fn('ISO.CEILING', (e, a, c) => { const s = Math.abs(toNum(opt(e, a, 1, c, 1))); return s ? Math.ceil(toNum(S(e, a[0], c)) / s) * s : 0; }, 1, 2);
fn('FLOOR', (e, a, c) => { const s = toNum(S(e, a[1], c)); return s ? Math.floor(toNum(S(e, a[0], c)) / s) * s : 0; }, 2);
fn('MROUND', (e, a, c) => { const s = toNum(S(e, a[1], c)); return s ? Math.round(toNum(S(e, a[0], c)) / s) * s : 0; }, 2);
fn('RAND', () => Math.random());
fn('RANDBETWEEN', (e, a, c) => { const lo = toNum(S(e, a[0], c)), hi = toNum(S(e, a[1], c)); return Math.floor(lo + Math.random() * (hi - lo + 1)); }, 2);
fn('GCD', (e, a, c) => { let x = Math.abs(toNum(S(e, a[0], c))), y = Math.abs(toNum(S(e, a[1], c))); while (y) [x, y] = [y, x % y]; return x; }, 2);
fn('LCM', (e, a, c) => { const x = toNum(S(e, a[0], c)), y = toNum(S(e, a[1], c)); let p = x, q = y; while (q) [p, q] = [q, p % q]; return Math.abs(x * y) / p; }, 2);
fn('CURRENCY', (e, a, c) => Math.round(toNum(S(e, a[0], c)) * 10000) / 10000, 1);
fn('VALUE', (e, a, c) => { const v = S(e, a[0], c); if (typeof v === 'number') return v; const s = toStr(v).trim(); const d = parseDate(s); if (d && !/^[\d.,$%-]+$/.test(s)) return dateToSerial(d); const n = Number(s.replace(/[$,]/g, '').replace(/%$/, '')); if (isNaN(n) || s === '') derr(`Cannot convert value '${s}' of type Text to type Number.`); return s.endsWith('%') ? n / 100 : n; }, 1);
fn('CONVERT', (e, a, c) => {
  const v = S(e, a[0], c); const t = a[1].k === 'name' ? a[1].name.toUpperCase() : '';
  switch (t) {
    case 'INTEGER': return Math.round(toNum(v));
    case 'DOUBLE': case 'CURRENCY': case 'DECIMAL': return toNum(v);
    case 'STRING': return toStr(v);
    case 'BOOLEAN': return truthy(v);
    case 'DATETIME': return v instanceof Date ? v : typeof v === 'number' ? serialToDate(v) : parseDate(toStr(v)) ?? derr(`Cannot convert '${v}' to DATETIME.`);
  }
  return derr('CONVERT: unknown data type. Use INTEGER, DOUBLE, STRING, BOOLEAN, CURRENCY or DATETIME.');
}, 2);
fn('FIXED', (e, a, c) => { const d = toNum(opt(e, a, 1, c, 2)); const nc = truthy(opt(e, a, 2, c, false)); return vbaNumberFormat(toNum(S(e, a[0], c)), (nc ? '0' : '#,##0') + (d > 0 ? '.' + '0'.repeat(d) : '')); }, 1, 3);

// ---------- text ----------
const txt = (e: E, a: DNode[], i: number, c: Ctx) => toStr(S(e, a[i], c));
fn('FORMAT', (e, a, c) => { const v = S(e, a[0], c); if (isBlank(v)) return ''; return formatValue(v, toStr(S(e, a[1], c))); }, 2, 3);
fn('CONCATENATE', (e, a, c) => txt(e, a, 0, c) + txt(e, a, 1, c), 2);
fn('COMBINEVALUES', (e, a, c) => a.slice(1).map((_x, i) => txt(e, a, i + 1, c)).join(txt(e, a, 0, c)), 3, 99);
fn('LEFT', (e, a, c) => txt(e, a, 0, c).slice(0, toNum(opt(e, a, 1, c, 1))), 1, 2);
fn('RIGHT', (e, a, c) => { const n = toNum(opt(e, a, 1, c, 1)); const s = txt(e, a, 0, c); return n ? s.slice(-n) : ''; }, 1, 2);
fn('MID', (e, a, c) => { const s = txt(e, a, 0, c); const st = toNum(S(e, a[1], c)); return s.slice(st - 1, st - 1 + toNum(S(e, a[2], c))); }, 3);
fn('LEN', (e, a, c) => txt(e, a, 0, c).length, 1);
fn('UPPER', (e, a, c) => txt(e, a, 0, c).toUpperCase(), 1);
fn('LOWER', (e, a, c) => txt(e, a, 0, c).toLowerCase(), 1);
fn('TRIM', (e, a, c) => txt(e, a, 0, c).trim().replace(/ {2,}/g, ' '), 1);
fn('SUBSTITUTE', (e, a, c) => {
  const s = txt(e, a, 0, c), o = txt(e, a, 1, c), n = txt(e, a, 2, c);
  if (a[3]) { const k = toNum(S(e, a[3], c)); let i = -1; for (let j = 0; j < k; j++) { i = s.indexOf(o, i + 1); if (i < 0) return s; } return s.slice(0, i) + n + s.slice(i + o.length); }
  return o ? s.split(o).join(n) : s;
}, 3, 4);
fn('REPLACE', (e, a, c) => { const s = txt(e, a, 0, c); const st = toNum(S(e, a[1], c)) - 1; return s.slice(0, st) + txt(e, a, 3, c) + s.slice(st + toNum(S(e, a[2], c))); }, 4);
const wild = (p: string) => new RegExp(p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/(?<!~)\*/g, '.*').replace(/(?<!~)\?/g, '.').replace(/~([*?])/g, '\\$1'), 'i');
fn('SEARCH', (e, a, c) => {
  const f = txt(e, a, 0, c), s = txt(e, a, 1, c); const st = toNum(opt(e, a, 2, c, 1)) - 1;
  const m = wild(f).exec(s.slice(st));
  if (!m) { if (a.length >= 4) return S(e, a[3], c); derr(`The search Text provided to function 'SEARCH' could not be found in the given text.`); }
  return st + m!.index + 1;
}, 2, 4);
fn('FIND', (e, a, c) => {
  const f = txt(e, a, 0, c), s = txt(e, a, 1, c); const st = toNum(opt(e, a, 2, c, 1)) - 1;
  const i = s.indexOf(f, st);
  if (i < 0) { if (a.length >= 4) return S(e, a[3], c); derr(`The search Text provided to function 'FIND' could not be found in the given text.`); }
  return i + 1;
}, 2, 4);
fn('CONTAINSSTRING', (e, a, c) => wild(txt(e, a, 1, c)).test(txt(e, a, 0, c)), 2);
fn('CONTAINSSTRINGEXACT', (e, a, c) => txt(e, a, 0, c).includes(txt(e, a, 1, c)), 2);
fn('EXACT', (e, a, c) => txt(e, a, 0, c) === txt(e, a, 1, c), 2);
fn('REPT', (e, a, c) => txt(e, a, 0, c).repeat(Math.max(0, toNum(S(e, a[1], c)))), 2);
fn('UNICHAR', (e, a, c) => String.fromCodePoint(toNum(S(e, a[0], c))), 1);
fn('UNICODE', (e, a, c) => txt(e, a, 0, c).codePointAt(0) ?? null, 1);
fn('BLANK', () => null);

// ---------- dates ----------
const dt = (e: E, a: DNode[], i: number, c: Ctx): Date | null => {
  const v = S(e, a[i], c);
  if (isBlank(v)) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') return serialToDate(v);
  if (typeof v === 'string') { const d = parseDate(v); if (d) return d; }
  return derr(`Cannot convert value '${v}' to type Date.`);
};
const dpart = (name: string, f: (d: Date) => number) => fn(name, (e, a, c) => { const d = dt(e, a, 0, c); return d ? f(d) : null; }, 1);
dpart('YEAR', d => d.getFullYear()); dpart('MONTH', d => d.getMonth() + 1); dpart('DAY', d => d.getDate());
dpart('HOUR', d => d.getHours()); dpart('MINUTE', d => d.getMinutes()); dpart('SECOND', d => d.getSeconds());
dpart('QUARTER', d => Math.floor(d.getMonth() / 3) + 1);
fn('DATE', (e, a, c) => new Date(toNum(S(e, a[0], c)), toNum(S(e, a[1], c)) - 1, toNum(S(e, a[2], c))), 3);
fn('TIME', (e, a, c) => { const h = toNum(S(e, a[0], c)), m = toNum(S(e, a[1], c)), s = toNum(S(e, a[2], c)); return new Date(1899, 11, 30, h, m, s); }, 3);
fn('DATEVALUE', (e, a, c) => { const d = parseDate(txt(e, a, 0, c)); if (!d) derr(`Cannot convert '${txt(e, a, 0, c)}' to a date.`); return dateOnly(d!); }, 1);
fn('TIMEVALUE', (e, a, c) => { const s = txt(e, a, 0, c); const d = parseDate('2000-01-01 ' + s) ?? parseDate(s); if (!d) derr('Cannot convert to a time.'); return new Date(1899, 11, 30, d!.getHours(), d!.getMinutes(), d!.getSeconds()); }, 1);
fn('TODAY', () => dateOnly(new Date())); fn('NOW', () => new Date()); fn('UTCNOW', () => new Date()); fn('UTCTODAY', () => dateOnly(new Date()));
fn('WEEKDAY', (e, a, c) => { const d = dt(e, a, 0, c); if (!d) return null; const rt = toNum(opt(e, a, 1, c, 1)); const w = d.getDay(); return rt === 2 ? ((w + 6) % 7) + 1 : rt === 3 ? (w + 6) % 7 : w + 1; }, 1, 2);
fn('WEEKNUM', (e, a, c) => { const d = dt(e, a, 0, c); if (!d) return null; const rt = toNum(opt(e, a, 1, c, 1)); return weekNum(d, rt === 2 ? 1 : 0); }, 1, 2);
function addMonths(d: Date, n: number) { const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds()); r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return r; }
fn('EDATE', (e, a, c) => { const d = dt(e, a, 0, c); return d ? addMonths(dateOnly(d), Math.trunc(toNum(S(e, a[1], c)))) : null; }, 2);
fn('EOMONTH', (e, a, c) => { const d = dt(e, a, 0, c); if (!d) return null; const n = Math.trunc(toNum(S(e, a[1], c))); return new Date(d.getFullYear(), d.getMonth() + n + 1, 0); }, 2);
fn('DATEDIFF', (e, a, c) => {
  const d1 = dt(e, a, 0, c), d2 = dt(e, a, 1, c); if (!d1 || !d2) return null;
  const u = a[2].k === 'name' ? a[2].name.toUpperCase() : 'DAY';
  const days = Math.round((dateOnly(d2).getTime() - dateOnly(d1).getTime()) / 86400000);
  switch (u) {
    case 'SECOND': return Math.round((d2.getTime() - d1.getTime()) / 1000);
    case 'MINUTE': return Math.floor(d2.getTime() / 60000) - Math.floor(d1.getTime() / 60000);
    case 'HOUR': return Math.floor(d2.getTime() / 3600000) - Math.floor(d1.getTime() / 3600000);
    case 'DAY': return days;
    case 'WEEK': return Math.floor((dateOnly(d2).getTime() - d2.getDay() * 86400000 - (dateOnly(d1).getTime() - d1.getDay() * 86400000)) / (7 * 86400000));
    case 'MONTH': return (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth();
    case 'QUARTER': return (d2.getFullYear() - d1.getFullYear()) * 4 + Math.floor(d2.getMonth() / 3) - Math.floor(d1.getMonth() / 3);
    case 'YEAR': return d2.getFullYear() - d1.getFullYear();
  }
  return derr('DATEDIFF interval must be SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER or YEAR.');
}, 3);
fn('YEARFRAC', (e, a, c) => { const d1 = dt(e, a, 0, c)!, d2 = dt(e, a, 1, c)!; return Math.abs(d2.getTime() - d1.getTime()) / (365.25 * 86400000); }, 2, 3);
fn('NETWORKDAYS', (e, a, c) => { let d1 = dateOnly(dt(e, a, 0, c)!); const d2 = dateOnly(dt(e, a, 1, c)!); let n = 0; const sgn = d2 >= d1 ? 1 : -1; while (sgn > 0 ? d1 <= d2 : d1 >= d2) { if (d1.getDay() % 6) n++; d1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate() + sgn); } return n * sgn; }, 2, 4);

// ---------- information / security ----------
fn('USERPRINCIPALNAME', e => e.userName); fn('USERNAME', e => e.userName); fn('USEROBJECTID', () => '00000000-0000-0000-0000-000000000001'); fn('CUSTOMDATA', () => null);
fn('PATH', (e, a, c) => {
  const id = S(e, a[0], c); const idc = e.colRef(a[0]), pc = e.colRef(a[1]);
  const tab = e.table(idc.t); const ii = e.colIdx(idc.t, idc.c), pi = e.colIdx(pc.t, pc.c);
  const parent = new Map<string, any>(); for (const r of tab.rows) parent.set(keyOf(r[ii]), r[pi]);
  const out: any[] = []; let cur = id; const seen = new Set<string>();
  while (!isBlank(cur) && cur !== '') { if (seen.has(keyOf(cur))) derr('PATH: the parent-child hierarchy has a loop.'); seen.add(keyOf(cur)); out.unshift(cur); cur = parent.get(keyOf(cur)); }
  return out.map(toStr).join('|');
}, 2);
fn('PATHLENGTH', (e, a, c) => { const s = txt(e, a, 0, c); return s ? s.split('|').length : 0; }, 1);
fn('PATHITEM', (e, a, c) => { const p = txt(e, a, 0, c).split('|'); const v = p[toNum(S(e, a[1], c)) - 1]; if (v === undefined) return null; return toNum(opt(e, a, 2, c, 0)) === 1 ? Number(v) : v; }, 2, 3);
fn('PATHITEMREVERSE', (e, a, c) => { const p = txt(e, a, 0, c).split('|').reverse(); const v = p[toNum(S(e, a[1], c)) - 1]; return v ?? null; }, 2, 3);
fn('PATHCONTAINS', (e, a, c) => txt(e, a, 0, c).split('|').includes(txt(e, a, 1, c)), 2);

// ---------- table constructors ----------
const lin = (cr: ColRef): VCol => ({ name: cr.c, t: cr.t, c: cr.c });
tfn('SUMMARIZE', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const groups: DNode[] = []; let k = 1;
  while (k < a.length && a[k].k === 'col') groups.push(a[k++]);
  const ext: { name: string; node: DNode }[] = [];
  for (; k + 1 < a.length; k += 2) ext.push({ name: toStr(S(e, a[k], c)), node: a[k + 1] });
  const gcols = groups.map(g => { const n = g as any; return n.table && e.hasTable(n.table) ? e.canon(n.table, n.col) : { t: '', c: n.col }; });
  const map = new Map<string, { tuple: any[]; rows: number[] }>();
  for (let i = 0; i < vt.rows.length; i++) {
    const rc: Ctx = { ...c, rows: [...c.rows, { vt, i }] };
    const tuple = gcols.map((g, j) => { const di = vt.colIndex(g.t || undefined, g.c); return di >= 0 ? vt.rows[i][di] : e.related(e.colRef(groups[j]), rc); });
    const key = tupleKey(tuple);
    let g = map.get(key); if (!g) { g = { tuple, rows: [] }; map.set(key, g); }
    g.rows.push(vt.rowIdx ? vt.rowIdx[i] : i);
  }
  const rows: any[][] = [];
  for (const g of map.values()) {
    if (!ext.length) { rows.push(g.tuple); continue; }
    let filters = c.filters;
    if (vt.base) filters = e.applyFilter(filters, { kind: 'rows', t: vt.base, rows: new Set(g.rows), expanded: false }, false);
    const gf = e.filterFromTable(new VTable(gcols.map(lin), [g.tuple]));
    if (gf) filters = e.applyFilter(filters, gf, false);
    const gc: Ctx = { ...c, filters, rows: [], cache: new Map() };
    rows.push([...g.tuple, ...ext.map(x => S(e, x.node, gc))]);
  }
  return new VTable([...gcols.map(lin), ...ext.map(x => ({ name: x.name }))], rows);
}, 1, 99);
tfn('ADDCOLUMNS', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const ext: { name: string; node: DNode }[] = [];
  for (let k = 1; k + 1 < a.length; k += 2) ext.push({ name: toStr(S(e, a[k], c)), node: a[k + 1] });
  const rows = vt.rows.map((r, i) => { const rc: Ctx = { ...c, rows: [...c.rows, { vt, i }] }; return [...r, ...ext.map(x => S(e, x.node, rc))]; });
  return new VTable([...vt.cols, ...ext.map(x => ({ name: x.name }))], rows, vt.base, vt.rowIdx);
}, 3, 99);
tfn('SELECTCOLUMNS', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const ext: { name: string; node: DNode }[] = [];
  for (let k = 1; k < a.length; k += 2) {
    if (a[k].k === 'col' && (k + 1 >= a.length || a[k + 1].k === 'col' || a[k + 1].k === 'str')) { const n = a[k] as any; ext.push({ name: n.col, node: a[k] }); k--; continue; }
    ext.push({ name: toStr(S(e, a[k], c)), node: a[k + 1] });
  }
  const cols: VCol[] = ext.map(x => {
    if (x.node.k === 'col') { const n = x.node; const i = vt.colIndex(n.table && e.hasTable(n.table) ? e.table(n.table).name : n.table, n.col); if (i >= 0) return { ...vt.cols[i], name: x.name }; }
    return { name: x.name };
  });
  const rows = vt.rows.map((_r, i) => { const rc: Ctx = { ...c, rows: [...c.rows, { vt, i }] }; return ext.map(x => S(e, x.node, rc)); });
  return new VTable(cols, rows);
}, 2, 99);
tfn('TOPN', (e, a, c) => {
  const n = toNum(S(e, a[0], c));
  const vt = TB(e, a[1], c);
  if (!n || n < 1) return new VTable(vt.cols, []);
  const keys: { node: DNode; desc: boolean }[] = [];
  for (let k = 2; k < a.length; k += 2) {
    const o = a[k + 1];
    const desc = !o || o.k === 'empty' ? true : o.k === 'name' ? o.name.toUpperCase() !== 'ASC' : toNum(S(e, o, c)) === 0;
    keys.push({ node: a[k], desc });
  }
  const scored = vt.rows.map((r, i) => ({ r, i, s: keys.map(k => S(e, k.node, { ...c, rows: [...c.rows, { vt, i }] })) }));
  if (keys.length) scored.sort((x, y) => { for (let j = 0; j < keys.length; j++) { const d = compareValues(x.s[j], y.s[j]) * (keys[j].desc ? -1 : 1); if (d) return d; } return 0; });
  let cut = Math.min(n, scored.length);
  while (keys.length && cut < scored.length && scored[cut].s.every((v, j) => keyOf(v) === keyOf(scored[cut - 1].s[j]))) cut++;
  const top = scored.slice(0, cut);
  return new VTable(vt.cols, top.map(x => x.r), vt.base, vt.rowIdx ? top.map(x => vt.rowIdx![x.i]) : undefined);
}, 2, 99);
tfn('CROSSJOIN', (e, a, c) => {
  let res = TB(e, a[0], c);
  for (let k = 1; k < a.length; k++) { const b = TB(e, a[k], c); const rows: any[][] = []; for (const x of res.rows) for (const y of b.rows) rows.push([...x, ...y]); res = new VTable([...res.cols, ...b.cols], rows); }
  return new VTable(res.cols, res.rows);
}, 2, 99);
tfn('UNION', (e, a, c) => {
  const ts = a.map(x => TB(e, x, c));
  const w = ts[0].cols.length;
  if (ts.some(t => t.cols.length !== w)) derr('Each table argument of UNION must have the same number of columns.');
  const cols = ts[0].cols.map((col, i) => ts.every(t => t.cols[i].t === col.t && t.cols[i].c === col.c) ? col : { name: col.name });
  return new VTable(cols, ts.flatMap(t => t.rows));
}, 2, 99);
tfn('INTERSECT', (e, a, c) => { const x = TB(e, a[0], c), y = TB(e, a[1], c); const ks = new Set(y.rows.map(tupleKey)); return new VTable(x.cols, x.rows.filter(r => ks.has(tupleKey(r)))); }, 2);
tfn('EXCEPT', (e, a, c) => { const x = TB(e, a[0], c), y = TB(e, a[1], c); const ks = new Set(y.rows.map(tupleKey)); return new VTable(x.cols, x.rows.filter(r => !ks.has(tupleKey(r)))); }, 2);
tfn('NATURALINNERJOIN', (e, a, c) => joinTables(TB(e, a[0], c), TB(e, a[1], c), false), 2);
tfn('NATURALLEFTOUTERJOIN', (e, a, c) => joinTables(TB(e, a[0], c), TB(e, a[1], c), true), 2);
function joinTables(x: VTable, y: VTable, left: boolean) {
  const common = x.cols.map((col, i) => ({ i, j: y.cols.findIndex(d => (col.t && d.t === col.t && d.c === col.c) || (!col.t && d.name === col.name)) })).filter(p => p.j >= 0);
  if (!common.length) derr('No common join columns detected. The join function requires at least one common join column.');
  const rest = y.cols.map((_, j) => j).filter(j => !common.some(p => p.j === j));
  const rows: any[][] = [];
  for (const r of x.rows) {
    const m = y.rows.filter(s => common.every(p => keyOf(r[p.i]) === keyOf(s[p.j])));
    if (m.length) for (const s of m) rows.push([...r, ...rest.map(j => s[j])]); else if (left) rows.push([...r, ...rest.map(() => null)]);
  }
  return new VTable([...x.cols, ...rest.map(j => y.cols[j])], rows);
}
tfn('GENERATE', (e, a, c) => generate(e, a, c, false), 2);
tfn('GENERATEALL', (e, a, c) => generate(e, a, c, true), 2);
function generate(e: E, a: DNode[], c: Ctx, all: boolean) {
  const x = TB(e, a[0], c); let cols: VCol[] | null = null; const rows: any[][] = [];
  for (let i = 0; i < x.rows.length; i++) {
    const y = TB(e, a[1], { ...c, rows: [...c.rows, { vt: x, i }] });
    cols ??= y.cols;
    if (!y.rows.length && all) rows.push([...x.rows[i], ...y.cols.map(() => null)]);
    for (const r of y.rows) rows.push([...x.rows[i], ...r]);
  }
  return new VTable([...x.cols, ...(cols ?? [])], rows);
}
tfn('ROW', (e, a, c) => {
  const cols: VCol[] = []; const vals: any[] = [];
  for (let k = 0; k + 1 < a.length; k += 2) { cols.push({ name: toStr(S(e, a[k], c)) }); vals.push(S(e, a[k + 1], c)); }
  return new VTable(cols, [vals]);
}, 2, 99);
tfn('DATATABLE', (e, a, c) => {
  const cols: VCol[] = []; const types: string[] = [];
  let k = 0;
  for (; k + 1 < a.length && a[k].k === 'str'; k += 2) { cols.push({ name: (a[k] as any).v }); types.push(a[k + 1].k === 'name' ? (a[k + 1] as any).name.toUpperCase() : 'STRING'); }
  const data = a[k];
  if (!data || data.k !== 'tc') derr('DATATABLE requires the data as a list of rows: {{…},{…}}.');
  const rows = (data as any).rows.map((r: DNode[]) => {
    const flat = r.length === 1 && r[0].k === 'tc' ? (r[0] as any).rows.map((x: DNode[]) => x[0]) : r;
    return flat.map((x: DNode, i: number) => { const v = S(e, x, c); return types[i] === 'DATETIME' && typeof v === 'string' ? parseDate(v) : v; });
  });
  return new VTable(cols, rows);
}, 3, 999);
tfn('GENERATESERIES', (e, a, c) => {
  const s = toNum(S(e, a[0], c)), en = toNum(S(e, a[1], c)), st = toNum(opt(e, a, 2, c, 1));
  if (st <= 0) derr('GENERATESERIES increment must be positive.');
  const rows: any[][] = []; for (let x = s; x <= en + 1e-9; x += st) { rows.push([+x.toFixed(10)]); if (rows.length > 1e6) derr('GENERATESERIES would return more than 1,000,000 rows.'); }
  return new VTable([{ name: 'Value' }], rows);
}, 2, 3);
tfn('CALENDAR', (e, a, c) => {
  const s = dt(e, a, 0, c), en = dt(e, a, 1, c);
  if (!s || !en) derr('CALENDAR: start and end dates cannot be blank.');
  const rows: any[][] = [];
  for (let d = dateOnly(s!); d <= en!; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) { rows.push([d]); if (rows.length > 100000) derr('CALENDAR range is too large.'); }
  return new VTable([{ name: 'Date' }], rows);
}, 2);
tfn('CALENDARAUTO', (e, a, c) => {
  const fy = toNum(opt(e, a, 0, c, 12));
  let min: any = null, max: any = null;
  for (const t of e.model.tables) {
    if (t.expression) continue;
    t.columns.forEach((col, i) => {
      if (col.dataType !== 'date' && col.dataType !== 'datetime') return;
      for (const r of t.rows) { const v = r[i]; if (v instanceof Date) { if (!min || v < min) min = v; if (!max || v > max) max = v; } }
    });
  }
  if (!min || !max) derr('CALENDARAUTO: the model has no date columns.');
  const startYear = (min as Date).getMonth() + 1 > fy ? (min as Date).getFullYear() : (min as Date).getFullYear() - 1;
  const endYear = (max as Date).getMonth() + 1 > fy ? (max as Date).getFullYear() + 1 : (max as Date).getFullYear();
  const s = new Date(startYear, fy, 1), en = new Date(endYear, fy, 0);
  const rows: any[][] = [];
  for (let d = s; d <= en; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) rows.push([d]);
  return new VTable([{ name: 'Date' }], rows);
}, 0, 1);
tfn('TREATAS', (e, a, c) => {
  const vt = TB(e, a[0], c);
  const cols = a.slice(1).map(x => e.colRef(x));
  if (cols.length !== vt.cols.length) derr('TREATAS: the number of columns must match the table expression.');
  return new VTable(cols.map(lin), vt.rows);
}, 2, 99);
tfn('SUMMARIZECOLUMNS', (e, a, c) => {
  const groups: VCol[] = []; const filt: VTable[] = []; const exprs: { name: string; node: DNode }[] = [];
  for (let k = 0; k < a.length; k++) {
    const n = a[k];
    if (n.k === 'col') { groups.push(lin(e.colRef(n))); continue; }
    if (n.k === 'str') { exprs.push({ name: n.v, node: a[k + 1] }); k++; continue; }
    if (n.k === 'call' && n.fn === 'IGNORE') { exprs.push({ name: toStr(S(e, a[k], c)), node: a[k + 1] }); k++; continue; }
    filt.push(TB(e, n, c));
  }
  return e.summarizeColumns(groups, filt, exprs, c);
}, 1, 999);
tfn('GROUPBY', (e, a, c) => {
  const vt = TB(e, a[0], c); const groups: DNode[] = []; let k = 1;
  while (k < a.length && a[k].k === 'col') groups.push(a[k++]);
  const ext: { name: string; node: DNode }[] = [];
  for (; k + 1 < a.length; k += 2) ext.push({ name: toStr(S(e, a[k], c)), node: a[k + 1] });
  const gi = groups.map(g => { const n = g as any; const i = vt.colIndex(n.table && e.hasTable(n.table) ? e.table(n.table).name : n.table, n.col); if (i < 0) derr('GROUPBY columns must be in the table.'); return i; });
  const map = new Map<string, any[][]>();
  for (const r of vt.rows) { const key = tupleKey(gi.map(i => r[i])); if (!map.has(key)) map.set(key, []); map.get(key)!.push(r); }
  const rows: any[][] = [];
  for (const g of map.values()) {
    const vars = new Map(c.vars ?? []); vars.set('__currentgroup', new VTable(vt.cols, g));
    rows.push([...gi.map(i => g[0][i]), ...ext.map(x => S(e, x.node, { ...c, vars }))]);
  }
  return new VTable([...gi.map(i => vt.cols[i]), ...ext.map(x => ({ name: x.name }))], rows);
}, 1, 99);
tfn('CURRENTGROUP', (_e, _a, c) => (c.vars?.get('__currentgroup') as VTable) ?? derr('CURRENTGROUP can only be used inside GROUPBY.'));

// ---------- time intelligence ----------
interface Dates { cr: ColRef; visible: Date[]; all: Date[] }
function datesOf(e: E, n: DNode, c: Ctx): Dates {
  let cr: ColRef; let visible: Date[];
  if (n.k === 'col' && n.table && e.hasTable(n.table)) {
    cr = e.colRef(n);
    visible = e.distinctTuples([cr], c).map(r => r[0]).filter((v: any) => v instanceof Date);
  } else {
    const vt = TB(e, n, c);
    if (!vt.cols[0]?.t) derr('Time intelligence functions need a date column, like \'Date\'[Date].');
    cr = { t: vt.cols[0].t!, c: vt.cols[0].c! };
    visible = vt.rows.map(r => r[0]).filter((v: any) => v instanceof Date);
  }
  const all = e.distinctTuples([cr], { ...emptyCtx(), userel: c.userel }, false).map(r => r[0]).filter((v: any) => v instanceof Date);
  visible.sort((x, y) => x.getTime() - y.getTime()); all.sort((x, y) => x.getTime() - y.getTime());
  return { cr, visible, all };
}
const dtab = (d: Dates, dates: Date[]) => new VTable([lin(d.cr)], dates.map(x => [x]));
const between = (d: Dates, s: Date, en: Date) => dtab(d, d.all.filter(x => x >= dateOnly(s) && x <= en));
const endOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59);
function yearEndOf(e: E, a: DNode | undefined, c: Ctx): [number, number] {
  if (!a || a.k === 'empty') return [11, 31];
  const s = toStr(S(e, a, c)); const m = /^(\d{1,2})[/-](\d{1,2})$/.exec(s);
  if (!m) return [11, 31];
  return [+m[1] - 1, +m[2]];
}
function periodStart(d: Date, unit: 'Y' | 'Q' | 'M', ye: [number, number] = [11, 31]) {
  if (unit === 'M') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (unit === 'Q') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  const end = new Date(d.getFullYear(), ye[0], ye[1]);
  const startThis = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate() + 1);
  return d > end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : startThis;
}
function toDate(e: E, a: DNode[], i: number, c: Ctx, unit: 'Y' | 'Q' | 'M') {
  const d = datesOf(e, a[i], c);
  if (!d.visible.length) return dtab(d, []);
  const last = d.visible[d.visible.length - 1];
  return between(d, periodStart(last, unit, unit === 'Y' ? yearEndOf(e, a[i + 1], c) : undefined), endOfDay(last));
}
tfn('DATESYTD', (e, a, c) => toDate(e, a, 0, c, 'Y'), 1, 2);
tfn('DATESQTD', (e, a, c) => toDate(e, a, 0, c, 'Q'), 1);
tfn('DATESMTD', (e, a, c) => toDate(e, a, 0, c, 'M'), 1);
const totalTD = (name: string, inner: string) => fn(name, (e, a, c) => {
  const args: DNode[] = [a[1]]; if (inner === 'DATESYTD' && a[3]) args.push(a[3]);
  const filters: DNode[] = [{ k: 'call', fn: inner, args }];
  if (a[2] && a[2].k !== 'empty' && !(inner === 'DATESYTD' && a[2].k === 'str' && /^\d{1,2}[/-]\d{1,2}$/.test(a[2].v))) filters.push(a[2]);
  if (inner === 'DATESYTD' && a[2] && a[2].k === 'str' && /^\d{1,2}[/-]\d{1,2}$/.test(a[2].v)) args.push(a[2]);
  return S(e, { k: 'call', fn: 'CALCULATE', args: [a[0], ...filters] }, c);
}, 2, 4);
totalTD('TOTALYTD', 'DATESYTD'); totalTD('TOTALQTD', 'DATESQTD'); totalTD('TOTALMTD', 'DATESMTD');

function shift(d: Date, n: number, unit: string): Date {
  switch (unit) {
    case 'DAY': return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    case 'MONTH': return addMonths(d, n);
    case 'QUARTER': return addMonths(d, 3 * n);
    case 'YEAR': return addMonths(d, 12 * n);
  }
  return derr('Interval must be DAY, MONTH, QUARTER or YEAR.');
}
const unitOf = (n: DNode) => (n.k === 'name' ? n.name.toUpperCase() : derr('Interval must be DAY, MONTH, QUARTER or YEAR.'));
const isLastOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getDate() === 1;
tfn('DATEADD', (e, a, c) => {
  const d = datesOf(e, a[0], c); const n = toNum(S(e, a[1], c)); const u = unitOf(a[2]);
  const want = new Set<number>();
  for (const x of d.visible) {
    const s = shift(x, n, u); want.add(dateOnly(s).getTime());
    if (u !== 'DAY' && isLastOfMonth(x)) { const eom = new Date(s.getFullYear(), s.getMonth() + 1, 0); for (let k = s.getDate() + 1; k <= eom.getDate(); k++) want.add(new Date(s.getFullYear(), s.getMonth(), k).getTime()); }
  }
  return dtab(d, d.all.filter(x => want.has(dateOnly(x).getTime())));
}, 3);
tfn('SAMEPERIODLASTYEAR', (e, a, c) => TABLE.DATEADD(e, [a[0], { k: 'num', v: -1 }, { k: 'name', name: 'YEAR' }], c), 1);
tfn('PARALLELPERIOD', (e, a, c) => {
  const d = datesOf(e, a[0], c); const n = toNum(S(e, a[1], c)); const u = unitOf(a[2]);
  if (!d.visible.length) return dtab(d, []);
  const unit = u === 'YEAR' ? 'Y' : u === 'QUARTER' ? 'Q' : 'M';
  const s = periodStart(shift(d.visible[0], n, u), unit);
  const last = shift(d.visible[d.visible.length - 1], n, u);
  const ps = periodStart(last, unit);
  const en = unit === 'Y' ? new Date(ps.getFullYear(), 11, 31) : unit === 'Q' ? new Date(ps.getFullYear(), ps.getMonth() + 3, 0) : new Date(ps.getFullYear(), ps.getMonth() + 1, 0);
  return between(d, s, endOfDay(en));
}, 3);
function prevNext(unit: 'Y' | 'Q' | 'M' | 'D', dir: -1 | 1) {
  return (e: E, a: DNode[], c: Ctx) => {
    const d = datesOf(e, a[0], c);
    if (!d.visible.length) return dtab(d, []);
    const ref = dir < 0 ? d.visible[0] : d.visible[d.visible.length - 1];
    if (unit === 'D') { const t = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + dir); return dtab(d, d.all.filter(x => dateOnly(x).getTime() === t.getTime())); }
    const months = unit === 'Y' ? 12 : unit === 'Q' ? 3 : 1;
    const ps = periodStart(ref, unit);
    const s = addMonths(ps, dir * months);
    const en = new Date(s.getFullYear(), s.getMonth() + months, 0);
    return between(d, s, endOfDay(en));
  };
}
tfn('PREVIOUSYEAR', prevNext('Y', -1), 1, 2); tfn('PREVIOUSQUARTER', prevNext('Q', -1), 1); tfn('PREVIOUSMONTH', prevNext('M', -1), 1); tfn('PREVIOUSDAY', prevNext('D', -1), 1);
tfn('NEXTYEAR', prevNext('Y', 1), 1, 2); tfn('NEXTQUARTER', prevNext('Q', 1), 1); tfn('NEXTMONTH', prevNext('M', 1), 1); tfn('NEXTDAY', prevNext('D', 1), 1);
tfn('DATESBETWEEN', (e, a, c) => {
  const d = datesOf(e, a[0], c);
  const s = dt(e, a, 1, c) ?? d.all[0] ?? new Date(1900, 0, 1); const en = dt(e, a, 2, c) ?? d.all[d.all.length - 1] ?? new Date(9999, 0, 1);
  return between(d, s, endOfDay(en));
}, 3);
tfn('DATESINPERIOD', (e, a, c) => {
  const d = datesOf(e, a[0], c);
  const s = dt(e, a, 1, c); if (!s) return dtab(d, []);
  const n = toNum(S(e, a[2], c)); const u = unitOf(a[3]);
  const other = shift(s, n, u);
  if (n < 0) return dtab(d, d.all.filter(x => x > other && x <= endOfDay(s)));
  return dtab(d, d.all.filter(x => x >= dateOnly(s) && x < other));
}, 4);
function edgeOf(unit: 'Y' | 'Q' | 'M', start: boolean) {
  return (e: E, a: DNode[], c: Ctx) => {
    const d = datesOf(e, a[0], c); if (!d.visible.length) return dtab(d, []);
    const ref = start ? d.visible[0] : d.visible[d.visible.length - 1];
    const ps = periodStart(ref, unit, unit === 'Y' ? yearEndOf(e, a[1], c) : undefined);
    const months = unit === 'Y' ? 12 : unit === 'Q' ? 3 : 1;
    const pe = new Date(ps.getFullYear(), ps.getMonth() + months, ps.getDate() - 1);
    const inRange = d.all.filter(x => x >= ps && x <= endOfDay(pe));
    const pick = start ? inRange[0] : inRange[inRange.length - 1];
    return dtab(d, pick ? [pick] : []);
  };
}
tfn('STARTOFYEAR', edgeOf('Y', true), 1, 2); tfn('ENDOFYEAR', edgeOf('Y', false), 1, 2);
tfn('STARTOFQUARTER', edgeOf('Q', true), 1); tfn('ENDOFQUARTER', edgeOf('Q', false), 1);
tfn('STARTOFMONTH', edgeOf('M', true), 1); tfn('ENDOFMONTH', edgeOf('M', false), 1);
tfn('FIRSTDATE', (e, a, c) => { const d = datesOf(e, a[0], c); return dtab(d, d.visible.slice(0, 1)); }, 1);
tfn('LASTDATE', (e, a, c) => { const d = datesOf(e, a[0], c); return dtab(d, d.visible.slice(-1)); }, 1);
const balance = (name: string, edge: string, opening: boolean) => fn(name, (e, a, c) => {
  let filt: DNode = { k: 'call', fn: edge, args: [a[1]] };
  if (opening) filt = { k: 'call', fn: 'PREVIOUSDAY', args: [filt] };
  const args: DNode[] = [a[0], filt]; if (a[2] && a[2].k !== 'empty') args.push(a[2]);
  return S(e, { k: 'call', fn: 'CALCULATE', args }, c);
}, 2, 4);
balance('CLOSINGBALANCEMONTH', 'ENDOFMONTH', false); balance('CLOSINGBALANCEQUARTER', 'ENDOFQUARTER', false); balance('CLOSINGBALANCEYEAR', 'ENDOFYEAR', false);
balance('OPENINGBALANCEMONTH', 'STARTOFMONTH', true); balance('OPENINGBALANCEQUARTER', 'STARTOFQUARTER', true); balance('OPENINGBALANCEYEAR', 'STARTOFYEAR', true);
function nonBlank(first: boolean) {
  return (e: E, a: DNode[], c: Ctx) => {
    const cr = e.colRef(a[0]);
    const vals = e.distinctTuples([cr], c).map(r => r[0]).sort(compareValues);
    if (!first) vals.reverse();
    for (const v of vals) {
      const vt = new VTable([lin(cr)], [[v]]);
      const f = e.filterFromTable(vt)!;
      const r = S(e, a[1], { ...c, filters: e.applyFilter(c.filters, f, false), rows: [], cache: new Map() });
      if (!isBlank(r)) return vt;
    }
    return new VTable([lin(cr)], []);
  };
}
tfn('FIRSTNONBLANK', nonBlank(true), 2); tfn('LASTNONBLANK', nonBlank(false), 2);
fn('FIRSTNONBLANKVALUE', (e, a, c) => { const vt = nonBlank(true)(e, a, c); if (!vt.rows.length) return null; return S(e, a[1], { ...c, filters: e.applyFilter(c.filters, e.filterFromTable(vt)!, false), rows: [], cache: new Map() }); }, 2);
fn('LASTNONBLANKVALUE', (e, a, c) => { const vt = nonBlank(false)(e, a, c); if (!vt.rows.length) return null; return S(e, a[1], { ...c, filters: e.applyFilter(c.filters, e.filterFromTable(vt)!, false), rows: [], cache: new Map() }); }, 2);

// keep tree-shaking from dropping helpers used only via the registry
export const DAX_FUNCTIONS = () => [...Object.keys(SCALAR), ...Object.keys(TABLE)].sort();
void isTableExpr; void tableToScalar; void MTime; void ({} as Filter);
