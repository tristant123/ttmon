// Format strings: .NET style (Power Query's Date.ToText / Number.ToText) and
// VBA style (DAX FORMAT and Power BI column format strings).
import { MONTHS, DAYS, pad, fmtDate, MTime } from './values';

function ampm(h: number) { return h >= 12 ? 'PM' : 'AM'; }

/** .NET custom date format: yyyy MM dd HH mm ss tt MMM MMMM ddd dddd */
export function netDateFormat(d: Date, f: string): string {
  if (f === 'd') return fmtDate(d);
  if (f === 'D') return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (f === 'g' || f === 'G') return fmtDate(d, true);
  if (f === 'yyyy-MM-dd' || f === 'o') { /* fallthrough to tokenizer */ }
  const re = /yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|tt|fff|"[^"]*"|'[^']*'|\\./g;
  return f.replace(re, tok => {
    switch (tok) {
      case 'yyyy': return String(d.getFullYear());
      case 'yy': return pad(d.getFullYear() % 100);
      case 'MMMM': return MONTHS[d.getMonth()];
      case 'MMM': return MONTHS[d.getMonth()].slice(0, 3);
      case 'MM': return pad(d.getMonth() + 1);
      case 'M': return String(d.getMonth() + 1);
      case 'dddd': return DAYS[d.getDay()];
      case 'ddd': return DAYS[d.getDay()].slice(0, 3);
      case 'dd': return pad(d.getDate());
      case 'd': return String(d.getDate());
      case 'HH': return pad(d.getHours());
      case 'H': return String(d.getHours());
      case 'hh': return pad(d.getHours() % 12 || 12);
      case 'h': return String(d.getHours() % 12 || 12);
      case 'mm': return pad(d.getMinutes());
      case 'm': return String(d.getMinutes());
      case 'ss': return pad(d.getSeconds());
      case 's': return String(d.getSeconds());
      case 'tt': return ampm(d.getHours());
      case 'fff': return pad(d.getMilliseconds(), 3);
    }
    if (tok.startsWith('\\')) return tok.slice(1);
    return tok.slice(1, -1);
  });
}

/** VBA / DAX date format: yyyy mm dd hh nn ss mmm mmmm ddd dddd q AM/PM */
export function vbaDateFormat(d: Date, f: string): string {
  const named: Record<string, string> = {
    'general date': 'g', 'long date': 'dddd, mmmm d, yyyy', 'medium date': 'dd-mmm-yy', 'short date': 'm/d/yyyy',
    'long time': 'h:nn:ss AM/PM', 'medium time': 'hh:nn AM/PM', 'short time': 'hh:nn',
  };
  const nf = named[f.toLowerCase()];
  if (nf === 'g') return fmtDate(d, d.getHours() + d.getMinutes() + d.getSeconds() > 0);
  if (nf) f = nf;
  const hasAmPm = /AM\/PM|am\/pm|A\/P/i.test(f);
  const re = /yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|nn|n|ss|s|AM\/PM|am\/pm|A\/P|q|ww|w|y|"[^"]*"|\\./gi;
  let prevWasHour = false;
  return f.replace(re, (tok) => {
    const t = tok.toLowerCase();
    let out: string;
    switch (t) {
      case 'yyyy': out = String(d.getFullYear()); break;
      case 'yy': out = pad(d.getFullYear() % 100); break;
      case 'y': out = String(Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1); break;
      case 'mmmm': out = MONTHS[d.getMonth()]; break;
      case 'mmm': out = MONTHS[d.getMonth()].slice(0, 3); break;
      case 'mm': out = prevWasHour ? pad(d.getMinutes()) : pad(d.getMonth() + 1); break;
      case 'm': out = prevWasHour ? String(d.getMinutes()) : String(d.getMonth() + 1); break;
      case 'dddd': out = DAYS[d.getDay()]; break;
      case 'ddd': out = DAYS[d.getDay()].slice(0, 3); break;
      case 'dd': out = pad(d.getDate()); break;
      case 'd': out = String(d.getDate()); break;
      case 'hh': out = pad(hasAmPm ? d.getHours() % 12 || 12 : d.getHours()); break;
      case 'h': out = String(hasAmPm ? d.getHours() % 12 || 12 : d.getHours()); break;
      case 'nn': out = pad(d.getMinutes()); break;
      case 'n': out = String(d.getMinutes()); break;
      case 'ss': out = pad(d.getSeconds()); break;
      case 's': out = String(d.getSeconds()); break;
      case 'am/pm': out = tok === 'am/pm' ? ampm(d.getHours()).toLowerCase() : ampm(d.getHours()); break;
      case 'a/p': out = d.getHours() >= 12 ? 'P' : 'A'; break;
      case 'q': out = String(Math.floor(d.getMonth() / 3) + 1); break;
      case 'w': out = String(d.getDay() + 1); break;
      case 'ww': out = String(weekNum(d)); break;
      default: out = tok.startsWith('\\') ? tok.slice(1) : tok.slice(1, -1);
    }
    prevWasHour = t === 'h' || t === 'hh';
    return out;
  });
}

export function weekNum(d: Date, startDay = 0) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const offset = (jan1.getDay() - startDay + 7) % 7;
  const day = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
  return Math.floor((day + offset) / 7) + 1;
}

function groupThousands(intPart: string) { return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

/** Custom numeric format with sections ("pos;neg;zero"), 0 # , . % E literals. */
export function customNumberFormat(n: number, fmt: string): string {
  const sections = splitSections(fmt);
  let f = sections[0];
  let neg = n < 0;
  if (n < 0 && sections[1] !== undefined) { f = sections[1]; n = -n; neg = false; }
  else if (n === 0 && sections[2] !== undefined) f = sections[2];
  else if (neg) n = -n;

  // split literal text and the numeric picture
  const lits: string[] = [];
  f = f.replace(/"([^"]*)"|\\(.)/g, (_m, a, b) => { lits.push(a ?? b); return `\u0000${lits.length - 1}\u0000`; });
  const pct = (f.match(/%/g) || []).length;
  if (pct) n = n * Math.pow(100, pct);
  // scaling commas immediately before the decimal point / end
  const picMatch = /[#0][#0,.]*/.exec(f);
  if (!picMatch) return restore(f, lits).replace(/%/g, '%');
  let pic = picMatch[0];
  let scale = 0;
  while (/,$/.test(pic) || /,\./.test(pic)) {
    if (/,$/.test(pic)) { pic = pic.slice(0, -1); scale++; } else { pic = pic.replace(/,\./, '.'); scale++; }
  }
  if (scale) n = n / Math.pow(1000, scale);
  const [ip, dp = ''] = pic.split('.');
  const useGroup = ip.includes(',');
  const minDec = (dp.match(/0/g) || []).length;
  const maxDec = dp.length;
  let s = n.toFixed(maxDec);
  if (maxDec > minDec) { s = s.replace(/0+$/, m => m.slice(0, Math.max(0, m.length - (maxDec - minDec)))); if (s.endsWith('.')) s = s.slice(0, -1); }
  let [i, d] = s.split('.');
  const minInt = (ip.replace(/,/g, '').match(/0/g) || []).length;
  if (i === '0' && minInt === 0) i = '';
  i = i.padStart(minInt, '0');
  if (useGroup) i = groupThousands(i);
  const num = i + (d !== undefined && d !== '' ? '.' + d : (maxDec && minDec ? '.' : ''));
  const out = f.slice(0, picMatch.index) + num + f.slice(picMatch.index + picMatch[0].length);
  return (neg ? '-' : '') + restore(out, lits);
}

function restore(s: string, lits: string[]) { return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => lits[+i]); }

function splitSections(f: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (const c of f) { if (c === '"') q = !q; if (c === ';' && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur);
  return out;
}

/** VBA/DAX number format (FORMAT function and model format strings). */
export function vbaNumberFormat(n: number, f: string): string {
  switch (f.toLowerCase()) {
    case 'general number': case 'g': return String(+n.toPrecision(15));
    case 'currency': case 'c': return (n < 0 ? '-$' : '$') + groupThousands(Math.abs(n).toFixed(2).split('.')[0]) + '.' + Math.abs(n).toFixed(2).split('.')[1];
    case 'fixed': case 'f': return n.toFixed(2);
    case 'standard': case 'n': return customNumberFormat(n, '#,##0.00');
    case 'percent': case 'p': return (n * 100).toFixed(2) + '%';
    case 'scientific': case 'e': return n.toExponential(2).toUpperCase();
    case 'yes/no': return n ? 'Yes' : 'No';
    case 'true/false': return n ? 'True' : 'False';
    case 'on/off': return n ? 'On' : 'Off';
  }
  const m = /^([CNFPDX])(\d+)$/i.exec(f);
  if (m) {
    const k = +m[2];
    switch (m[1].toUpperCase()) {
      case 'C': return customNumberFormat(n, '$#,##0' + (k ? '.' + '0'.repeat(k) : ''));
      case 'N': return customNumberFormat(n, '#,##0' + (k ? '.' + '0'.repeat(k) : ''));
      case 'F': return n.toFixed(k);
      case 'P': return customNumberFormat(n, '0' + (k ? '.' + '0'.repeat(k) : '') + '%');
      case 'D': return String(Math.round(n)).padStart(k, '0');
      case 'X': return Math.round(n).toString(16).toUpperCase().padStart(k, '0');
    }
  }
  return customNumberFormat(n, f);
}

/** .NET Number.ToText formats ("N2", "P1", "0.00", "D4" ...) */
export function netNumberFormat(n: number, f?: string): string {
  if (!f) return String(+n.toPrecision(15));
  return vbaNumberFormat(n, f);
}

export function isDateFormat(f: string) {
  return /^(general date|long date|medium date|short date|long time|medium time|short time)$/i.test(f) || /(yy|dd|mmm|hh|nn|ss|m\/|\/m|d\/|\/d|q)/i.test(f.replace(/"[^"]*"/g, ''));
}

/** Format any value with a DAX/model format string. */
export function formatValue(v: any, f?: string): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (!f || !isDateFormat(f)) return fmtDate(v, v.getHours() + v.getMinutes() + v.getSeconds() > 0);
    return vbaDateFormat(v, f);
  }
  if (v instanceof MTime) return f && isDateFormat(f) ? vbaDateFormat(new Date(2000, 0, 1, v.h, v.m, v.s), f) : v.toString();
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') {
    if (!isFinite(v)) return v > 0 ? 'Infinity' : v < 0 ? '-Infinity' : 'NaN';
    if (!f) return String(+v.toPrecision(15));
    return vbaNumberFormat(v, f);
  }
  return String(v);
}

/** Power BI's compact display units on visuals: 1.2K, 3.4M, 5.6bn */
export function autoUnits(n: number, decimals = -1): string {
  const a = Math.abs(n);
  const dec = (x: number) => decimals >= 0 ? x.toFixed(decimals) : String(+x.toPrecision(3));
  if (a >= 1e12) return dec(n / 1e12) + 'T';
  if (a >= 1e9) return dec(n / 1e9) + 'bn';
  if (a >= 1e6) return dec(n / 1e6) + 'M';
  if (a >= 1e3) return dec(n / 1e3) + 'K';
  return decimals >= 0 ? n.toFixed(decimals) : String(+n.toPrecision(4));
}
