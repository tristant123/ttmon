// Generates the M that Power BI Desktop writes for each "Get data" connector.
import { mId, mStr } from '../m/parser';
import { MEngine } from '../m/engine';
import { detectType } from '../m/convert';
import { MTable, DataType } from '../core/values';
import { sniffDelimiter, parseDelimited } from '../m/sources';
import type { StoredFile } from '../m/sources';

export const typeExpr = (t: DataType) => ({ int: 'Int64.Type', decimal: 'type number', currency: 'Currency.Type', percent: 'Percentage.Type', text: 'type text', bool: 'type logical', date: 'type date', datetime: 'type datetime', time: 'type time', duration: 'type duration', datetimezone: 'type datetimezone', any: 'type any' } as Record<string, string>)[t] ?? 'type any';

export const fullPath = (f: StoredFile) => `${f.folder}\\${f.name}`;
export const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.toLowerCase() : '');

/** Build a "Changed Type" step for a table by detecting each column's type. */
export function changedTypeStep(t: MTable, prev: string, cols?: string[]): string | null {
  const pairs = t.columns.map((c, i) => ({ c, i })).filter(x => !cols || cols.includes(x.c.name)).map(({ c, i }) => {
    const ty = c.type !== 'any' ? c.type : detectType(t.rows.slice(0, 200).map(r => r[i]));
    return `{${mStr(c.name)}, ${typeExpr(ty === 'any' ? 'text' : ty)}}`;
  });
  if (!pairs.length) return null;
  return `Table.TransformColumnTypes(${mId(prev)},{${pairs.join(', ')}})`;
}

export function uniqueName(base: string, taken: string[]) {
  let n = base.replace(/\.[^.]+$/, '').replace(/[[\]]/g, ''); let k = n, i = 2;
  while (taken.includes(k)) k = `${n} (${i++})`;
  return k;
}

type Q = { name: string; code: string; group?: string; load?: boolean };

function finish(steps: [string, string][]) {
  return `let\n${steps.map(([n, c]) => `    ${mId(n)} = ${c}`).join(',\n')}\nin\n    ${mId(steps[steps.length - 1][0])}`;
}

/** Evaluate partial step lists so we can detect types the way Power Query does at import. */
function evalSteps(steps: [string, string][], others: { name: string; code: string }[] = []): any {
  const eng = new MEngine([...others.map((o, i) => ({ id: 'o' + i, name: o.name, code: o.code, load: false, refresh: true })), { id: 'tmp', name: '__tmp', code: finish(steps), load: false, refresh: true }]);
  return eng.evaluateQuery('__tmp');
}

export function csvQuery(f: StoredFile, name: string, opts: { delimiter?: string; detect?: boolean } = {}): Q {
  const text = new TextDecoder().decode(f.bytes.slice(0, 20000));
  const delim = opts.delimiter ?? sniffDelimiter(text);
  const width = Math.max(1, ...parseDelimited(text.split(/\r?\n/).slice(0, 200).join('\n'), delim).map(r => r.length));
  const dl = delim === '\t' ? '"#(tab)"' : mStr(delim);
  const steps: [string, string][] = [
    ['Source', `Csv.Document(File.Contents(${mStr(fullPath(f))}),[Delimiter=${dl}, Columns=${width}, Encoding=65001, QuoteStyle=QuoteStyle.None])`],
    ['Promoted Headers', 'Table.PromoteHeaders(Source, [PromoteAllScalars=true])'],
  ];
  if (opts.detect !== false) {
    try { const t = evalSteps(steps); const ct = changedTypeStep(t, 'Promoted Headers'); if (ct) steps.push(['Changed Type', ct]); } catch { /* keep text */ }
  }
  return { name, code: finish(steps) };
}

export function excelQueries(f: StoredFile, items: { item: string; kind: string }[], taken: string[]): Q[] {
  const out: Q[] = [];
  for (const it of items) {
    const name = uniqueName(it.item, [...taken, ...out.map(o => o.name)]);
    const nav = `${it.item.replace(/\W+/g, '_')}_${it.kind}`;
    const steps: [string, string][] = [
      ['Source', `Excel.Workbook(File.Contents(${mStr(fullPath(f))}), null, true)`],
      [nav, `Source{[Item=${mStr(it.item)},Kind=${mStr(it.kind)}]}[Data]`],
    ];
    try {
      const t: MTable = evalSteps(steps);
      // Power Query only promotes headers when the first row looks like headers
      const first = t.rows[0] ?? [];
      const looksHeader = first.length > 0 && first.every(v => typeof v === 'string') && first.filter(v => v !== null).length === t.columns.length;
      if (looksHeader) {
        steps.push(['Promoted Headers', `Table.PromoteHeaders(${mId(nav)}, [PromoteAllScalars=true])`]);
        const p: MTable = evalSteps(steps);
        const ct = changedTypeStep(p, 'Promoted Headers'); if (ct) steps.push(['Changed Type', ct]);
      } else {
        const ct = changedTypeStep(t, nav); if (ct) steps.push(['Changed Type', ct]);
      }
    } catch { /* leave as is */ }
    out.push({ name, code: finish(steps) });
  }
  return out;
}

export function jsonQuery(f: StoredFile, name: string): Q {
  const steps: [string, string][] = [['Source', `Json.Document(File.Contents(${mStr(fullPath(f))}))`]];
  try {
    const v = evalSteps(steps);
    if (Array.isArray(v)) {
      steps.push(['Converted to Table', 'Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error)']);
      const recs = v.filter((x: any) => x && x.names);
      if (recs.length) {
        const fields: string[] = [];
        for (const r of recs.slice(0, 200)) for (const n of r.names) if (!fields.includes(n)) fields.push(n);
        const fl = `{${fields.map(mStr).join(', ')}}`;
        steps.push(['Expanded Column1', `Table.ExpandRecordColumn(#"Converted to Table", "Column1", ${fl}, ${fl})`]);
        const t: MTable = evalSteps(steps);
        const scalarCols = t.columns.filter((_c, i) => t.rows.slice(0, 50).every(r => r[i] === null || typeof r[i] !== 'object' || r[i] instanceof Date)).map(c => c.name);
        const ct = changedTypeStep(t, 'Expanded Column1', scalarCols); if (ct) steps.push(['Changed Type', ct]);
      }
    } else if (v && v.names) {
      steps.push(['Converted to Table', 'Record.ToTable(Source)']);
    }
  } catch { /* ignore */ }
  return { name, code: finish(steps) };
}

export function xmlQueries(f: StoredFile, items: string[], taken: string[]): Q[] {
  return items.map(it => {
    const name = uniqueName(it, taken);
    const steps: [string, string][] = [['Source', `Xml.Tables(File.Contents(${mStr(fullPath(f))}))`], [it, `Source{[Name=${mStr(it)}]}[Table]`]];
    try { const t = evalSteps(steps); const ct = changedTypeStep(t, it); if (ct) steps.push(['Changed Type', ct]); } catch { /* ignore */ }
    return { name, code: finish(steps) };
  });
}

export function parquetQuery(f: StoredFile, name: string): Q {
  return { name, code: finish([['Source', `Parquet.Document(File.Contents(${mStr(fullPath(f))}))`]]) };
}

export function sqlQueries(server: string, db: string, items: { schema: string; item: string }[], taken: string[]): Q[] {
  return items.map(it => ({
    name: uniqueName(`${it.schema} ${it.item}`, taken),
    code: finish([['Source', `Sql.Database(${mStr(server)}, ${mStr(db)})`], [`${it.schema}_${it.item}`, `Source{[Schema=${mStr(it.schema)},Item=${mStr(it.item)}]}[Data]`]]),
  }));
}

/** Folder > Combine & Transform: the helper queries Power BI creates. */
export function folderCombine(folder: string, files: StoredFile[], taken: string[]): Q[] {
  const base = folder.split('\\').pop() || 'Folder';
  const name = uniqueName(base, taken);
  const group = `Transform File from ${name}`;
  const first = files[0];
  const e = ext(first?.name ?? 'x.csv');
  const sample = `let\n    Source = Folder.Files(${mStr(folder)}),\n    Navigation1 = Source{0}[Content]\nin\n    Navigation1`;
  const body = e === 'xlsx' || e === 'xls' || e === 'xlsm'
    ? `        Source = Excel.Workbook(Parameter1, null, true),\n        Sheet1 = Source{0}[Data],\n        #"Promoted Headers" = Table.PromoteHeaders(Sheet1, [PromoteAllScalars=true])`
    : e === 'json'
      ? `        Source = Json.Document(Parameter1),\n        #"Converted to Table" = Table.FromRecords(Source)`
      : `        Source = Csv.Document(Parameter1,[Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.None]),\n        #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true])`;
  const last = e === 'json' ? '#"Converted to Table"' : '#"Promoted Headers"';
  const fn = `(Parameter1 as binary) =>\n    let\n${body}\n    in\n        ${last}`;
  const steps: [string, string][] = [
    ['Source', `Folder.Files(${mStr(folder)})`],
    ['Filtered Hidden Files1', 'Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true)'],
    ['Invoke Custom Function1', 'Table.AddColumn(#"Filtered Hidden Files1", "Transform File", each #"Transform File"([Content]))'],
    ['Renamed Columns1', 'Table.RenameColumns(#"Invoke Custom Function1", {"Name", "Source.Name"})'],
    ['Removed Other Columns1', 'Table.SelectColumns(#"Renamed Columns1", {"Source.Name", "Transform File"})'],
    ['Expanded Table Column1', 'Table.ExpandTableColumn(#"Removed Other Columns1", "Transform File", Table.ColumnNames(#"Transform File"(#"Sample File")))'],
  ];
  const helpers = [{ name: 'Sample File', code: sample }, { name: 'Transform File', code: fn }];
  try { const t = evalSteps(steps, helpers); const ct = changedTypeStep(t, 'Expanded Table Column1'); if (ct) steps.push(['Changed Type', ct]); } catch { /* ignore */ }
  return [
    { name: 'Sample File', code: sample, group, load: false },
    { name: 'Transform File', code: fn, group, load: false },
    { name, code: finish(steps) },
  ];
}

export function enterDataQuery(name: string, cols: string[], rows: string[][]): Q {
  const data = `{${rows.map(r => `{${r.map(v => mStr(v)).join(', ')}}`).join(', ')}}`;
  const steps: [string, string][] = [['Source', `Table.FromRows(${data}, {${cols.map(mStr).join(', ')}})`]];
  try { const t = evalSteps(steps); const ct = changedTypeStep(t, 'Source'); if (ct) steps.push(['Changed Type', ct]); } catch { /* ignore */ }
  return { name, code: finish(steps) };
}

export function blankQuery(name: string): Q { return { name, code: 'let\n    Source = ""\nin\n    Source' }; }
