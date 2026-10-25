// Data source functions: File.Contents, Folder.Files, Csv.Document, Excel.Workbook,
// Json.Document, Xml.Tables, Parquet.Document, plus a sandboxed Sql.Database.
import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';
import { MBinary, MError, MFunction, MRecord, MTable, DataType } from '../core/values';
import { LIB } from './lib';
import { err } from './eval';

export interface StoredFile {
  name: string;          // file name, e.g. Sales.csv
  folder: string;        // virtual folder path, e.g. C:\Sandbox\Files
  bytes: Uint8Array;
  modified: number;
}

export interface SourceHost {
  files: () => StoredFile[];
  parquet: (f: StoredFile) => MTable | undefined;   // decoded ahead of time (hyparquet is async)
  sql?: (server: string, db: string) => MTable | undefined;
}

let host: SourceHost = { files: () => [], parquet: () => undefined };
export function setSourceHost(h: SourceHost) { host = h; }
export function getSourceHost() { return host; }

export const ROOT_FOLDER = 'C:\\Sandbox\\Files';

const base = (p: string) => p.split(/[\\/]/).pop() || p;
const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

export function findFile(path: string): StoredFile | undefined {
  const files = host.files();
  const n = norm(path);
  return files.find(f => norm(`${f.folder}\\${f.name}`) === n)
    ?? files.find(f => f.name.toLowerCase() === base(path).toLowerCase());
}

function def(name: string, impl: (...a: any[]) => any, min: number, max: number) {
  LIB[name] = new MFunction(name, (args) => impl(...args), [min, max]);
}

function bin(v: any): MBinary {
  if (v instanceof MError) throw v;
  if (v instanceof MBinary) return v;
  if (typeof v === 'string') return new MBinary(new TextEncoder().encode(v));
  err(`We cannot convert a value of type ${typeof v} to type Binary.`);
}

def('File.Contents', (path: any) => {
  const f = findFile(String(path));
  if (!f) throw new MError('DataSource.NotFound', `Could not find file '${path}'. Upload it with Get data, or check Data source settings.`);
  return new MBinary(f.bytes, f.name);
}, 1, 2);

function folderTable(path: string, recursive: boolean) {
  const n = norm(path);
  const fs = host.files().filter(f => {
    const fo = norm(f.folder);
    return recursive ? fo === n || fo.startsWith(n + '\\') : fo === n;
  });
  const cols: { name: string; type: DataType }[] = [
    { name: 'Content', type: 'binary' }, { name: 'Name', type: 'text' }, { name: 'Extension', type: 'text' },
    { name: 'Date accessed', type: 'datetime' }, { name: 'Date modified', type: 'datetime' }, { name: 'Date created', type: 'datetime' },
    { name: 'Attributes', type: 'record' }, { name: 'Folder Path', type: 'text' },
  ];
  return new MTable(cols, fs.map(f => {
    const ext = f.name.includes('.') ? '.' + f.name.split('.').pop()!.toLowerCase() : '';
    const d = new Date(f.modified);
    return [new MBinary(f.bytes, f.name), f.name, ext, d, d, d,
      MRecord.from({ 'Content Type': ext, Kind: ext.replace('.', '').toUpperCase() + ' File', Size: f.bytes.length, ReadOnly: false, Hidden: false }),
      f.folder + '\\'];
  }));
}
def('Folder.Files', (p: any) => folderTable(String(p), true), 1, 2);
def('Folder.Contents', (p: any) => folderTable(String(p), false), 1, 2);
def('SharePoint.Files', () => err('SharePoint isn\'t reachable from the sandbox. Upload the files to a folder and use Folder.Files instead.', 'DataSource.Error'), 1, 2);
def('Web.Contents', (u: any) => err(`Web.Contents("${u}") isn't available offline in the sandbox. Download the file and use Get data > Text/CSV, Excel or JSON.`, 'DataSource.Error'), 1, 2);
def('Web.Page', () => err('Web.Page isn\'t available in the sandbox.', 'DataSource.Error'), 1, 2);
def('OData.Feed', () => err('OData feeds aren\'t reachable from the sandbox.', 'DataSource.Error'), 1, 3);

// ---------- CSV / Text ----------
function decode(b: MBinary, encoding?: number) {
  const enc = encoding === 1252 ? 'windows-1252' : encoding === 1200 ? 'utf-16le' : 'utf-8';
  let s = new TextDecoder(enc).decode(b.bytes);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

export function parseDelimited(text: string, delim: string, quoteCsv = true): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      continue;
    }
    if (c === '"' && quoteCsv && cur === '') { q = true; continue; }
    if (text.startsWith(delim, i)) { row.push(cur); cur = ''; i += delim.length - 1; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export function sniffDelimiter(text: string): string {
  const first = text.split(/\r?\n/).slice(0, 5).join('\n');
  const cands = [',', '\t', ';', '|'];
  let best = ',', bc = 0;
  for (const c of cands) { const n = first.split(c).length; if (n > bc) { bc = n; best = c; } }
  return best;
}

def('Csv.Document', (src: any, opts: any, delimArg: any, _extra: any, encArg: any) => {
  let delim = ',', columns: number | undefined, enc = 65001, quote = 1;
  let names: string[] | undefined;
  if (opts instanceof MRecord) {
    if (opts.has('Delimiter')) delim = String(opts.get('Delimiter'));
    if (opts.has('Columns')) { const c = opts.get('Columns'); if (typeof c === 'number') columns = c; else if (Array.isArray(c)) names = c; }
    if (opts.has('Encoding')) enc = opts.get('Encoding');
    if (opts.has('QuoteStyle')) quote = opts.get('QuoteStyle');
  } else if (typeof opts === 'number') columns = opts;
  else if (Array.isArray(opts)) names = opts;
  if (typeof delimArg === 'string') delim = delimArg;
  if (typeof encArg === 'number') enc = encArg;
  const text = typeof src === 'string' ? src : decode(bin(src), enc);
  const rows = parseDelimited(text, delim, quote !== 0 || true);
  const width = names ? names.length : columns ?? Math.max(0, ...rows.map(r => r.length));
  const cols = Array.from({ length: width }, (_, i) => ({ name: names ? names[i] : `Column${i + 1}`, type: 'text' as DataType }));
  return new MTable(cols, rows.map(r => cols.map((_, i) => r[i] ?? null)));
}, 1, 5);

// ---------- Excel ----------
const wbCache = new WeakMap<Uint8Array, XLSX.WorkBook>();
export function readWorkbook(bytes: Uint8Array) {
  let wb = wbCache.get(bytes);
  if (!wb) { wb = XLSX.read(bytes, { type: 'array', cellDates: true, dense: false }); wbCache.set(bytes, wb); }
  return wb;
}
function sheetTable(ws: XLSX.WorkSheet): MTable {
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const width = Math.max(0, ...aoa.map(r => r.length));
  const cols = Array.from({ length: width }, (_, i) => ({ name: `Column${i + 1}`, type: 'any' as DataType }));
  // trim trailing completely empty rows
  let end = aoa.length; while (end > 0 && aoa[end - 1].every((v: any) => v === null || v === '')) end--;
  return new MTable(cols, aoa.slice(0, end).map(r => cols.map((_, i) => {
    const v = r[i]; if (v === undefined || v === '') return null;
    if (v instanceof Date) {
      // SheetJS returns UTC-midnight dates for date cells; bring them to local midnight
      const d = new Date(v.getTime() + v.getTimezoneOffset() * 60000);
      return Math.abs(d.getSeconds()) && d.getSeconds() >= 59 ? new Date(Math.round(d.getTime() / 1000) * 1000) : d;
    }
    return v;
  })));
}
def('Excel.Workbook', (src: any, useHeaders: any) => {
  const b = bin(src);
  let wb: XLSX.WorkBook;
  try { wb = readWorkbook(b.bytes); } catch (e) { throw new MError('DataFormat.Error', 'The input couldn\'t be recognized as a valid Excel document.', String(e)); }
  const cols: { name: string; type: DataType }[] = [
    { name: 'Name', type: 'text' }, { name: 'Data', type: 'table' }, { name: 'Item', type: 'text' }, { name: 'Kind', type: 'text' }, { name: 'Hidden', type: 'bool' },
  ];
  const rows: any[][] = wb.SheetNames.map((n, i) => {
    let t = sheetTable(wb.Sheets[n]);
    if (useHeaders === true) t = LIB['Table.PromoteHeaders'].impl([t]);
    const hidden = !!wb.Workbook?.Sheets?.[i]?.Hidden;
    return [n, t, n, 'Sheet', hidden];
  });
  for (const dn of wb.Workbook?.Names ?? []) {
    const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(dn.Ref);
    if (!m || !wb.Sheets[m[1]]) continue;
    const ws = { ...wb.Sheets[m[1]], '!ref': `${m[2]}${m[3]}:${m[4]}${m[5]}` };
    let t = sheetTable(ws as XLSX.WorkSheet);
    if (useHeaders === true) t = LIB['Table.PromoteHeaders'].impl([t]);
    rows.push([dn.Name, t, dn.Name, 'DefinedName', false]);
  }
  return new MTable(cols, rows);
}, 1, 3);
def('Excel.CurrentWorkbook', () => err('Excel.CurrentWorkbook only works inside Excel.'), 0, 0);

// ---------- JSON ----------
export function jsonToM(v: any): any {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(jsonToM);
  if (typeof v === 'object') return new MRecord(Object.keys(v), Object.values(v).map(jsonToM));
  return v;
}
def('Json.Document', (src: any, enc: any) => {
  const text = typeof src === 'string' ? src : decode(bin(src), typeof enc === 'number' ? enc : undefined);
  try { return jsonToM(JSON.parse(text)); } catch (e) { throw new MError('DataFormat.Error', `We found an invalid JSON value. ${(e as Error).message}`); }
}, 1, 2);
def('Json.FromValue', (v: any) => {
  const toJs = (x: any): any => x instanceof MRecord ? Object.fromEntries(x.names.map((n, i) => [n, toJs(x.values[i])])) : Array.isArray(x) ? x.map(toJs) : x instanceof MTable ? x.rows.map(r => Object.fromEntries(x.names.map((n, i) => [n, toJs(r[i])]))) : x;
  return new MBinary(new TextEncoder().encode(JSON.stringify(toJs(v))));
}, 1, 2);

// ---------- XML ----------
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', attributesGroupName: '@attrs', textNodeName: '#text', parseTagValue: false, trimValues: true, isArray: (_n, _p, _l, isAttr) => !isAttr });

function xmlElemsToTable(elems: any[]): MTable {
  const colNames: string[] = [];
  const add = (n: string) => { if (!colNames.includes(n)) colNames.push(n); };
  for (const e of elems) {
    if (typeof e !== 'object' || e === null) continue;
    for (const k of Object.keys(e)) {
      if (k === '@attrs') Object.keys(e[k]).forEach(a => add('Attribute:' + a));
      else if (k === '#text') add('Element:Text');
      else add(k);
    }
  }
  const rows = elems.map(e => colNames.map(c => {
    if (typeof e !== 'object' || e === null) return c === 'Element:Text' ? String(e) : null;
    if (c.startsWith('Attribute:')) return e['@attrs']?.[c.slice(10)] ?? null;
    if (c === 'Element:Text') { const t = e['#text']; return Array.isArray(t) ? t.join('') : t ?? null; }
    const v = e[c];
    if (v === undefined) return null;
    const arr = Array.isArray(v) ? v : [v];
    const leaf = arr.length === 1 && (typeof arr[0] !== 'object' || (Object.keys(arr[0]).length === 1 && '#text' in arr[0]));
    if (leaf) { const x = arr[0]; return typeof x === 'object' ? String(Array.isArray(x['#text']) ? x['#text'].join('') : x['#text']) : x === '' ? null : String(x); }
    if (arr.every(x => x === '' || (typeof x === 'object' && !Object.keys(x).length))) return null;
    return xmlElemsToTable(arr);
  }));
  return new MTable(colNames.map(n => ({ name: n, type: 'any' as DataType })), rows);
}

def('Xml.Tables', (src: any) => {
  const text = typeof src === 'string' ? src : decode(bin(src));
  let doc: any;
  try { doc = xmlParser.parse(text); } catch (e) { throw new MError('DataFormat.Error', 'The XML is invalid: ' + (e as Error).message); }
  const rootKey = Object.keys(doc).find(k => !k.startsWith('?'));
  if (!rootKey) err('The XML document is empty.');
  const root = Array.isArray(doc[rootKey!]) ? doc[rootKey!][0] : doc[rootKey!];
  const groups = Object.keys(root).filter(k => k !== '@attrs' && k !== '#text');
  return new MTable([{ name: 'Name', type: 'text' }, { name: 'Table', type: 'table' }],
    groups.map(g => [g, xmlElemsToTable(Array.isArray(root[g]) ? root[g] : [root[g]])]));
}, 1, 2);
def('Xml.Document', (src: any) => LIB['Xml.Tables'].impl([src]), 1, 2);

// ---------- Parquet ----------
def('Parquet.Document', (src: any) => {
  const b = bin(src);
  const f = host.files().find(x => x.bytes === b.bytes) ?? (b.name ? findFile(b.name) : undefined);
  const t = f ? host.parquet(f) : undefined;
  if (!t) throw new MError('DataFormat.Error', 'The Parquet file is still being read or isn\'t valid. Try Refresh Preview in a moment.');
  return t;
}, 1, 2);

// ---------- Databases (sandbox) ----------
def('Sql.Database', (server: any, db: any) => {
  const t = host.sql?.(String(server), String(db));
  if (!t) throw new MError('DataSource.Error', `Microsoft SQL: A network-related or instance-specific error occurred while establishing a connection to SQL Server '${server}'. The sandbox has one built-in server: Sql.Database("localhost", "ContosoDW").`);
  return t;
}, 2, 3);
def('Sql.Databases', (server: any) => {
  const t = host.sql?.(String(server), 'ContosoDW');
  if (!t) err(`Could not reach server '${server}'.`, 'DataSource.Error');
  return new MTable([{ name: 'Name', type: 'text' }, { name: 'Data', type: 'table' }, { name: 'Kind', type: 'text' }], [['ContosoDW', t, 'Database']]);
}, 1, 2);
for (const n of ['Oracle.Database', 'MySQL.Database', 'PostgreSQL.Database', 'Odbc.DataSource', 'Odbc.Query', 'AnalysisServices.Database', 'Salesforce.Data', 'Dataverse.Contents', 'Snowflake.Databases']) {
  def(n, () => err(`${n.split('.')[0]} isn't reachable from the sandbox. Try Sql.Database("localhost", "ContosoDW"), or load a file.`, 'DataSource.Error'), 0, 5);
}
def('Value.NativeQuery', () => err('Native queries aren\'t supported by the sandbox SQL server.', 'DataSource.Error'), 2, 4);
def('Pdf.Tables', () => err('PDF import isn\'t supported in the sandbox.', 'DataSource.Error'), 1, 2);
