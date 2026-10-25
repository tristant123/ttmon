// Shared value representation for the M (Power Query) and DAX engines.
//
//   null              -> null / BLANK()
//   number            -> number (whole, decimal, currency, percentage)
//   string            -> text
//   boolean           -> logical / True/False
//   Date              -> date or datetime (local time; date-only values sit at midnight)
//   MTime             -> time of day
//   MDuration         -> duration
//   MError            -> a cell-level error (Power Query "Error" cells)
//   MRecord, arrays, MTable, MFunction, MType, MBinary  -> M-only structured values

export type DataType =
  | 'text' | 'int' | 'decimal' | 'currency' | 'percent' | 'bool'
  | 'date' | 'datetime' | 'datetimezone' | 'time' | 'duration' | 'binary' | 'any'
  | 'table' | 'record' | 'list' | 'function' | 'type' | 'null';

export class MTime {
  constructor(public ms: number) {}
  get h() { return Math.floor(this.ms / 3600000); }
  get m() { return Math.floor(this.ms / 60000) % 60; }
  get s() { return Math.floor(this.ms / 1000) % 60; }
  toString() { return `${pad(this.h)}:${pad(this.m)}:${pad(this.s)}`; }
}

export class MDuration {
  constructor(public ms: number) {}
  toString() {
    const neg = this.ms < 0; let t = Math.abs(this.ms);
    const d = Math.floor(t / 86400000); t -= d * 86400000;
    const h = Math.floor(t / 3600000); t -= h * 3600000;
    const m = Math.floor(t / 60000); t -= m * 60000;
    const s = t / 1000;
    return `${neg ? '-' : ''}${d}.${pad(h)}:${pad(m)}:${pad(Math.floor(s))}`;
  }
}

export class MError {
  constructor(public reason: string, public message: string, public detail?: any) {}
  toString() { return `Error: ${this.message}`; }
}

export class MBinary {
  constructor(public bytes: Uint8Array, public name?: string) {}
}

export class MRecord {
  names: string[];
  values: any[];
  constructor(names: string[] = [], values: any[] = []) { this.names = names; this.values = values; }
  static from(obj: Record<string, any>) { return new MRecord(Object.keys(obj), Object.values(obj)); }
  has(n: string) { return this.names.includes(n); }
  get(n: string) { const i = this.names.indexOf(n); return i < 0 ? undefined : this.values[i]; }
  set(n: string, v: any) {
    const i = this.names.indexOf(n);
    if (i < 0) { this.names.push(n); this.values.push(v); } else this.values[i] = v;
  }
}

export interface Column { name: string; type: DataType; }

export class MTable {
  constructor(public columns: Column[], public rows: any[][]) {}
  get names() { return this.columns.map(c => c.name); }
  idx(name: string) { return this.columns.findIndex(c => c.name === name); }
  col(name: string) {
    const i = this.idx(name);
    if (i < 0) throw new MError('Expression.Error', `The column '${name}' of the table wasn't found.`);
    return i;
  }
}

export class MFunction {
  constructor(
    public name: string,
    public impl: (args: any[]) => any,
    public arity: [number, number] = [0, 99],
    public paramNames: string[] = [],
  ) {}
}

export class MType {
  constructor(public name: DataType, public nullable = false, public detail?: any) {}
}

export function pad(n: number, w = 2) { return String(n).padStart(w, '0'); }

export const isDate = (v: any): v is Date => v instanceof Date;
export const isBlank = (v: any) => v === null || v === undefined;

export function dateOnly(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Excel/DAX serial date (days since 1899-12-30)
const EPOCH = new Date(1899, 11, 30).getTime();
export function toSerial(d: Date) {
  const utcMid = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const frac = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
  return Math.round((utcMid - Date.UTC(1899, 11, 30)) / 86400000) + frac;
}
export function fromSerial(n: number) {
  const days = Math.floor(n); const frac = n - days;
  const base = new Date(1899, 11, 30);
  base.setDate(base.getDate() + days);
  if (frac) base.setTime(base.getTime() + Math.round(frac * 86400000));
  return base;
}
void EPOCH;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export { MONTHS, DAYS };

const MON3: Record<string, number> = {};
MONTHS.forEach((m, i) => { MON3[m.slice(0, 3).toLowerCase()] = i; MON3[m.toLowerCase()] = i; });

/** Parse text to a Date using the formats Power Query / Power BI accept for en-US. */
export function parseDate(s: string): Date | null {
  s = s.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return valid(d, +m[1], +m[2] - 1, +m[3]);
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(s);
  if (m) {
    let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
    let h = +(m[4] || 0); const ap = (m[7] || '').toUpperCase();
    if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
    // en-US: month first. Fall back to day-first when month > 12.
    let mo = +m[1] - 1, da = +m[2];
    if (mo > 11 && da <= 12) { mo = da - 1; da = +m[1]; }
    const d = new Date(y, mo, da, h, +(m[5] || 0), +(m[6] || 0));
    return valid(d, y, mo, da);
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-,]+(\d{2,4})$/.exec(s);
  if (m && MON3[m[2].toLowerCase()] !== undefined) {
    let y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, MON3[m[2].toLowerCase()], +m[1]);
  }
  m = /^(?:[A-Za-z]+,?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (m && MON3[m[1].toLowerCase()] !== undefined) return new Date(+m[3], MON3[m[1].toLowerCase()], +m[2]);
  m = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(s);
  if (m && MON3[m[1].toLowerCase()] !== undefined) return new Date(+m[2], MON3[m[1].toLowerCase()], 1);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return valid(new Date(+m[1], +m[2] - 1, +m[3]), +m[1], +m[2] - 1, +m[3]);
  return null;
}
function valid(d: Date, y: number, mo: number, da: number) {
  return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === da ? d : null;
}

export function parseTime(s: string): MTime | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(AM|PM)?$/i.exec(s.trim());
  if (!m) return null;
  let h = +m[1]; const ap = (m[5] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return new MTime(((h * 60 + +m[2]) * 60 + +(m[3] || 0)) * 1000);
}

/** Number parsing as the en-US culture does: thousands separators, currency, %, parentheses negatives. */
export function parseNumber(s: string): number | null {
  let t = s.trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  let pct = false;
  if (t.endsWith('%')) { pct = true; t = t.slice(0, -1); }
  t = t.replace(/^[$€£¥]/, '').replace(/^-[$€£¥]/, '-').replace(/,/g, '').trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  let n = Number(t);
  if (pct) n /= 100;
  return neg ? -n : n;
}

export function typeName(t: DataType): string {
  return ({
    text: 'Text', int: 'Whole Number', decimal: 'Decimal Number', currency: 'Fixed Decimal Number',
    percent: 'Percentage', bool: 'True/False', date: 'Date', datetime: 'Date/Time', datetimezone: 'Date/Time/Timezone',
    time: 'Time', duration: 'Duration', binary: 'Binary', any: 'Any', table: 'Table', record: 'Record',
    list: 'List', function: 'Function', type: 'Type', null: 'Null',
  } as Record<string, string>)[t] || t;
}

export const isNumericType = (t: DataType) => t === 'int' || t === 'decimal' || t === 'currency' || t === 'percent';
export const isDateType = (t: DataType) => t === 'date' || t === 'datetime' || t === 'datetimezone';

/** Infer the M type of a single value. */
export function valueType(v: any): DataType {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'decimal';
  if (typeof v === 'string') return 'text';
  if (typeof v === 'boolean') return 'bool';
  if (v instanceof Date) return v.getHours() || v.getMinutes() || v.getSeconds() ? 'datetime' : 'date';
  if (v instanceof MTime) return 'time';
  if (v instanceof MDuration) return 'duration';
  if (v instanceof MTable) return 'table';
  if (v instanceof MRecord) return 'record';
  if (Array.isArray(v)) return 'list';
  if (v instanceof MFunction) return 'function';
  if (v instanceof MType) return 'type';
  if (v instanceof MBinary) return 'binary';
  return 'any';
}

/** Total order used by sorting in both engines: blanks first, then numbers, text, etc. */
export function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (a instanceof MTime && b instanceof MTime) return a.ms - b.ms;
  if (a instanceof MDuration && b instanceof MDuration) return a.ms - b.ms;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const rank = (v: any) => typeof v === 'number' ? 1 : v instanceof Date ? 2 : typeof v === 'string' ? 3 : typeof v === 'boolean' ? 4 : 5;
  return rank(a) - rank(b);
}

/** Stable key for a value, so it can sit in a Set/Map. */
export function keyOf(v: any): string {
  if (v === null || v === undefined) return '\u0000';
  if (typeof v === 'number') return 'n' + v;
  if (typeof v === 'string') return 's' + v;
  if (typeof v === 'boolean') return v ? 'T' : 'F';
  if (v instanceof Date) return 'd' + v.getTime();
  if (v instanceof MTime) return 't' + v.ms;
  if (v instanceof MDuration) return 'u' + v.ms;
  if (v instanceof MError) return 'e' + v.message;
  return 'o' + JSON.stringify(v);
}
export function tupleKey(vs: any[]) { return vs.length === 1 ? keyOf(vs[0]) : vs.map(keyOf).join('\u0001'); }

export function valuesEqual(a: any, b: any) { return keyOf(a) === keyOf(b); }

// ---------- display formatting ----------

export function fmtDate(d: Date, withTime = false) {
  const s = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  if (!withTime) return s;
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${s} ${h}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ap}`;
}

/** How a value shows in a Power Query / Table view grid cell. */
export function displayValue(v: any, type?: DataType): string {
  if (v === null || v === undefined) return 'null';
  if (v instanceof MError) return 'Error';
  if (v instanceof Date) {
    if (type === 'date') return fmtDate(v);
    if (type === 'datetime' || type === 'datetimezone') return fmtDate(v, true);
    return valueType(v) === 'date' && type !== 'any' ? fmtDate(v) : fmtDate(v, true);
  }
  if (typeof v === 'number') {
    if (type === 'percent') return `${+(v * 100).toFixed(10)}%`;
    if (!isFinite(v)) return v > 0 ? 'Infinity' : v < 0 ? '-Infinity' : 'NaN';
    return String(+v.toPrecision(15));
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof MTable) return 'Table';
  if (v instanceof MRecord) return 'Record';
  if (Array.isArray(v)) return 'List';
  if (v instanceof MFunction) return 'Function';
  if (v instanceof MBinary) return 'Binary';
  if (v instanceof MType) return 'Type';
  return String(v);
}
