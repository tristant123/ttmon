// Type conversion as done by "Changed Type" (Table.TransformColumnTypes) and the *.From functions.
import {
  DataType, MError, MTime, MDuration, parseDate, parseNumber, parseTime, fromSerial, toSerial, dateOnly, fmtDate, valueType,
} from '../core/values';
import { netDateFormat } from '../core/format';

const typeWord: Record<string, string> = {
  text: 'Text', int: 'Number', decimal: 'Number', currency: 'Number', percent: 'Number', bool: 'Logical',
  date: 'Date', datetime: 'DateTime', datetimezone: 'DateTimeZone', time: 'Time', duration: 'Duration',
};

function fail(v: any, t: DataType): MError {
  return new MError('DataFormat.Error', `We couldn't convert to ${typeWord[t] || t}.`, v);
}

export function textFrom(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? String(+v.toPrecision(15)) : String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return valueType(v) === 'date' ? fmtDate(v) : fmtDate(v, true);
  if (v instanceof MTime) return v.toString();
  if (v instanceof MDuration) return v.toString();
  throw new MError('Expression.Error', `We cannot convert a value of type ${valueType(v)} to type Text.`);
}

/** Convert a value to a type; returns an MError (not thrown) on failure, as a cell error. */
export function convertValue(v: any, t: DataType): any {
  if (v === null || v === undefined) return null;
  if (v instanceof MError) return v;
  if (t !== 'text' && t !== 'any' && typeof v === 'string' && v.trim() === '') return null;
  try {
    switch (t) {
      case 'any': return v;
      case 'text': return textFrom(v);
      case 'int': case 'decimal': case 'currency': case 'percent': {
        let n: number | null;
        if (typeof v === 'number') n = v;
        else if (typeof v === 'boolean') n = v ? 1 : 0;
        else if (typeof v === 'string') { n = parseNumber(v); if (n === null) return fail(v, t); }
        else if (v instanceof Date) n = toSerial(v);
        else if (v instanceof MDuration) n = v.ms / 86400000;
        else if (v instanceof MTime) n = v.ms / 86400000;
        else return fail(v, t);
        if (t === 'int') return roundEven(n);
        if (t === 'currency') return Math.round(n * 10000) / 10000;
        return n;
      }
      case 'bool': {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          if (s === 'true') return true; if (s === 'false') return false;
        }
        return fail(v, t);
      }
      case 'date': {
        if (v instanceof Date) return dateOnly(v);
        if (typeof v === 'number') return dateOnly(fromSerial(v));
        if (typeof v === 'string') { const d = parseDate(v); if (!d) return fail(v, t); return dateOnly(d); }
        return fail(v, t);
      }
      case 'datetime': case 'datetimezone': {
        if (v instanceof Date) return v;
        if (typeof v === 'number') return fromSerial(v);
        if (typeof v === 'string') { const d = parseDate(v); if (!d) return fail(v, t); return d; }
        return fail(v, t);
      }
      case 'time': {
        if (v instanceof MTime) return v;
        if (v instanceof Date) return new MTime(((v.getHours() * 60 + v.getMinutes()) * 60 + v.getSeconds()) * 1000);
        if (typeof v === 'number') return new MTime(Math.round((v - Math.floor(v)) * 86400000));
        if (typeof v === 'string') {
          const tm = parseTime(v); if (tm) return tm;
          const d = parseDate(v); if (d) return convertValue(d, 'time');
          return fail(v, t);
        }
        return fail(v, t);
      }
      case 'duration': {
        if (v instanceof MDuration) return v;
        if (typeof v === 'number') return new MDuration(v * 86400000);
        if (typeof v === 'string') {
          const m = /^(-)?(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(v.trim());
          if (!m) return fail(v, t);
          const ms = (((+(m[2] || 0) * 24 + +m[3]) * 60 + +m[4]) * 60 + +(m[5] || 0)) * 1000;
          return new MDuration(m[1] ? -ms : ms);
        }
        return fail(v, t);
      }
    }
    return v;
  } catch (e) {
    if (e instanceof MError) return e;
    throw e;
  }
}

export function roundEven(n: number, digits = 0) {
  const f = Math.pow(10, digits);
  const x = n * f;
  const r = Math.round(x);
  const isHalf = Math.abs(x % 1) === 0.5;
  return (isHalf ? (r % 2 === 0 ? r : r - 1) : r) / f;
}

/** Power Query's type detection (used for the automatic "Changed Type" step and "Detect Data Type"). */
export function detectType(values: any[]): DataType {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 1000);
  if (!sample.length) return 'any';
  const tests: [DataType, (v: any) => boolean][] = [
    ['bool', v => typeof v === 'boolean' || (typeof v === 'string' && /^(true|false)$/i.test(v.trim()))],
    ['int', v => (typeof v === 'number' && Number.isInteger(v)) || (typeof v === 'string' && /^[+-]?\d{1,15}$/.test(v.trim()))],
    ['decimal', v => typeof v === 'number' || (typeof v === 'string' && parseNumber(v) !== null && !/%$/.test(v.trim()) && !/^[$€£]/.test(v.trim()))],
    ['currency', v => typeof v === 'string' && /^-?[$€£]/.test(v.trim()) && parseNumber(v) !== null],
    ['percent', v => typeof v === 'string' && /%$/.test(v.trim()) && parseNumber(v) !== null],
    ['date', v => (v instanceof Date && !v.getHours() && !v.getMinutes() && !v.getSeconds()) || (typeof v === 'string' && !/[:]/.test(v) && !/^\d+$/.test(v.trim()) && parseDate(v) !== null)],
    ['datetime', v => v instanceof Date || (typeof v === 'string' && /:/.test(v) && parseDate(v) !== null)],
    ['time', v => v instanceof MTime || (typeof v === 'string' && parseTime(v) !== null)],
  ];
  for (const [t, f] of tests) if (sample.every(f)) return t;
  if (sample.every(v => typeof v === 'number')) return 'decimal';
  return 'text';
}

/** Date.ToText / DateTime.ToText */
export function dateToText(d: Date, fmt?: string) { return fmt ? netDateFormat(d, fmt) : fmtDate(d); }
