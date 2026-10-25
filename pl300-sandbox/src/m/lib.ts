// The Power Query M standard library (the parts the PL-300 exam and the Power Query UI use).
import {
  MError, MFunction, MRecord, MTable, MType, MTime, MDuration, MBinary, DataType, Column,
  compareValues, keyOf, tupleKey, valueType, dateOnly, parseDate, MONTHS, DAYS, toSerial, fromSerial,
} from '../core/values';
import { netDateFormat, netNumberFormat, weekNum } from '../core/format';
import { callFn, combineTables, err, fieldOf, mEquals, primToType, recordOfRow, typeLabel, isType } from './eval';
import { convertValue, detectType, roundEven, textFrom } from './convert';

export const LIB: Record<string, any> = {};

function def(name: string, impl: (...a: any[]) => any, min = impl.length, max = impl.length) {
  LIB[name] = new MFunction(name, (args) => impl(...args), [min, Math.max(min, max)]);
}

// ---------- argument helpers ----------
function T(v: any, fn = 'function'): MTable {
  if (v instanceof MError) throw v;
  if (!(v instanceof MTable)) err(`We cannot convert a value of type ${typeLabel(v)} to type Table. (${fn})`);
  return v;
}
function L(v: any): any[] {
  if (v instanceof MError) throw v;
  if (!Array.isArray(v)) err(`We cannot convert a value of type ${typeLabel(v)} to type List.`);
  return v;
}
function S(v: any): string {
  if (v instanceof MError) throw v;
  if (typeof v !== 'string') err(`We cannot convert the value ${v === null ? 'null' : typeof v === 'number' ? v : typeLabel(v)} to type Text.`);
  return v;
}
function N(v: any): number {
  if (v instanceof MError) throw v;
  if (typeof v !== 'number') err(`We cannot convert the value ${typeof v === 'string' ? `"${v}"` : v === null ? 'null' : typeLabel(v)} to type Number.`);
  return v;
}
function D(v: any): Date {
  if (v instanceof MError) throw v;
  if (!(v instanceof Date)) err(`We cannot convert the value ${typeof v === 'string' ? `"${v}"` : v === null ? 'null' : v} to type Date.`);
  return v;
}
function F(v: any): MFunction { if (!(v instanceof MFunction)) err(`We cannot convert a value of type ${typeLabel(v)} to type Function.`); return v; }
const names = (v: any): string[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v.map(S) : [S(v)]);
const opt = (v: any, d: any) => (v === undefined || v === null ? d : v);
function optRec(v: any): MRecord { return v instanceof MRecord ? v : new MRecord(); }
function nullSafe<T>(f: (x: any, ...r: any[]) => T) { return (x: any, ...r: any[]) => (x === null ? null : f(x, ...r)); }

function typeOfArg(t: any): DataType {
  if (t instanceof MType) return t.name;
  return 'any';
}

const rowRec = (t: MTable) => { const nm = t.names; return (r: any[]) => recordOfRow(t, r, nm); };

/** Wrap an evaluation so that an error becomes a cell-level error value. */
function cell(f: () => any) {
  try { const v = f(); return v; } catch (e) { if (e instanceof MError) return e; throw e; }
}

// MissingField: 0 Error, 1 Ignore, 2 UseNull
function resolveCols(t: MTable, cols: string[], missing = 0): number[] {
  const out: number[] = [];
  for (const c of cols) {
    const i = t.idx(c);
    if (i < 0) { if (missing === 0) err(`The column '${c}' of the table wasn't found.`); out.push(-1); } else out.push(i);
  }
  return out;
}

// ---------- constants ----------
Object.assign(LIB, {
  'JoinKind.Inner': 0, 'JoinKind.LeftOuter': 1, 'JoinKind.RightOuter': 2, 'JoinKind.FullOuter': 3, 'JoinKind.LeftAnti': 4, 'JoinKind.RightAnti': 5,
  'Order.Ascending': 0, 'Order.Descending': 1,
  'MissingField.Error': 0, 'MissingField.Ignore': 1, 'MissingField.UseNull': 2,
  'ExtraValues.List': 0, 'ExtraValues.Ignore': 1, 'ExtraValues.Error': 2,
  'QuoteStyle.None': 0, 'QuoteStyle.Csv': 1,
  'GroupKind.Local': 0, 'GroupKind.Global': 1,
  'Occurrence.First': 0, 'Occurrence.Last': 1, 'Occurrence.All': 2,
  'RelativePosition.FromStart': 0, 'RelativePosition.FromEnd': 1,
  'Day.Sunday': 0, 'Day.Monday': 1, 'Day.Tuesday': 2, 'Day.Wednesday': 3, 'Day.Thursday': 4, 'Day.Friday': 5, 'Day.Saturday': 6,
  'RoundingMode.Up': 0, 'RoundingMode.Down': 1, 'RoundingMode.AwayFromZero': 2, 'RoundingMode.TowardZero': 3, 'RoundingMode.ToEven': 4,
  'JoinAlgorithm.Dynamic': 0, 'JoinSide.Left': 0, 'JoinSide.Right': 1,
  'Precision.Double': 0, 'Precision.Decimal': 1,
  'TextEncoding.Utf8': 65001, 'TextEncoding.Utf16': 1200, 'TextEncoding.Windows': 1252, 'TextEncoding.Ascii': 20127,
  'CsvStyle.QuoteAfterDelimiter': 0, 'CsvStyle.QuoteAlways': 1,
  'Number.PI': Math.PI, 'Number.E': Math.E, 'Number.Epsilon': Number.EPSILON, 'Number.NaN': NaN,
  'Number.PositiveInfinity': Infinity, 'Number.NegativeInfinity': -Infinity,
  'Int64.Type': new MType('int'), 'Int32.Type': new MType('int'), 'Int16.Type': new MType('int'), 'Int8.Type': new MType('int'),
  'Byte.Type': new MType('int'), 'Single.Type': new MType('decimal'), 'Double.Type': new MType('decimal'),
  'Decimal.Type': new MType('decimal'), 'Currency.Type': new MType('currency'), 'Percentage.Type': new MType('percent'),
  'Number.Type': new MType('decimal'), 'Text.Type': new MType('text'), 'Logical.Type': new MType('bool'), 'Date.Type': new MType('date'),
  'DateTime.Type': new MType('datetime'), 'DateTimeZone.Type': new MType('datetimezone'), 'Time.Type': new MType('time'),
  'Duration.Type': new MType('duration'), 'Any.Type': new MType('any'), 'Table.Type': new MType('table'), 'List.Type': new MType('list'),
  'Record.Type': new MType('record'), 'Binary.Type': new MType('binary'), 'Function.Type': new MType('function'), 'Null.Type': new MType('null'),
  'Type.Type': new MType('type'), 'Character.Type': new MType('text'), 'Guid.Type': new MType('text'), 'Uri.Type': new MType('text'),
  'Web.Type': new MType('text'),
});

// ---------- comparers ----------
function ordinal(a: any, b: any) { return compareValues(a, b); }
function ignoreCase(a: any, b: any) { return compareValues(typeof a === 'string' ? a.toLowerCase() : a, typeof b === 'string' ? b.toLowerCase() : b); }
LIB['Comparer.Ordinal'] = new MFunction('Comparer.Ordinal', ([a, b]) => ordinal(a, b), [2, 2]);
LIB['Comparer.OrdinalIgnoreCase'] = new MFunction('Comparer.OrdinalIgnoreCase', ([a, b]) => ignoreCase(a, b), [2, 2]);
def('Comparer.FromCulture', (_c: any, ic: any) => (ic ? LIB['Comparer.OrdinalIgnoreCase'] : LIB['Comparer.Ordinal']), 1, 2);
def('Comparer.Equals', (c: any, a: any, b: any) => callFn(c, [a, b]) === 0);
function cmpOf(c: any): (a: any, b: any) => number { return c instanceof MFunction ? (a, b) => N(callFn(c, [a, b])) : ordinal; }
function eqText(c: any) { return c === LIB['Comparer.OrdinalIgnoreCase'] ? (s: string) => s.toLowerCase() : (s: string) => s; }

// ---------- Replacer / Splitter / Combiner ----------
def('Replacer.ReplaceText', (text: any, old: any, nu: any) => {
  if (text === null) return null;
  if (typeof text !== 'string') return text;
  if (old === '') return text;
  return text.split(S(old)).join(nu ?? '');
});
def('Replacer.ReplaceValue', (v: any, old: any, nu: any) => (mEquals(v, old) ? nu : v));

def('Splitter.SplitTextByDelimiter', (delim: any, quote: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const s = S(t), d = S(delim);
  if (quote === 1) return csvSplit(s, d);
  return d === '' ? [s] : s.split(d);
}, [1, 1]), 1, 2);
def('Splitter.SplitTextByEachDelimiter', (delims: any, _q: any, fromEnd: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  let s = S(t); const out: string[] = [];
  const ds = L(delims).map(S);
  if (fromEnd) {
    const parts: string[] = [];
    for (const d of ds) { const i = s.lastIndexOf(d); if (i < 0) break; parts.unshift(s.slice(i + d.length)); s = s.slice(0, i); }
    return [s, ...parts];
  }
  for (const d of ds) { const i = s.indexOf(d); if (i < 0) break; out.push(s.slice(0, i)); s = s.slice(i + d.length); }
  out.push(s); return out;
}, [1, 1]), 1, 3);
def('Splitter.SplitTextByAnyDelimiter', (delims: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const ds = L(delims).map(S).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return S(t).split(new RegExp(ds.join('|')));
}, [1, 1]), 1, 3);
def('Splitter.SplitTextByPositions', (pos: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const s = S(t); const ps = L(pos).map(N);
  return ps.map((p, i) => s.slice(p, i + 1 < ps.length ? ps[i + 1] : undefined));
}, [1, 1]), 1, 2);
def('Splitter.SplitTextByLengths', (lens: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const s = S(t); let p = 0;
  return L(lens).map(N).map(l => { const x = s.slice(p, p + l); p += l; return x; });
}, [1, 1]), 1, 2);
def('Splitter.SplitTextByRepeatedLengths', (len: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const s = S(t); const out: string[] = []; const l = N(len);
  for (let i = 0; i < s.length; i += l) out.push(s.slice(i, i + l));
  return out;
}, [1, 1]), 1, 2);
def('Splitter.SplitTextByCharacterTransition', (before: any, after: any) => new MFunction('splitter', ([t]) => {
  if (t === null) return [null];
  const s = S(t);
  const test = (set: any, c: string) => set instanceof MFunction ? !!callFn(set, [c]) : L(set).includes(c);
  const out: string[] = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && test(before, s[i - 1]) && test(after, s[i])) { out.push(cur); cur = ''; }
    cur += s[i];
  }
  out.push(cur); return out;
}, [1, 1]));
def('Splitter.SplitByNothing', () => new MFunction('splitter', ([v]) => [v], [1, 1]), 0, 0);
def('Splitter.SplitTextByWhitespace', () => new MFunction('splitter', ([t]) => (t === null ? [null] : S(t).trim().split(/\s+/)), [1, 1]), 0, 1);

function csvSplit(s: string, d: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (s.startsWith(d, i)) { out.push(cur); cur = ''; i += d.length - 1; }
    else cur += c;
  }
  out.push(cur); return out;
}

def('Combiner.CombineTextByDelimiter', (delim: any) => new MFunction('combiner', ([list]) =>
  L(list).filter(x => x !== null).map(x => textFrom(x)).join(S(delim)), [1, 1]), 1, 2);
def('Combiner.CombineTextByEachDelimiter', (delims: any) => new MFunction('combiner', ([list]) => {
  const xs = L(list).map(x => (x === null ? '' : textFrom(x))); const ds = L(delims);
  return xs.map((x, i) => x + (i < xs.length - 1 ? ds[i] ?? '' : '')).join('');
}, [1, 1]), 1, 2);
def('Combiner.CombineTextByLengths', (lens: any) => new MFunction('combiner', ([list]) =>
  L(list).map((x, i) => String(x ?? '').padEnd(L(lens)[i]).slice(0, L(lens)[i])).join(''), [1, 1]), 1, 2);

// ---------- Table construction ----------
function colsFromSpec(spec: any, width: number): Column[] {
  if (spec instanceof MType && spec.name === 'table' && spec.detail) return spec.detail.map((c: any) => ({ name: c.name, type: c.type }));
  if (Array.isArray(spec)) return spec.map((n: any) => ({ name: S(n), type: 'any' as DataType }));
  if (typeof spec === 'number') return Array.from({ length: spec }, (_, i) => ({ name: `Column${i + 1}`, type: 'any' as DataType }));
  return Array.from({ length: width }, (_, i) => ({ name: `Column${i + 1}`, type: 'any' as DataType }));
}
def('#table', (spec: any, rows: any) => {
  const rs = L(rows).map(L);
  const cols = colsFromSpec(spec, rs[0]?.length ?? 0);
  return new MTable(cols, rs.map(r => cols.map((_, i) => r[i] ?? null)));
});
def('Table.FromRows', (rows: any, spec: any) => {
  const rs = L(rows).map(L);
  const cols = colsFromSpec(spec, Math.max(0, ...rs.map(r => r.length)));
  return new MTable(cols, rs.map(r => cols.map((_, i) => r[i] ?? null)));
}, 1, 2);
def('Table.FromColumns', (lists: any, spec: any) => {
  const cs = L(lists).map(L);
  const cols = colsFromSpec(spec, cs.length);
  const n = Math.max(0, ...cs.map(c => c.length));
  return new MTable(cols, Array.from({ length: n }, (_, r) => cols.map((_c, i) => cs[i]?.[r] ?? null)));
}, 1, 2);
def('Table.FromRecords', (recs: any, spec: any, missing: any) => {
  const rs = L(recs);
  let cols: Column[];
  if (spec) cols = colsFromSpec(spec, 0);
  else {
    const nm: string[] = [];
    for (const r of rs) { if (!(r instanceof MRecord)) err('Table.FromRecords expects a list of records.'); for (const n of r.names) if (!nm.includes(n)) nm.push(n); }
    cols = nm.map(n => ({ name: n, type: 'any' as DataType }));
  }
  return new MTable(cols, rs.map((r: MRecord) => cols.map(c => {
    if (!r.has(c.name)) { if (missing === 0 && spec) err(`The field '${c.name}' of the record wasn't found.`); return null; }
    return r.get(c.name);
  })));
}, 1, 3);
def('Table.FromList', (list: any, splitter: any, spec: any, def_: any, extra: any) => {
  const sp = splitter ?? LIB['Splitter.SplitByNothing'].impl([]);
  const rows = L(list).map(x => { const r = callFn(sp, [x]); return Array.isArray(r) ? r : [r]; });
  const width = spec ? (Array.isArray(spec) ? spec.length : typeof spec === 'number' ? spec : spec.detail?.length ?? 1) : Math.max(1, ...rows.map(r => r.length));
  const cols = colsFromSpec(spec ?? width, width);
  return new MTable(cols, rows.map(r => {
    if (extra === 2 && r.length > cols.length) err('There were more columns in the result than expected.');
    return cols.map((_, i) => r[i] ?? null);
  }));
}, 1, 5);
def('Table.FromValue', (v: any) => new MTable([{ name: 'Value', type: 'any' }], (Array.isArray(v) ? v : [v]).map(x => [x])), 1, 2);
def('Table.ToRows', (t: any) => T(t).rows.map(r => [...r]));
def('Table.ToRecords', (t: any) => { const tt = T(t); return tt.rows.map(rowRec(tt)); });
def('Table.ToColumns', (t: any) => { const tt = T(t); return tt.columns.map((_, i) => tt.rows.map(r => r[i])); });
def('Table.ToList', (t: any, comb: any) => {
  const tt = T(t); const c = comb ?? LIB['Combiner.CombineTextByDelimiter'].impl([',']);
  return tt.rows.map(r => callFn(c, [r]));
}, 1, 2);
def('Table.Column', (t: any, c: any) => { const tt = T(t); const i = tt.col(S(c)); return tt.rows.map(r => r[i]); });
def('Table.ColumnNames', (t: any) => T(t).names);
def('Table.ColumnCount', (t: any) => T(t).columns.length);
def('Table.RowCount', (t: any) => T(t).rows.length);
def('Table.IsEmpty', (t: any) => T(t).rows.length === 0);
def('Table.HasColumns', (t: any, c: any) => names(c).every(x => T(t).idx(x) >= 0));
def('Table.Buffer', (t: any) => T(t), 1, 2);
def('Table.StopFolding', (t: any) => T(t));
def('Table.AddKey', (t: any) => T(t), 3, 3);
def('Table.Keys', (_t: any) => []);
def('Table.ColumnsOfType', (t: any, types: any) => {
  const tt = T(t); const ts = L(types).map((x: MType) => x.name);
  return tt.columns.filter(c => ts.includes(c.type) || (ts.includes('decimal') && ['int', 'currency', 'percent'].includes(c.type))).map(c => c.name);
});
def('Table.Schema', (t: any) => {
  const tt = T(t);
  return new MTable(['Name', 'Position', 'TypeName', 'Kind', 'IsNullable'].map(n => ({ name: n, type: 'any' as DataType })),
    tt.columns.map((c, i) => [c.name, i, typeNameM(c.type), typeKind(c.type), true]));
});
function typeNameM(t: DataType) { return ({ int: 'Int64.Type', currency: 'Currency.Type', percent: 'Percentage.Type', decimal: 'Number.Type', text: 'Text.Type', bool: 'Logical.Type', date: 'Date.Type', datetime: 'DateTime.Type', time: 'Time.Type', duration: 'Duration.Type' } as any)[t] || 'Any.Type'; }
function typeKind(t: DataType) { return ({ int: 'number', currency: 'number', percent: 'number', decimal: 'number', text: 'text', bool: 'logical', date: 'date', datetime: 'datetime', time: 'time', duration: 'duration' } as any)[t] || 'any'; }

// ---------- Row selection ----------
def('Table.SelectRows', (t: any, cond: any) => {
  const tt = T(t); const f = F(cond); const rec = rowRec(tt);
  return new MTable(tt.columns, tt.rows.filter(r => { const v = callFn(f, [rec(r)]); return v === true; }));
});
def('Table.SelectRowsWithErrors', (t: any, cols: any) => {
  const tt = T(t); const ix = cols ? resolveCols(tt, names(cols)) : tt.columns.map((_, i) => i);
  return new MTable(tt.columns, tt.rows.filter(r => ix.some(i => r[i] instanceof MError)));
}, 1, 2);
def('Table.RemoveRowsWithErrors', (t: any, cols: any) => {
  const tt = T(t); const ix = cols ? resolveCols(tt, names(cols)) : tt.columns.map((_, i) => i);
  return new MTable(tt.columns, tt.rows.filter(r => !ix.some(i => r[i] instanceof MError)));
}, 1, 2);
def('Table.ReplaceErrorValues', (t: any, pairs: any) => {
  const tt = T(t);
  const ps = (Array.isArray(L(pairs)[0]) ? L(pairs) : [pairs]).map((p: any) => [tt.col(S(p[0])), p[1]] as [number, any]);
  return new MTable(tt.columns, tt.rows.map(r => { const n = [...r]; for (const [i, v] of ps) if (n[i] instanceof MError) n[i] = v; return n; }));
});
function countOrCond(tt: MTable, x: any, fromEnd = false): number {
  if (typeof x === 'number') return x;
  const f = F(x); const rec = rowRec(tt);
  const rows = fromEnd ? [...tt.rows].reverse() : tt.rows;
  let n = 0; for (const r of rows) { if (callFn(f, [rec(r)]) === true) n++; else break; }
  return n;
}
def('Table.FirstN', (t: any, n: any) => { const tt = T(t); return new MTable(tt.columns, tt.rows.slice(0, countOrCond(tt, n))); });
def('Table.LastN', (t: any, n: any) => { const tt = T(t); const k = countOrCond(tt, n, true); return new MTable(tt.columns, k ? tt.rows.slice(-k) : []); });
def('Table.Skip', (t: any, n: any) => { const tt = T(t); return new MTable(tt.columns, tt.rows.slice(countOrCond(tt, opt(n, 1)))); }, 1, 2);
def('Table.RemoveFirstN', (t: any, n: any) => { const tt = T(t); return new MTable(tt.columns, tt.rows.slice(countOrCond(tt, opt(n, 1)))); }, 1, 2);
def('Table.RemoveLastN', (t: any, n: any) => { const tt = T(t); const k = countOrCond(tt, opt(n, 1), true); return new MTable(tt.columns, k ? tt.rows.slice(0, -k) : tt.rows); }, 1, 2);
def('Table.Range', (t: any, off: any, cnt: any) => { const tt = T(t); return new MTable(tt.columns, tt.rows.slice(N(off), cnt === undefined || cnt === null ? undefined : N(off) + N(cnt))); }, 2, 3);
def('Table.RemoveRows', (t: any, off: any, cnt: any) => { const tt = T(t); const rs = [...tt.rows]; rs.splice(N(off), opt(cnt, 1)); return new MTable(tt.columns, rs); }, 2, 3);
def('Table.AlternateRows', (t: any, off: any, skip: any, take: any) => {
  const tt = T(t); const out: any[][] = []; const o = N(off), s = N(skip), k = N(take);
  tt.rows.forEach((r, i) => { if (i < o) { out.push(r); return; } const p = (i - o) % (s + k); if (p >= s) out.push(r); });
  return new MTable(tt.columns, out);
});
def('Table.ReverseRows', (t: any) => { const tt = T(t); return new MTable(tt.columns, [...tt.rows].reverse()); });
def('Table.Repeat', (t: any, n: any) => { const tt = T(t); const out: any[][] = []; for (let i = 0; i < N(n); i++) out.push(...tt.rows); return new MTable(tt.columns, out); });
def('Table.First', (t: any, d: any) => { const tt = T(t); return tt.rows.length ? recordOfRow(tt, tt.rows[0]) : opt(d, null); }, 1, 2);
def('Table.Last', (t: any, d: any) => { const tt = T(t); return tt.rows.length ? recordOfRow(tt, tt.rows[tt.rows.length - 1]) : opt(d, null); }, 1, 2);
def('Table.InsertRows', (t: any, off: any, recs: any) => {
  const tt = T(t); const rs = [...tt.rows];
  rs.splice(N(off), 0, ...L(recs).map((r: MRecord) => tt.names.map(n => r.get(n) ?? null)));
  return new MTable(tt.columns, rs);
});
def('Table.Distinct', (t: any, crit: any) => {
  const tt = T(t);
  let ix = tt.columns.map((_, i) => i);
  let ci = false;
  if (crit !== undefined && crit !== null) {
    if (typeof crit === 'string') ix = [tt.col(crit)];
    else if (Array.isArray(crit)) {
      if (crit.length === 2 && typeof crit[0] === 'string' && crit[1] instanceof MFunction) { ix = [tt.col(crit[0])]; ci = crit[1] === LIB['Comparer.OrdinalIgnoreCase']; }
      else ix = crit.map((c: any) => tt.col(Array.isArray(c) ? c[0] : S(c)));
    }
  }
  const seen = new Set<string>();
  return new MTable(tt.columns, tt.rows.filter(r => {
    const k = tupleKey(ix.map(i => (ci && typeof r[i] === 'string' ? r[i].toLowerCase() : r[i])));
    if (seen.has(k)) return false; seen.add(k); return true;
  }));
}, 1, 2);
def('Table.MatchesAnyRows', (t: any, f: any) => { const tt = T(t); const rec = rowRec(tt); return tt.rows.some(r => callFn(f, [rec(r)]) === true); });
def('Table.MatchesAllRows', (t: any, f: any) => { const tt = T(t); const rec = rowRec(tt); return tt.rows.every(r => callFn(f, [rec(r)]) === true); });
def('Table.Contains', (t: any, r: any) => { const tt = T(t); const rr = r as MRecord; return tt.rows.some(row => rr.names.every((n, i) => mEquals(row[tt.col(n)], rr.values[i]))); }, 2, 3);
def('Table.FindText', (t: any, txt: any) => { const tt = T(t); const s = S(txt); return new MTable(tt.columns, tt.rows.filter(r => r.some(v => typeof v === 'string' && v.includes(s)))); });
def('Table.PositionOf', (t: any, r: any) => { const tt = T(t); const rr = r as MRecord; return tt.rows.findIndex(row => rr.names.every((n, i) => mEquals(row[tt.col(n)], rr.values[i]))); }, 2, 4);
def('Table.Max', (t: any, c: any, d: any) => { const tt = T(t); if (!tt.rows.length) return opt(d, null); const i = tt.col(S(c)); let b = tt.rows[0]; for (const r of tt.rows) if (compareValues(r[i], b[i]) > 0) b = r; return recordOfRow(tt, b); }, 2, 3);
def('Table.Min', (t: any, c: any, d: any) => { const tt = T(t); if (!tt.rows.length) return opt(d, null); const i = tt.col(S(c)); let b = tt.rows[0]; for (const r of tt.rows) if (compareValues(r[i], b[i]) < 0) b = r; return recordOfRow(tt, b); }, 2, 3);
def('Table.MaxN', (t: any, c: any, n: any) => sortTable(T(t), [[S(c), 1]]).then(x => new MTable(x.columns, x.rows.slice(0, countOrCond(x, n)))), 3, 3);
def('Table.MinN', (t: any, c: any, n: any) => sortTable(T(t), [[S(c), 0]]).then(x => new MTable(x.columns, x.rows.slice(0, countOrCond(x, n)))), 3, 3);

// ---------- Sorting ----------
function sortSpec(spec: any): [any, number][] {
  if (typeof spec === 'string' || spec instanceof MFunction) return [[spec, 0]];
  const l = L(spec);
  if (l.length === 2 && typeof l[0] === 'string' && typeof l[1] === 'number') return [[l[0], l[1]]];
  return l.map((x: any) => (Array.isArray(x) ? [x[0], x[1] ?? 0] : [x, 0]));
}
function sortTable(tt: MTable, spec: [any, number][]) {
  const keys = spec.map(([c, o]) => {
    if (c instanceof MFunction) { const rec = rowRec(tt); return { get: (r: any[]) => callFn(c, [rec(r)]), o }; }
    const i = tt.col(S(c)); return { get: (r: any[]) => r[i], o };
  });
  const rows = tt.rows.map((r, i) => ({ r, i }));
  rows.sort((a, b) => {
    for (const k of keys) { const c = compareValues(k.get(a.r), k.get(b.r)); if (c) return k.o === 1 ? -c : c; }
    return a.i - b.i;
  });
  const res = new MTable(tt.columns, rows.map(x => x.r));
  return { then: (f: (x: MTable) => any) => f(res), value: res };
}
def('Table.Sort', (t: any, spec: any) => sortTable(T(t), sortSpec(spec)).value);

// ---------- Columns ----------
def('Table.SelectColumns', (t: any, cols: any, missing: any) => {
  const tt = T(t); const ns = names(cols); const ix = resolveCols(tt, ns, opt(missing, 0));
  const keep = ns.map((n, j) => ({ n, i: ix[j] })).filter(x => x.i >= 0 || missing === 2);
  return new MTable(keep.map(x => (x.i >= 0 ? tt.columns[x.i] : { name: x.n, type: 'any' as DataType })), tt.rows.map(r => keep.map(x => (x.i >= 0 ? r[x.i] : null))));
}, 2, 3);
def('Table.RemoveColumns', (t: any, cols: any, missing: any) => {
  const tt = T(t); const ns = names(cols); resolveCols(tt, ns, opt(missing, 0));
  const keep = tt.columns.map((c, i) => ({ c, i })).filter(x => !ns.includes(x.c.name));
  return new MTable(keep.map(x => x.c), tt.rows.map(r => keep.map(x => r[x.i])));
}, 2, 3);
def('Table.RenameColumns', (t: any, pairs: any, missing: any) => {
  const tt = T(t); const l = L(pairs);
  const ps: [string, string][] = (l.length && !Array.isArray(l[0]) ? [l] : l).map((p: any) => [S(p[0]), S(p[1])]);
  const cols = tt.columns.map(c => ({ ...c }));
  for (const [o, n] of ps) {
    const c = cols.find(x => x.name === o);
    if (!c) { if (opt(missing, 0) === 0) err(`The column '${o}' of the table wasn't found.`); continue; }
    c.name = n;
  }
  const seen = new Set<string>();
  for (const c of cols) { if (seen.has(c.name)) err(`The field '${c.name}' already exists in the record.`); seen.add(c.name); }
  return new MTable(cols, tt.rows);
}, 2, 3);
def('Table.ReorderColumns', (t: any, order: any, missing: any) => {
  const tt = T(t); const ns = names(order).filter(n => tt.idx(n) >= 0 || opt(missing, 0) === 0);
  resolveCols(tt, ns, opt(missing, 0));
  // listed columns take the slots they occupied, in the new order
  const slots = ns.map(n => tt.idx(n)).sort((a, b) => a - b);
  const perm = tt.columns.map((_, i) => i);
  slots.forEach((s, j) => { perm[s] = tt.idx(ns[j]); });
  return new MTable(perm.map(i => tt.columns[i]), tt.rows.map(r => perm.map(i => r[i])));
}, 2, 3);
def('Table.PrefixColumns', (t: any, p: any) => { const tt = T(t); return new MTable(tt.columns.map(c => ({ ...c, name: `${S(p)}.${c.name}` })), tt.rows); });
def('Table.DuplicateColumn', (t: any, c: any, nn: any, type: any) => {
  const tt = T(t); const i = tt.col(S(c));
  if (tt.idx(S(nn)) >= 0) err(`The field '${nn}' already exists in the record.`);
  return new MTable([...tt.columns, { name: S(nn), type: type ? typeOfArg(type) : tt.columns[i].type }], tt.rows.map(r => [...r, r[i]]));
}, 3, 4);
def('Table.AddColumn', (t: any, name: any, fn: any, type: any) => {
  const tt = T(t); const f = F(fn); const rec = rowRec(tt); const n = S(name);
  if (tt.idx(n) >= 0) err(`The field '${n}' already exists in the record.`);
  const vals = tt.rows.map(r => cell(() => callFn(f, [rec(r)])));
  const ct = type ? typeOfArg(type) : 'any';
  return new MTable([...tt.columns, { name: n, type: ct }], tt.rows.map((r, i) => [...r, vals[i]]));
}, 3, 4);
def('Table.AddIndexColumn', (t: any, name: any, start: any, step: any, type: any) => {
  const tt = T(t); const s = opt(start, 0), st = opt(step, 1);
  return new MTable([...tt.columns, { name: S(name), type: type ? typeOfArg(type) : 'int' }], tt.rows.map((r, i) => [...r, s + i * st]));
}, 2, 5);
def('Table.TransformColumns', (t: any, ops: any, defaultFn: any, missing: any) => {
  const tt = T(t);
  const l = L(ops);
  const ps: any[] = l.length && !Array.isArray(l[0]) ? [l] : l;
  const cols = tt.columns.map(c => ({ ...c }));
  const fns: (MFunction | null)[] = cols.map(() => (defaultFn instanceof MFunction ? defaultFn : null));
  for (const p of ps) {
    const i = tt.idx(S(p[0]));
    if (i < 0) { if (opt(missing, 0) === 0) err(`The column '${p[0]}' of the table wasn't found.`); continue; }
    fns[i] = F(p[1]);
    if (p[2] instanceof MType) cols[i].type = p[2].name;
  }
  return new MTable(cols, tt.rows.map(r => r.map((v, i) => (fns[i] && !(v instanceof MError) ? cell(() => callFn(fns[i]!, [v])) : v))));
}, 2, 4);
def('Table.TransformColumnTypes', (t: any, ops: any, _culture: any) => {
  const tt = T(t);
  const l = L(ops);
  const ps: any[] = l.length && !Array.isArray(l[0]) ? [l] : l;
  const cols = tt.columns.map(c => ({ ...c }));
  const conv: (DataType | null)[] = cols.map(() => null);
  for (const p of ps) {
    const i = tt.col(S(p[0]));
    const ty = p[1] instanceof MType ? p[1].name : err('Type expected in Table.TransformColumnTypes.');
    conv[i] = ty; cols[i].type = ty;
  }
  return new MTable(cols, tt.rows.map(r => r.map((v, i) => (conv[i] ? convertValue(v, conv[i]!) : v))));
}, 2, 3);
def('Table.TransformRows', (t: any, f: any) => { const tt = T(t); const rec = rowRec(tt); return tt.rows.map(r => callFn(f, [rec(r)])); });
def('Table.ReplaceValue', (t: any, old: any, nu: any, replacer: any, cols: any) => {
  const tt = T(t); const ix = resolveCols(tt, names(cols)); const rep = F(replacer);
  const rec = rowRec(tt);
  return new MTable(tt.columns, tt.rows.map(r => {
    const o = old instanceof MFunction ? callFn(old, [rec(r)]) : old;
    const n = nu instanceof MFunction ? callFn(nu, [rec(r)]) : nu;
    const out = [...r];
    for (const i of ix) if (!(out[i] instanceof MError)) out[i] = cell(() => callFn(rep, [out[i], o, n]));
    return out;
  }));
});
def('Table.FillDown', (t: any, cols: any) => {
  const tt = T(t); const ix = resolveCols(tt, names(cols));
  const last = ix.map(() => null as any);
  return new MTable(tt.columns, tt.rows.map(r => { const o = [...r]; ix.forEach((i, j) => { if (o[i] === null) o[i] = last[j]; else last[j] = o[i]; }); return o; }));
});
def('Table.FillUp', (t: any, cols: any) => {
  const tt = T(t); const ix = resolveCols(tt, names(cols));
  const last = ix.map(() => null as any);
  const rows = tt.rows.map(r => [...r]);
  for (let k = rows.length - 1; k >= 0; k--) ix.forEach((i, j) => { if (rows[k][i] === null) rows[k][i] = last[j]; else last[j] = rows[k][i]; });
  return new MTable(tt.columns, rows);
});
def('Table.PromoteHeaders', (t: any, options: any) => {
  const tt = T(t);
  if (!tt.rows.length) return tt;
  const [h, ...rest] = tt.rows;
  const used = new Set<string>();
  const cols = h.map((v, i) => {
    let n = v === null || v === '' ? `Column${i + 1}` : v instanceof Date ? (textFrom(v) as string) : typeof v === 'string' ? v : String(textFrom(v));
    if (optRec(options).get('PromoteAllScalars') === false && typeof v !== 'string' && v !== null) n = `Column${i + 1}`;
    let k = n, j = 1; while (used.has(k)) k = `${n}_${j++}`; used.add(k);
    return { name: k, type: 'any' as DataType };
  });
  return new MTable(cols, rest);
}, 1, 2);
def('Table.DemoteHeaders', (t: any) => {
  const tt = T(t);
  return new MTable(tt.columns.map((_, i) => ({ name: `Column${i + 1}`, type: 'any' as DataType })), [tt.names, ...tt.rows]);
});
def('Table.Transpose', (t: any, cols: any) => {
  const tt = T(t);
  const n = tt.rows.length;
  const cs = cols ? colsFromSpec(cols, n) : Array.from({ length: n }, (_, i) => ({ name: `Column${i + 1}`, type: 'any' as DataType }));
  return new MTable(cs, tt.columns.map((_, ci) => tt.rows.map(r => r[ci])));
}, 1, 2);
def('Table.CombineColumns', (t: any, cols: any, comb: any, nn: any) => {
  const tt = T(t); const ns = names(cols); const ix = resolveCols(tt, ns);
  const first = Math.min(...ix);
  const keep = tt.columns.map((c, i) => ({ c, i })).filter(x => !ix.includes(x.i));
  const pos = keep.filter(x => x.i < first).length;
  const cs = keep.map(x => x.c); cs.splice(pos, 0, { name: S(nn), type: 'text' });
  return new MTable(cs, tt.rows.map(r => { const o = keep.map(x => r[x.i]); o.splice(pos, 0, callFn(comb, [ix.map(i => r[i])])); return o; }));
});
def('Table.SplitColumn', (t: any, col: any, splitter: any, spec: any, _def: any, _extra: any) => {
  const tt = T(t); const i = tt.col(S(col));
  const parts = tt.rows.map(r => { const v = r[i]; if (v === null) return [null]; const p = callFn(splitter, [typeof v === 'string' ? v : textFrom(v)]); return Array.isArray(p) ? p : [p]; });
  let ns: string[];
  if (Array.isArray(spec)) ns = spec.map(S);
  else { const k = typeof spec === 'number' ? spec : Math.max(1, ...parts.map(p => p.length)); ns = Array.from({ length: k }, (_, j) => `${S(col)}.${j + 1}`); }
  const cs = [...tt.columns]; cs.splice(i, 1, ...ns.map(n => ({ name: n, type: 'text' as DataType })));
  return new MTable(cs, tt.rows.map((r, k) => { const o = [...r]; o.splice(i, 1, ...ns.map((_, j) => parts[k][j] ?? null)); return o; }));
}, 3, 6);
def('Table.ExpandRecordColumn', (t: any, col: any, fields: any, newNames: any) => {
  const tt = T(t); const i = tt.col(S(col)); const fs = names(fields); const nn = newNames ? names(newNames) : fs;
  const cs = [...tt.columns]; cs.splice(i, 1, ...nn.map(n => ({ name: n, type: 'any' as DataType })));
  return new MTable(cs, tt.rows.map(r => { const v = r[i]; const o = [...r]; o.splice(i, 1, ...fs.map(f => (v instanceof MRecord ? (v.has(f) ? v.get(f) : null) : null))); return o; }));
}, 3, 4);
def('Table.ExpandTableColumn', (t: any, col: any, cols: any, newNames: any) => {
  const tt = T(t); const i = tt.col(S(col)); const fs = names(cols); const nn = newNames ? names(newNames) : fs;
  for (const n of nn) if (tt.names.some((x, j) => x === n && j !== i)) err(`The field '${n}' already exists in the record.`);
  const typeOf: Record<string, DataType> = {};
  for (const r of tt.rows) if (r[i] instanceof MTable) { for (const c of r[i].columns) typeOf[c.name] = c.type; break; }
  const cs = [...tt.columns]; cs.splice(i, 1, ...nn.map((n, j) => ({ name: n, type: typeOf[fs[j]] ?? 'any' })));
  const rows: any[][] = [];
  for (const r of tt.rows) {
    const v = r[i];
    if (v instanceof MTable && v.rows.length) {
      const ix = fs.map(f => v.idx(f));
      for (const sr of v.rows) { const o = [...r]; o.splice(i, 1, ...ix.map(k => (k < 0 ? null : sr[k]))); rows.push(o); }
    } else { const o = [...r]; o.splice(i, 1, ...fs.map(() => null)); rows.push(o); }
  }
  return new MTable(cs, rows);
}, 3, 4);
def('Table.AggregateTableColumn', (t: any, col: any, aggs: any) => {
  const tt = T(t); const i = tt.col(S(col));
  const as = L(aggs).map((a: any) => ({ src: S(a[0]), fn: F(a[1]), name: S(a[2]) }));
  const cs = [...tt.columns]; cs.splice(i, 1, ...as.map(a => ({ name: a.name, type: 'any' as DataType })));
  return new MTable(cs, tt.rows.map(r => { const v = r[i] as MTable; const o = [...r]; o.splice(i, 1, ...as.map(a => callFn(a.fn, [v ? fieldOf(v, a.src, true) : []]))); return o; }));
});
def('Table.ExpandListColumn', (t: any, col: any) => {
  const tt = T(t); const i = tt.col(S(col)); const rows: any[][] = [];
  for (const r of tt.rows) {
    const v = r[i];
    if (Array.isArray(v)) { if (!v.length) { const o = [...r]; o[i] = null; rows.push(o); } for (const x of v) { const o = [...r]; o[i] = x; rows.push(o); } }
    else rows.push(r);
  }
  return new MTable(tt.columns, rows);
});

// ---------- Group / Pivot / Unpivot ----------
def('Table.Group', (t: any, keys: any, aggs: any, _kind: any, _cmp: any) => {
  const tt = T(t); const ks = names(keys); const ix = resolveCols(tt, ks);
  const al = L(aggs);
  const as: any[] = al.length && !Array.isArray(al[0]) ? [al] : al;
  const groups = new Map<string, any[][]>();
  const order: string[] = [];
  for (const r of tt.rows) {
    const k = tupleKey(ix.map(i => r[i]));
    let g = groups.get(k); if (!g) { g = []; groups.set(k, g); order.push(k); }
    g.push(r);
  }
  const cols: Column[] = [...ix.map(i => tt.columns[i]), ...as.map(a => ({ name: S(a[0]), type: a[2] instanceof MType ? a[2].name : 'any' as DataType }))];
  const rows = order.map(k => {
    const g = groups.get(k)!;
    const sub = new MTable(tt.columns, g);
    return [...ix.map(i => g[0][i]), ...as.map(a => cell(() => callFn(a[1], [sub])))];
  });
  return new MTable(cols, rows);
}, 3, 5);
def('Table.Pivot', (t: any, values: any, attr: any, valueCol: any, agg: any) => {
  const tt = T(t); const ai = tt.col(S(attr)), vi = tt.col(S(valueCol));
  const pv = L(values).map(v => (v === null ? null : textFrom(v)));
  const keep = tt.columns.map((c, i) => ({ c, i })).filter(x => x.i !== ai && x.i !== vi);
  const groups = new Map<string, { key: any[]; cells: Map<string, any[]> }>();
  const order: string[] = [];
  for (const r of tt.rows) {
    const key = keep.map(x => r[x.i]); const k = tupleKey(key);
    let g = groups.get(k); if (!g) { g = { key, cells: new Map() }; groups.set(k, g); order.push(k); }
    const a = textFrom(r[ai]) as string;
    if (!g.cells.has(a)) g.cells.set(a, []);
    g.cells.get(a)!.push(r[vi]);
  }
  const cols: Column[] = [...keep.map(x => x.c), ...pv.map(p => ({ name: String(p), type: agg ? 'any' as DataType : tt.columns[vi].type }))];
  const rows = order.map(k => {
    const g = groups.get(k)!;
    return [...g.key, ...pv.map(p => {
      const vs = g.cells.get(String(p));
      if (!vs) return agg ? callFn(agg, [[]]) : null;
      if (agg) return cell(() => callFn(agg, [vs]));
      if (vs.length > 1) return new MError('Expression.Error', 'There were too many elements in the enumeration to complete the operation.');
      return vs[0];
    })];
  });
  return new MTable(cols, rows);
}, 4, 5);
function unpivot(tt: MTable, cols: number[], an: string, vn: string) {
  const keep = tt.columns.map((c, i) => ({ c, i })).filter(x => !cols.includes(x.i));
  const vt = cols.map(i => tt.columns[i].type);
  const vtype: DataType = vt.every(x => x === vt[0]) ? vt[0] ?? 'any' : 'any';
  const out: any[][] = [];
  for (const r of tt.rows) for (const i of cols) { if (r[i] === null) continue; out.push([...keep.map(x => r[x.i]), tt.columns[i].name, r[i]]); }
  return new MTable([...keep.map(x => x.c), { name: an, type: 'text' }, { name: vn, type: vtype }], out);
}
def('Table.Unpivot', (t: any, cols: any, an: any, vn: any) => { const tt = T(t); return unpivot(tt, resolveCols(tt, names(cols)), S(an), S(vn)); });
def('Table.UnpivotOtherColumns', (t: any, keep: any, an: any, vn: any) => {
  const tt = T(t); const k = resolveCols(tt, names(keep));
  return unpivot(tt, tt.columns.map((_, i) => i).filter(i => !k.includes(i)), S(an), S(vn));
});

// ---------- Joins / Append ----------
function joinCore(t1: MTable, k1: string[], t2: MTable, k2: string[], kind: number, keyFn = (v: any) => v) {
  const i1 = resolveCols(t1, k1), i2 = resolveCols(t2, k2);
  if (i1.length !== i2.length) err('The number of key columns must match.');
  const index = new Map<string, number[]>();
  t2.rows.forEach((r, j) => { const k = tupleKey(i2.map(i => keyFn(r[i]))); if (!index.has(k)) index.set(k, []); index.get(k)!.push(j); });
  const matchedRight = new Set<number>();
  const pairs: [number | null, number[]][] = [];
  t1.rows.forEach((r, j) => {
    const m = index.get(tupleKey(i1.map(i => keyFn(r[i])))) ?? [];
    m.forEach(x => matchedRight.add(x));
    pairs.push([j, m]);
  });
  const out: [number | null, number[]][] = [];
  if (kind === 0) for (const p of pairs) { if (p[1].length) out.push(p); }
  if (kind === 1) out.push(...pairs);
  if (kind === 4) for (const p of pairs) { if (!p[1].length) out.push([p[0], []]); }
  if (kind === 2) {
    // right outer: matched left rows plus a null-left row for each unmatched right row
    for (const p of pairs) if (p[1].length) out.push(p);
    t2.rows.forEach((_, j) => { if (!matchedRight.has(j)) out.push([null, [j]]); });
  }
  if (kind === 3) { out.push(...pairs); t2.rows.forEach((_, j) => { if (!matchedRight.has(j)) out.push([null, [j]]); }); }
  if (kind === 5) t2.rows.forEach((_, j) => { if (!matchedRight.has(j)) out.push([null, [j]]); });
  return out;
}
function nestedJoin(t: any, k1: any, t2: any, k2: any, nn: any, kind: any, keyFn?: (v: any) => any) {
  const a = T(t), b = T(t2);
  const pairs = joinCore(a, names(k1), b, names(k2), opt(kind, 1), keyFn);
  const empty = a.columns.map(() => null);
  return new MTable([...a.columns, { name: S(nn), type: 'table' }], pairs.map(([l, rs]) => [...(l === null ? empty : a.rows[l]), new MTable(b.columns, rs.map(j => b.rows[j]))]));
}
def('Table.NestedJoin', (t: any, k1: any, t2: any, k2: any, nn: any, kind: any) => nestedJoin(t, k1, t2, k2, nn, kind), 5, 7);
const fuzzyKey = (v: any) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ') : v);
def('Table.FuzzyNestedJoin', (t: any, k1: any, t2: any, k2: any, nn: any, kind: any) => nestedJoin(t, k1, t2, k2, nn, kind, fuzzyKey), 5, 7);
function flatJoin(t: any, k1: any, t2: any, k2: any, kind: any, keyFn?: (v: any) => any) {
  const a = T(t), b = T(t2);
  const n1 = names(k1), n2 = names(k2);
  // identically named key columns are kept once
  const shared = new Set(n1.filter((c, i) => c === n2[i]));
  const bKeep = b.columns.map((c, i) => ({ c, i })).filter(x => !shared.has(x.c.name));
  for (const x of bKeep) if (a.idx(x.c.name) >= 0) err(`A join operation cannot result in a table with duplicate column names ("${x.c.name}").`);
  const pairs = joinCore(a, n1, b, n2, opt(kind, 0), keyFn);
  const el = a.columns.map(() => null), er = bKeep.map(() => null);
  const rows: any[][] = [];
  for (const [l, rs] of pairs) {
    const left = l === null ? el : a.rows[l];
    if (!rs.length) rows.push([...left, ...er]); else for (const j of rs) rows.push([...left, ...bKeep.map(x => b.rows[j][x.i])]);
  }
  return new MTable([...a.columns, ...bKeep.map(x => x.c)], rows);
}
def('Table.Join', (t: any, k1: any, t2: any, k2: any, kind: any) => flatJoin(t, k1, t2, k2, kind), 4, 7);
def('Table.FuzzyJoin', (t: any, k1: any, t2: any, k2: any, kind: any) => flatJoin(t, k1, t2, k2, kind, fuzzyKey), 4, 6);
def('Table.Combine', (ts: any, cols: any) => {
  const r = combineTables(L(ts).map(x => T(x)));
  if (cols) { const ns = names(cols); return LIB['Table.SelectColumns'].impl([r, ns, 2]); }
  return r;
}, 1, 2);

// ---------- Profile ----------
def('Table.Profile', (t: any) => {
  const tt = T(t);
  const cols = ['Column', 'Min', 'Max', 'Average', 'StandardDeviation', 'Count', 'NullCount', 'DistinctCount'].map(n => ({ name: n, type: 'any' as DataType }));
  return new MTable(cols, tt.columns.map((c, i) => {
    const vs = tt.rows.map(r => r[i]).filter(v => !(v instanceof MError));
    const nn = vs.filter(v => v !== null);
    const nums = nn.filter(v => typeof v === 'number');
    const sorted = [...nn].sort(compareValues);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const sd = nums.length > 1 ? Math.sqrt(nums.reduce((a, b) => a + (b - avg!) ** 2, 0) / (nums.length - 1)) : null;
    return [c.name, sorted[0] ?? null, sorted[sorted.length - 1] ?? null, avg, sd, vs.length, vs.length - nn.length, new Set(vs.map(keyOf)).size];
  }));
}, 1, 2);

// ---------- List ----------
const nums = (l: any[]) => l.filter(x => x !== null).map(N);
def('List.Sum', (l: any) => { const n = nums(L(l)); return n.length ? n.reduce((a, b) => a + b, 0) : null; }, 1, 2);
def('List.Product', (l: any) => { const n = nums(L(l)); return n.length ? n.reduce((a, b) => a * b, 1) : null; }, 1, 2);
def('List.Average', (l: any) => {
  const xs = L(l).filter(x => x !== null);
  if (!xs.length) return null;
  if (xs[0] instanceof Date) return new Date(xs.reduce((a, b) => a + D(b).getTime(), 0) / xs.length);
  const n = xs.map(N); return n.reduce((a, b) => a + b, 0) / n.length;
}, 1, 2);
def('List.Median', (l: any) => { const n = L(l).filter(x => x !== null).sort(compareValues); if (!n.length) return null; const m = Math.floor(n.length / 2); return n.length % 2 ? n[m] : typeof n[m] === 'number' ? (n[m - 1] + n[m]) / 2 : n[m - 1]; }, 1, 2);
def('List.Mode', (l: any) => { const c = new Map<string, [any, number]>(); for (const x of L(l)) { const k = keyOf(x); const e = c.get(k) ?? [x, 0]; e[1]++; c.set(k, e); } let b: any = null, bn = 0; for (const [, [x, n]] of c) if (n > bn) { b = x; bn = n; } return b; }, 1, 2);
def('List.StandardDeviation', (l: any) => { const n = nums(L(l)); if (n.length < 2) return null; const a = n.reduce((x, y) => x + y, 0) / n.length; return Math.sqrt(n.reduce((x, y) => x + (y - a) ** 2, 0) / (n.length - 1)); });
def('List.Min', (l: any, d: any) => { const n = L(l).filter(x => x !== null); return n.length ? n.reduce((a, b) => (compareValues(b, a) < 0 ? b : a)) : opt(d, null); }, 1, 4);
def('List.Max', (l: any, d: any) => { const n = L(l).filter(x => x !== null); return n.length ? n.reduce((a, b) => (compareValues(b, a) > 0 ? b : a)) : opt(d, null); }, 1, 4);
def('List.MinN', (l: any, n: any) => [...L(l)].filter(x => x !== null).sort(compareValues).slice(0, N(n)), 2, 4);
def('List.MaxN', (l: any, n: any) => [...L(l)].filter(x => x !== null).sort((a, b) => compareValues(b, a)).slice(0, N(n)), 2, 4);
def('List.Count', (l: any) => L(l).length);
def('List.NonNullCount', (l: any) => L(l).filter(x => x !== null).length);
def('List.IsEmpty', (l: any) => L(l).length === 0);
def('List.Distinct', (l: any, c: any) => { const seen = new Set<string>(); const ci = c === LIB['Comparer.OrdinalIgnoreCase']; return L(l).filter(x => { const k = keyOf(ci && typeof x === 'string' ? x.toLowerCase() : x); if (seen.has(k)) return false; seen.add(k); return true; }); }, 1, 2);
def('List.Sort', (l: any, o: any) => {
  const xs = [...L(l)];
  if (o instanceof MFunction) { if (o.arity[0] === 2) return xs.sort((a, b) => N(callFn(o, [a, b]))); return xs.sort((a, b) => compareValues(callFn(o, [a]), callFn(o, [b]))); }
  if (Array.isArray(o)) { const [f, ord] = o; return xs.sort((a, b) => (ord === 1 ? -1 : 1) * compareValues(callFn(f, [a]), callFn(f, [b]))); }
  return xs.sort((a, b) => (o === 1 ? -1 : 1) * compareValues(a, b));
}, 1, 2);
def('List.Select', (l: any, f: any) => L(l).filter(x => callFn(f, [x]) === true));
def('List.Transform', (l: any, f: any) => L(l).map(x => callFn(f, [x])));
def('List.TransformMany', (l: any, cf: any, rf: any) => L(l).flatMap(x => L(callFn(cf, [x])).map(y => callFn(rf, [x, y]))));
def('List.Accumulate', (l: any, seed: any, f: any) => L(l).reduce((s, x) => callFn(f, [s, x]), seed));
def('List.Generate', (init: any, cond: any, next: any, sel: any) => {
  const out: any[] = []; let s = callFn(init, []); let guard = 0;
  while (callFn(cond, [s]) === true) { out.push(sel ? callFn(sel, [s]) : s); s = callFn(next, [s]); if (++guard > 1e6) err('List.Generate exceeded 1,000,000 items.'); }
  return out;
}, 3, 4);
def('List.First', (l: any, d: any) => (L(l).length ? L(l)[0] : opt(d, null)), 1, 2);
def('List.Last', (l: any, d: any) => (L(l).length ? L(l)[L(l).length - 1] : opt(d, null)), 1, 2);
def('List.FirstN', (l: any, n: any) => (typeof n === 'number' ? L(l).slice(0, n) : (() => { const out: any[] = []; for (const x of L(l)) { if (callFn(n, [x]) !== true) break; out.push(x); } return out; })()));
def('List.LastN', (l: any, n: any) => L(l).slice(-N(n)));
def('List.Skip', (l: any, n: any) => L(l).slice(opt(n, 1)), 1, 2);
def('List.RemoveFirstN', (l: any, n: any) => L(l).slice(opt(n, 1)), 1, 2);
def('List.RemoveLastN', (l: any, n: any) => L(l).slice(0, -opt(n, 1)), 1, 2);
def('List.Range', (l: any, o: any, c: any) => L(l).slice(N(o), c === undefined || c === null ? undefined : N(o) + N(c)), 2, 3);
def('List.Reverse', (l: any) => [...L(l)].reverse());
def('List.Contains', (l: any, v: any, c: any) => { const ci = c === LIB['Comparer.OrdinalIgnoreCase']; return L(l).some(x => (ci && typeof x === 'string' && typeof v === 'string' ? x.toLowerCase() === v.toLowerCase() : mEquals(x, v))); }, 2, 3);
def('List.ContainsAny', (l: any, vs: any) => L(vs).some(v => L(l).some(x => mEquals(x, v))), 2, 3);
def('List.ContainsAll', (l: any, vs: any) => L(vs).every(v => L(l).some(x => mEquals(x, v))), 2, 3);
def('List.PositionOf', (l: any, v: any) => L(l).findIndex(x => mEquals(x, v)), 2, 4);
def('List.Combine', (ls: any) => L(ls).flatMap(L));
def('List.Zip', (ls: any) => { const xs = L(ls).map(L); const n = Math.max(0, ...xs.map(x => x.length)); return Array.from({ length: n }, (_, i) => xs.map(x => x[i] ?? null)); });
def('List.Numbers', (s: any, c: any, inc: any) => Array.from({ length: N(c) }, (_, i) => N(s) + i * opt(inc, 1)), 2, 3);
def('List.Dates', (s: any, c: any, step: any) => Array.from({ length: N(c) }, (_, i) => new Date(D(s).getTime() + i * (step as MDuration).ms)));
def('List.Times', (s: any, c: any, step: any) => Array.from({ length: N(c) }, (_, i) => new MTime((s as MTime).ms + i * (step as MDuration).ms)));
def('List.Repeat', (l: any, n: any) => Array.from({ length: N(n) }, () => L(l)).flat());
def('List.RemoveNulls', (l: any) => L(l).filter(x => x !== null));
def('List.RemoveItems', (l: any, r: any) => L(l).filter(x => !L(r).some(y => mEquals(x, y))));
def('List.RemoveMatchingItems', (l: any, r: any) => L(l).filter(x => !L(r).some(y => mEquals(x, y))), 2, 3);
def('List.ReplaceValue', (l: any, o: any, n: any, rep: any) => L(l).map(x => callFn(rep, [x, o, n])));
def('List.Union', (ls: any) => LIB['List.Distinct'].impl([L(ls).flatMap(L)]), 1, 2);
def('List.Intersect', (ls: any) => { const xs = L(ls).map(L); return xs.length ? LIB['List.Distinct'].impl([xs[0].filter(v => xs.every(x => x.some((y: any) => mEquals(y, v))))]) : []; }, 1, 2);
def('List.Difference', (a: any, b: any) => L(a).filter(x => !L(b).some(y => mEquals(x, y))), 2, 3);
def('List.AnyTrue', (l: any) => L(l).some(x => x === true));
def('List.AllTrue', (l: any) => L(l).every(x => x === true));
def('List.MatchesAny', (l: any, f: any) => L(l).some(x => callFn(f, [x]) === true));
def('List.MatchesAll', (l: any, f: any) => L(l).every(x => callFn(f, [x]) === true));
def('List.Buffer', (l: any) => L(l));
def('List.Single', (l: any) => { if (L(l).length !== 1) err('There were too many or too few elements in the enumeration.'); return L(l)[0]; });
def('List.Split', (l: any, n: any) => { const out: any[] = []; for (let i = 0; i < L(l).length; i += N(n)) out.push(L(l).slice(i, i + N(n))); return out; });
def('List.Alternate', (l: any, c: any, r: any, o: any) => L(l).filter((_x, i) => { const p = i - opt(o, 0); if (p < 0) return true; return p % (N(c) + opt(r, 1)) >= N(c); }), 2, 4);
def('List.InsertRange', (l: any, i: any, v: any) => { const x = [...L(l)]; x.splice(N(i), 0, ...L(v)); return x; });
def('List.ReplaceRange', (l: any, i: any, c: any, v: any) => { const x = [...L(l)]; x.splice(N(i), N(c), ...L(v)); return x; });
def('List.Positions', (l: any) => L(l).map((_, i) => i));
def('List.Random', (n: any) => Array.from({ length: N(n) }, () => Math.random()), 1, 2);
def('List.Covariance', (a: any, b: any) => { const x = nums(L(a)), y = nums(L(b)); const mx = x.reduce((p, q) => p + q, 0) / x.length, my = y.reduce((p, q) => p + q, 0) / y.length; return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / x.length; });

// ---------- Text ----------
def('Text.From', nullSafe((v: any) => textFrom(v)), 1, 2);
def('Text.Upper', nullSafe((s: any) => S(s).toUpperCase()), 1, 2);
def('Text.Lower', nullSafe((s: any) => S(s).toLowerCase()), 1, 2);
def('Text.Proper', nullSafe((s: any) => S(s).toLowerCase().replace(/(^|[^A-Za-z'])([a-z])/g, (_m, a, b) => a + b.toUpperCase())), 1, 2);
def('Text.Trim', nullSafe((s: any, c: any) => (c ? trimChars(S(s), c, true, true) : S(s).replace(/^\s+|\s+$/g, ''))), 1, 2);
def('Text.TrimStart', nullSafe((s: any, c: any) => (c ? trimChars(S(s), c, true, false) : S(s).replace(/^\s+/, ''))), 1, 2);
def('Text.TrimEnd', nullSafe((s: any, c: any) => (c ? trimChars(S(s), c, false, true) : S(s).replace(/\s+$/, ''))), 1, 2);
function trimChars(s: string, c: any, start: boolean, end: boolean) { const cs = Array.isArray(c) ? c : [c]; let a = 0, b = s.length; if (start) while (a < b && cs.includes(s[a])) a++; if (end) while (b > a && cs.includes(s[b - 1])) b--; return s.slice(a, b); }
// eslint-disable-next-line no-control-regex
def('Text.Clean', nullSafe((s: any) => S(s).replace(/[\x00-\x1F\x7F]/g, '')));
def('Text.Length', nullSafe((s: any) => S(s).length));
def('Text.Start', nullSafe((s: any, n: any) => S(s).slice(0, N(n))));
def('Text.End', nullSafe((s: any, n: any) => (N(n) ? S(s).slice(-N(n)) : '')));
def('Text.Middle', nullSafe((s: any, o: any, c: any) => S(s).slice(N(o), c === undefined || c === null ? undefined : N(o) + N(c))), 2, 3);
def('Text.Range', nullSafe((s: any, o: any, c: any) => { if (N(o) > S(s).length) err('The offset is out of range.'); return S(s).slice(N(o), c === undefined || c === null ? undefined : N(o) + N(c)); }), 2, 3);
def('Text.Contains', (s: any, sub: any, c: any) => (s === null ? null : eqText(c)(S(s)).includes(eqText(c)(S(sub)))), 2, 3);
def('Text.StartsWith', (s: any, sub: any, c: any) => (s === null ? null : eqText(c)(S(s)).startsWith(eqText(c)(S(sub)))), 2, 3);
def('Text.EndsWith', (s: any, sub: any, c: any) => (s === null ? null : eqText(c)(S(s)).endsWith(eqText(c)(S(sub)))), 2, 3);
def('Text.Replace', nullSafe((s: any, o: any, n: any) => S(s).split(S(o)).join(S(n))));
def('Text.ReplaceRange', nullSafe((s: any, o: any, c: any, n: any) => S(s).slice(0, N(o)) + S(n) + S(s).slice(N(o) + N(c))));
def('Text.Insert', nullSafe((s: any, o: any, n: any) => S(s).slice(0, N(o)) + S(n) + S(s).slice(N(o))));
def('Text.Remove', nullSafe((s: any, c: any) => { const cs = Array.isArray(c) ? c : [c]; return [...S(s)].filter(x => !cs.includes(x)).join(''); }));
def('Text.RemoveRange', nullSafe((s: any, o: any, c: any) => S(s).slice(0, N(o)) + S(s).slice(N(o) + opt(c, 1))), 2, 3);
def('Text.Select', nullSafe((s: any, c: any) => { const cs = Array.isArray(c) ? c : [c]; return [...S(s)].filter(x => cs.includes(x)).join(''); }));
def('Text.Split', nullSafe((s: any, d: any) => S(s).split(S(d))));
def('Text.SplitAny', nullSafe((s: any, d: any) => S(s).split(new RegExp(`[${S(d).replace(/[\]\\^-]/g, '\\$&')}]`))));
def('Text.Combine', (l: any, d: any) => L(l).filter(x => x !== null).map(x => textFrom(x)).join(opt(d, '')), 1, 2);
def('Text.PadStart', nullSafe((s: any, n: any, c: any) => S(s).padStart(N(n), opt(c, ' '))), 2, 3);
def('Text.PadEnd', nullSafe((s: any, n: any, c: any) => S(s).padEnd(N(n), opt(c, ' '))), 2, 3);
def('Text.Repeat', nullSafe((s: any, n: any) => S(s).repeat(N(n))));
def('Text.Reverse', nullSafe((s: any) => [...S(s)].reverse().join('')));
def('Text.ToList', nullSafe((s: any) => [...S(s)]));
def('Text.At', nullSafe((s: any, i: any) => S(s)[N(i)] ?? err('Index out of range.')));
def('Text.NewGuid', () => crypto.randomUUID ? crypto.randomUUID() : String(Math.random()), 0, 0);
def('Text.Format', (f: any, args: any) => S(f).replace(/#\{(\d+)\}|#\[([^\]]+)\]/g, (_m, i, n) => String(textFrom(i !== undefined ? L(args)[+i] : (args as MRecord).get(n)) ?? '')), 2, 3);
def('Text.PositionOf', (s: any, sub: any, occ: any, c: any) => {
  const a = eqText(c)(S(s)), b = eqText(c)(S(sub));
  if (occ === 1) return a.lastIndexOf(b);
  if (occ === 2) { const out: number[] = []; let i = a.indexOf(b); while (i >= 0) { out.push(i); i = a.indexOf(b, i + 1); } return out; }
  return a.indexOf(b);
}, 2, 4);
def('Text.PositionOfAny', (s: any, cs: any) => { const str = S(s); for (let i = 0; i < str.length; i++) if (L(cs).includes(str[i])) return i; return -1; }, 2, 3);
function delimIndex(s: string, d: string, idx: any, fromStart = true) {
  let skip = 0, rel = 0;
  if (Array.isArray(idx)) { skip = idx[0]; rel = idx[1] ?? 0; } else if (typeof idx === 'number') skip = idx;
  if (rel === 1 || !fromStart) {
    let p = s.length;
    for (let k = 0; k <= skip; k++) { p = s.lastIndexOf(d, p - 1); if (p < 0) return -1; }
    return p;
  }
  let p = -1;
  for (let k = 0; k <= skip; k++) { p = s.indexOf(d, p + 1); if (p < 0) return -1; }
  return p;
}
def('Text.BeforeDelimiter', nullSafe((s: any, d: any, idx: any) => { const p = delimIndex(S(s), S(d), idx); return p < 0 ? S(s) : S(s).slice(0, p); }), 2, 3);
def('Text.AfterDelimiter', nullSafe((s: any, d: any, idx: any) => { const p = delimIndex(S(s), S(d), idx); return p < 0 ? '' : S(s).slice(p + S(d).length); }), 2, 3);
def('Text.BetweenDelimiters', nullSafe((s: any, a: any, b: any, ia: any, ib: any) => {
  const str = S(s); const p = delimIndex(str, S(a), ia); if (p < 0) return '';
  const rest = str.slice(p + S(a).length); const q = delimIndex(rest, S(b), ib);
  return q < 0 ? rest : rest.slice(0, q);
}), 3, 5);
def('Text.Contains', (s: any, sub: any, c: any) => (s === null ? null : eqText(c)(S(s)).includes(eqText(c)(S(sub)))), 2, 3);
def('Text.Equals', (a: any, b: any, c: any) => eqText(c)(S(a)) === eqText(c)(S(b)), 2, 3);
def('Text.FromBinary', (b: any) => (b === null ? null : new TextDecoder().decode((b as MBinary).bytes)), 1, 2);
def('Text.ToBinary', (s: any) => new MBinary(new TextEncoder().encode(S(s))), 1, 3);
def('Text.Clean', nullSafe((s: any) => S(s).replace(/\p{Cc}/gu, '')));
def('Character.FromNumber', (n: any) => String.fromCharCode(N(n)));
def('Character.ToNumber', (s: any) => S(s).charCodeAt(0));
def('Lines.FromBinary', (b: any) => new TextDecoder().decode((b as MBinary).bytes).split(/\r?\n/), 1, 4);
def('Lines.FromText', (s: any) => S(s).split(/\r?\n/), 1, 3);
def('Lines.ToText', (l: any, sep: any) => L(l).join(opt(sep, '\r\n')), 1, 2);

// ---------- Number ----------
def('Number.From', nullSafe((v: any) => { const r = convertValue(v, 'decimal'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Number.FromText', nullSafe((v: any) => { const r = convertValue(S(v), 'decimal'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Int64.From', nullSafe((v: any) => { const r = convertValue(v, 'int'); if (r instanceof MError) throw r; return r; }), 1, 3);
def('Int32.From', nullSafe((v: any) => { const r = convertValue(v, 'int'); if (r instanceof MError) throw r; return r; }), 1, 3);
def('Decimal.From', nullSafe((v: any) => { const r = convertValue(v, 'decimal'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Double.From', nullSafe((v: any) => { const r = convertValue(v, 'decimal'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Currency.From', nullSafe((v: any) => { const r = convertValue(v, 'currency'); if (r instanceof MError) throw r; return r; }), 1, 3);
def('Percentage.From', nullSafe((v: any) => { const r = convertValue(v, 'percent'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Number.ToText', nullSafe((n: any, f: any) => netNumberFormat(N(n), f ?? undefined)), 1, 3);
def('Number.Round', nullSafe((n: any, d: any, mode: any) => roundMode(N(n), opt(d, 0), opt(mode, 4))), 1, 3);
def('Number.RoundUp', nullSafe((n: any, d: any) => { const f = 10 ** opt(d, 0); return Math.ceil(N(n) * f) / f; }), 1, 2);
def('Number.RoundDown', nullSafe((n: any, d: any) => { const f = 10 ** opt(d, 0); return Math.floor(N(n) * f) / f; }), 1, 2);
def('Number.RoundTowardZero', nullSafe((n: any, d: any) => { const f = 10 ** opt(d, 0); return Math.trunc(N(n) * f) / f; }), 1, 2);
def('Number.RoundAwayFromZero', nullSafe((n: any, d: any) => roundMode(N(n), opt(d, 0), 2)), 1, 2);
function roundMode(n: number, d: number, mode: number) {
  const f = 10 ** d;
  switch (mode) {
    case 0: return Math.ceil(n * f) / f;
    case 1: return Math.floor(n * f) / f;
    case 2: return Math.sign(n) * Math.round(Math.abs(n) * f) / f;
    case 3: return Math.trunc(n * f) / f;
    default: return roundEven(n, d);
  }
}
def('Number.Abs', nullSafe((n: any) => Math.abs(N(n))));
def('Number.Sign', nullSafe((n: any) => Math.sign(N(n))));
def('Number.Mod', nullSafe((a: any, b: any) => { if (b === null) return null; const r = N(a) % N(b); return r; }), 2, 3);
def('Number.IntegerDivide', nullSafe((a: any, b: any) => (b === null ? null : Math.trunc(N(a) / N(b)))), 2, 3);
def('Number.Power', nullSafe((a: any, b: any) => (b === null ? null : Math.pow(N(a), N(b)))));
def('Number.Sqrt', nullSafe((n: any) => Math.sqrt(N(n))));
def('Number.Exp', nullSafe((n: any) => Math.exp(N(n))));
def('Number.Ln', nullSafe((n: any) => Math.log(N(n))));
def('Number.Log', nullSafe((n: any, b: any) => (b ? Math.log(N(n)) / Math.log(N(b)) : Math.log(N(n)))), 1, 2);
def('Number.Log10', nullSafe((n: any) => Math.log10(N(n))));
def('Number.IsEven', (n: any) => N(n) % 2 === 0);
def('Number.IsOdd', (n: any) => Math.abs(N(n) % 2) === 1);
def('Number.IsNaN', (n: any) => Number.isNaN(N(n)));
def('Number.Random', () => Math.random(), 0, 0);
def('Number.RandomBetween', (a: any, b: any) => N(a) + Math.random() * (N(b) - N(a)));
def('Number.Factorial', (n: any) => { let r = 1; for (let i = 2; i <= N(n); i++) r *= i; return r; });
def('Number.Cos', (n: any) => Math.cos(N(n))); def('Number.Sin', (n: any) => Math.sin(N(n))); def('Number.Tan', (n: any) => Math.tan(N(n)));
def('Value.Add', (a: any, b: any) => (a === null || b === null ? null : N(a) + N(b)), 2, 3);
def('Value.Subtract', (a: any, b: any) => (a === null || b === null ? null : N(a) - N(b)), 2, 3);
def('Value.Multiply', (a: any, b: any) => (a === null || b === null ? null : N(a) * N(b)), 2, 3);
def('Value.Divide', (a: any, b: any) => (a === null || b === null ? null : N(a) / N(b)), 2, 3);
def('Value.Equals', (a: any, b: any) => mEquals(a, b), 2, 3);
def('Value.Compare', (a: any, b: any) => Math.sign(compareValues(a, b)), 2, 3);
def('Value.Is', (v: any, t: any) => isType(v, t));
def('Value.As', (v: any, t: any) => { if (!isType(v, t)) err(`We cannot convert the value to type ${t.name}.`); return v; });
def('Value.Type', (v: any) => new MType(valueType(v) === 'int' ? 'decimal' : valueType(v)));
def('Value.ReplaceType', (v: any, t: any) => {
  if (v instanceof MTable && t instanceof MType && t.detail) return new MTable(v.columns.map((c, i) => ({ name: t.detail[i]?.name ?? c.name, type: t.detail[i]?.type ?? c.type })), v.rows);
  return v;
});
def('Value.Metadata', () => new MRecord(), 1, 1);
def('Value.RemoveMetadata', (v: any) => v, 1, 2);
def('Value.FromText', (s: any) => { if (s === null) return null; const t = detectType([s]); return t === 'any' || t === 'text' ? s : convertValue(s, t); }, 1, 2);
def('Type.Is', (a: any, b: any) => (a as MType).name === (b as MType).name || (b as MType).name === 'any');
def('Type.TableSchema', (t: any) => LIB['Table.Schema'].impl([new MTable(((t as MType).detail || []).map((c: any) => ({ name: c.name, type: c.type })), [])]));
def('Logical.From', nullSafe((v: any) => { const r = convertValue(v, 'bool'); if (r instanceof MError) throw r; return r; }));
def('Logical.FromText', nullSafe((v: any) => { const r = convertValue(S(v), 'bool'); if (r instanceof MError) throw r; return r; }));
def('Logical.ToText', nullSafe((v: any) => (v ? 'true' : 'false')));
def('Error.Record', (r: any, m: any, d: any) => MRecord.from({ Reason: r, Message: opt(m, null), Detail: opt(d, null) }), 1, 3);
def('Diagnostics.Trace', (_l: any, _m: any, v: any) => (v instanceof MFunction ? callFn(v, []) : v), 3, 4);
def('Function.Invoke', (f: any, args: any) => callFn(f, L(args)));
def('Expression.Constant', (v: any) => (typeof v === 'string' ? `"${v}"` : String(v)));

// ---------- Record ----------
const R = (v: any): MRecord => { if (!(v instanceof MRecord)) err(`We cannot convert a value of type ${typeLabel(v)} to type Record.`); return v; };
def('Record.Field', (r: any, f: any) => fieldOf(R(r), S(f), false));
def('Record.FieldOrDefault', (r: any, f: any, d: any) => (R(r).has(S(f)) ? R(r).get(S(f)) : opt(d, null)), 2, 3);
def('Record.FieldNames', (r: any) => [...R(r).names]);
def('Record.FieldValues', (r: any) => [...R(r).values]);
def('Record.FieldCount', (r: any) => R(r).names.length);
def('Record.HasFields', (r: any, f: any) => names(f).every(x => R(r).has(x)));
def('Record.ToList', (r: any) => [...R(r).values]);
def('Record.ToTable', (r: any) => new MTable([{ name: 'Name', type: 'text' }, { name: 'Value', type: 'any' }], R(r).names.map((n, i) => [n, R(r).values[i]])));
def('Record.FromList', (l: any, f: any) => new MRecord(names(f), [...L(l)]));
def('Record.FromTable', (t: any) => { const tt = T(t); const ni = tt.col('Name'), vi = tt.col('Value'); return new MRecord(tt.rows.map(r => r[ni]), tt.rows.map(r => r[vi])); });
def('Record.AddField', (r: any, f: any, v: any) => { if (R(r).has(S(f))) err(`The field '${f}' already exists in the record.`); return new MRecord([...R(r).names, S(f)], [...R(r).values, v]); }, 3, 4);
def('Record.RemoveFields', (r: any, f: any) => { const ns = names(f); const rr = R(r); const keep = rr.names.map((n, i) => ({ n, i })).filter(x => !ns.includes(x.n)); return new MRecord(keep.map(x => x.n), keep.map(x => rr.values[x.i])); }, 2, 3);
def('Record.SelectFields', (r: any, f: any) => { const rr = R(r); return new MRecord(names(f), names(f).map(n => rr.get(n) ?? null)); }, 2, 3);
def('Record.RenameFields', (r: any, ps: any) => { const rr = R(r); const l = L(ps); const pairs = l.length && !Array.isArray(l[0]) ? [l] : l; const nm = [...rr.names]; for (const [o, n] of pairs) { const i = nm.indexOf(o); if (i >= 0) nm[i] = n; } return new MRecord(nm, [...rr.values]); }, 2, 3);
def('Record.TransformFields', (r: any, ops: any) => { const rr = R(r); const l = L(ops); const ps = l.length && !Array.isArray(l[0]) ? [l] : l; const out = new MRecord([...rr.names], [...rr.values]); for (const [n, f] of ps) out.set(n, callFn(f, [rr.get(n)])); return out; }, 2, 3);
def('Record.Combine', (rs: any) => L(rs).reduce((a: MRecord, b: MRecord) => { const o = new MRecord([...a.names], [...a.values]); b.names.forEach((n, i) => o.set(n, b.values[i])); return o; }, new MRecord()));

// ---------- Date / DateTime / Time / Duration ----------
const dnull = (f: (d: Date, ...r: any[]) => any) => (d: any, ...r: any[]) => (d === null ? null : f(D(d), ...r));
def('#date', (y: any, m: any, d: any) => { const r = new Date(N(y), N(m) - 1, N(d)); if (r.getMonth() !== N(m) - 1) err('The Date operation failed. Invalid date.'); return r; });
def('#datetime', (y: any, m: any, d: any, h: any, mi: any, s: any) => new Date(N(y), N(m) - 1, N(d), N(h), N(mi), Math.floor(N(s)), (N(s) % 1) * 1000));
def('#datetimezone', (y: any, m: any, d: any, h: any, mi: any, s: any) => new Date(N(y), N(m) - 1, N(d), N(h), N(mi), N(s)), 6, 8);
def('#time', (h: any, m: any, s: any) => new MTime(((N(h) * 60 + N(m)) * 60 + N(s)) * 1000));
def('#duration', (d: any, h: any, m: any, s: any) => new MDuration((((N(d) * 24 + N(h)) * 60 + N(m)) * 60 + N(s)) * 1000));
def('#binary', (l: any) => new MBinary(new Uint8Array(L(l))));
for (const k of ['Date', 'DateTime', 'DateTimeZone']) {
  def(`${k}.From`, nullSafe((v: any) => { const r = convertValue(v, k === 'Date' ? 'date' : 'datetime'); if (r instanceof MError) throw r; return r; }), 1, 2);
  def(`${k}.FromText`, nullSafe((v: any, o: any) => {
    const fmt = o instanceof MRecord ? o.get('Format') : undefined;
    const r = fmt ? parseWithFormat(S(v), fmt) : convertValue(S(v), k === 'Date' ? 'date' : 'datetime');
    if (r instanceof MError) throw r; return r;
  }), 1, 2);
  def(`${k}.ToText`, dnull((d, f) => { const fmt = f instanceof MRecord ? f.get('Format') : f; return netDateFormat(d, fmt ?? (k === 'Date' ? 'd' : 'g')); }), 1, 3);
}
function parseWithFormat(s: string, fmt: string): Date | MError {
  const parts: string[] = []; const re = /yyyy|yy|MMMM|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|tt/g;
  const rx = fmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(re, tok => { parts.push(tok); return tok.startsWith('MMM') ? '([A-Za-z]+)' : tok === 'tt' ? '(AM|PM)' : '(\\d{1,4})'; });
  const m = new RegExp(`^${rx}$`, 'i').exec(s.trim());
  if (!m) return new MError('DataFormat.Error', 'We couldn\'t parse the input provided as a Date value.', s);
  let y = 1900, mo = 0, d = 1, h = 0, mi = 0, se = 0, pm = false;
  parts.forEach((p, i) => {
    const v = m[i + 1];
    switch (p) {
      case 'yyyy': y = +v; break; case 'yy': y = 2000 + +v; break;
      case 'MMMM': case 'MMM': mo = MONTHS.findIndex(x => x.toLowerCase().startsWith(v.toLowerCase().slice(0, 3))); break;
      case 'MM': case 'M': mo = +v - 1; break; case 'dd': case 'd': d = +v; break;
      case 'HH': case 'H': case 'hh': case 'h': h = +v; break; case 'mm': mi = +v; break; case 'ss': se = +v; break;
      case 'tt': pm = v.toUpperCase() === 'PM'; break;
    }
  });
  if (pm && h < 12) h += 12;
  return new Date(y, mo, d, h, mi, se);
}
def('Date.Year', dnull(d => d.getFullYear()));
def('Date.Month', dnull(d => d.getMonth() + 1));
def('Date.Day', dnull(d => d.getDate()));
def('Date.DayOfWeek', dnull((d, first) => (d.getDay() - opt(first, 0) + 7) % 7), 1, 2);
def('Date.DayOfWeekName', dnull(d => DAYS[d.getDay()]), 1, 2);
def('Date.MonthName', dnull(d => MONTHS[d.getMonth()]), 1, 2);
def('Date.DayOfYear', dnull(d => Math.round((dateOnly(d).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1));
def('Date.QuarterOfYear', dnull(d => Math.floor(d.getMonth() / 3) + 1));
def('Date.WeekOfYear', dnull((d, f) => weekNum(d, opt(f, 0))), 1, 2);
def('Date.WeekOfMonth', dnull((d, f) => { const first = new Date(d.getFullYear(), d.getMonth(), 1); const off = (first.getDay() - opt(f, 0) + 7) % 7; return Math.floor((d.getDate() - 1 + off) / 7) + 1; }), 1, 2);
def('Date.DaysInMonth', dnull(d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
def('Date.IsLeapYear', dnull(d => new Date(d.getFullYear(), 1, 29).getMonth() === 1));
def('Date.StartOfYear', dnull(d => new Date(d.getFullYear(), 0, 1)));
def('Date.EndOfYear', dnull(d => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)));
def('Date.StartOfQuarter', dnull(d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)));
def('Date.EndOfQuarter', dnull(d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999)));
def('Date.StartOfMonth', dnull(d => new Date(d.getFullYear(), d.getMonth(), 1)));
def('Date.EndOfMonth', dnull(d => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)));
def('Date.StartOfWeek', dnull((d, f) => { const k = (d.getDay() - opt(f, 0) + 7) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - k); }), 1, 2);
def('Date.EndOfWeek', dnull((d, f) => { const k = (d.getDay() - opt(f, 0) + 7) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - k + 6, 23, 59, 59, 999); }), 1, 2);
def('Date.StartOfDay', dnull(d => dateOnly(d)));
def('Date.EndOfDay', dnull(d => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)));
function addMonths(d: Date, n: number) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds());
  r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
}
def('Date.AddDays', dnull((d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + N(n), d.getHours(), d.getMinutes(), d.getSeconds())));
def('Date.AddWeeks', dnull((d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * N(n), d.getHours(), d.getMinutes(), d.getSeconds())));
def('Date.AddMonths', dnull((d, n) => addMonths(d, N(n))));
def('Date.AddQuarters', dnull((d, n) => addMonths(d, 3 * N(n))));
def('Date.AddYears', dnull((d, n) => addMonths(d, 12 * N(n))));
def('Date.IsInCurrentYear', dnull(d => d.getFullYear() === new Date().getFullYear()));
def('Date.IsInCurrentMonth', dnull(d => d.getFullYear() === new Date().getFullYear() && d.getMonth() === new Date().getMonth()));
def('Date.IsInPreviousNDays', dnull((d, n) => { const t = dateOnly(new Date()); return d < t && d >= new Date(t.getTime() - N(n) * 86400000); }));
def('Date.ToRecord', dnull(d => MRecord.from({ Year: d.getFullYear(), Month: d.getMonth() + 1, Day: d.getDate() })));
def('DateTime.LocalNow', () => new Date(), 0, 0);
def('DateTime.FixedLocalNow', () => new Date(), 0, 0);
def('DateTimeZone.LocalNow', () => new Date(), 0, 0);
def('DateTimeZone.UtcNow', () => new Date(), 0, 0);
def('DateTimeZone.FixedUtcNow', () => new Date(), 0, 0);
def('DateTimeZone.RemoveZone', (d: any) => d);
def('DateTimeZone.SwitchZone', (d: any) => d, 2, 3);
def('DateTimeZone.ToLocal', (d: any) => d);
def('DateTime.Date', dnull(d => dateOnly(d)));
def('DateTime.Time', dnull(d => new MTime(((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000)));
def('DateTime.AddZone', (d: any) => d, 2, 3);
def('Date.Time', dnull(d => new MTime(((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000)));
def('Time.From', nullSafe((v: any) => { const r = convertValue(v, 'time'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Time.FromText', nullSafe((v: any) => { const r = convertValue(S(v), 'time'); if (r instanceof MError) throw r; return r; }), 1, 2);
def('Time.ToText', nullSafe((t: any, f: any) => (f ? netDateFormat(new Date(2000, 0, 1, t.h, t.m, t.s), f instanceof MRecord ? f.get('Format') : f) : t.toString())), 1, 3);
const tget = (f: (t: MTime) => number) => (v: any) => (v === null ? null : v instanceof Date ? f(new MTime(((v.getHours() * 60 + v.getMinutes()) * 60 + v.getSeconds()) * 1000)) : f(v));
def('Time.Hour', tget(t => t.h)); def('Time.Minute', tget(t => t.m)); def('Time.Second', tget(t => t.s));
def('Time.StartOfHour', (t: any) => (t instanceof Date ? new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours()) : new MTime(t.h * 3600000)));
def('Duration.From', nullSafe((v: any) => { const r = convertValue(v, 'duration'); if (r instanceof MError) throw r; return r; }));
def('Duration.FromText', nullSafe((v: any) => { const r = convertValue(S(v), 'duration'); if (r instanceof MError) throw r; return r; }));
def('Duration.ToText', nullSafe((d: any) => d.toString()), 1, 2);
const dur = (f: (ms: number) => number) => (d: any) => (d === null ? null : f((d as MDuration).ms));
def('Duration.Days', dur(ms => Math.trunc(ms / 86400000)));
def('Duration.Hours', dur(ms => Math.trunc(ms / 3600000) % 24));
def('Duration.Minutes', dur(ms => Math.trunc(ms / 60000) % 60));
def('Duration.Seconds', dur(ms => (ms / 1000) % 60));
def('Duration.TotalDays', dur(ms => ms / 86400000));
def('Duration.TotalHours', dur(ms => ms / 3600000));
def('Duration.TotalMinutes', dur(ms => ms / 60000));
def('Duration.TotalSeconds', dur(ms => ms / 1000));
def('Date.Serial', (d: any) => toSerial(D(d)));
def('Date.FromSerial', (n: any) => fromSerial(N(n)));
void parseDate;

// Binary
def('Binary.FromText', (s: any) => { const raw = atob(S(s)); return new MBinary(Uint8Array.from(raw, c => c.charCodeAt(0))); }, 1, 2);
def('Binary.ToText', (b: any) => btoa(String.fromCharCode(...(b as MBinary).bytes)), 1, 2);
def('Binary.Length', (b: any) => (b as MBinary).bytes.length);
def('Binary.Buffer', (b: any) => b);
def('Binary.Decompress', (b: any) => b, 2, 2);
def('Binary.Combine', (bs: any) => { const parts = L(bs) as MBinary[]; const n = parts.reduce((a, b) => a + b.bytes.length, 0); const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p.bytes, o); o += p.bytes.length; } return new MBinary(out); });

// Uri / misc
def('Uri.Parts', (u: any) => { const x = new URL(S(u)); return MRecord.from({ Scheme: x.protocol.replace(':', ''), Host: x.hostname, Port: +x.port || null, Path: x.pathname, Query: new MRecord(), Fragment: x.hash }); });
def('Uri.EscapeDataString', (s: any) => encodeURIComponent(S(s)));

export function hasLib(name: string) { return name in LIB; }
export { primToType };
