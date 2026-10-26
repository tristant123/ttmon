// Query folding analysis for the sandbox SQL Server (and the lakehouse SQL endpoint): which Applied Steps
// fold back to the source, the native SQL they produce ("View Native Query"), and where folding stops.
// It follows Power Query's documented behaviour closely enough for practice; it is not a full translator.
import { splitSteps, Step } from './parser';

export interface FoldInfo {
  name: string;
  /** 'folds' = sent to the source; 'notfolds' = evaluated by Power Query; 'na' = the source can't fold (files). */
  status: 'folds' | 'notfolds' | 'na';
  sql?: string;
  reason?: string;
}

interface Sel { from: string; cols: string[] | null; where: string[]; order: string[]; top: number | null; distinct: boolean; group: { keys: string[]; aggs: string[] } | null; joins: string[] }

const NEVER = /\b(Table\.AddIndexColumn|Table\.Transpose|Table\.PromoteHeaders|Table\.DemoteHeaders|Table\.Buffer|List\.Buffer|Table\.StopFolding|Table\.FillDown|Table\.FillUp|Table\.SplitColumn|Table\.RemoveRowsWithErrors|Table\.SelectRowsWithErrors|Table\.ReplaceErrorValues|Table\.Profile|Table\.FuzzyNestedJoin|Table\.FuzzyJoin|Table\.AddFuzzyClusterColumn|Table\.RemoveLastN|Table\.LastN|Table\.AlternateRows|Table\.ReverseRows|Table\.FromRecords|Table\.FromRows|Table\.FromList|Table\.Combine|Table\.InsertRows|Table\.AddRankColumn|Table\.TransformRows|Text\.Proper|Text\.PositionOf|Text\.Split|Splitter\.\w+|Number\.Random\w*|DateTime\.LocalNow|Csv\.Document|Excel\.Workbook|Json\.Document|Function\.Invoke|Table\.Schema|Table\.ColumnNames|Table\.RowCount)\b/;
const FOLDABLE = /^(Table\.(SelectRows|SelectColumns|RemoveColumns|RenameColumns|ReorderColumns|Sort|FirstN|Skip|Distinct|Group|TransformColumnTypes|NestedJoin|Join|ExpandTableColumn|AddColumn|DuplicateColumn|ReplaceValue|TransformColumns|Unpivot|UnpivotOtherColumns|Pivot|RemoveMatchingRows|RemoveRows|AggregateTableColumn|PrefixColumns)|Value\.NativeQuery)\(/;

const q = (c: string) => `[${c.replace(/]/g, ']]')}]`;
const strList = (s: string) => [...s.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"'));

/** Translate a simple `each` predicate to SQL, or return null. */
function predicate(src: string): string | null {
  let s = src.trim().replace(/^each\s+/, '');
  if (/\(_\)\s*=>/.test(s)) s = s.replace(/^\(_\)\s*=>\s*/, '');
  const lit = (x: string): string | null => {
    x = x.trim();
    let m: RegExpMatchArray | null;
    if ((m = x.match(/^"((?:[^"]|"")*)"$/))) return `'${m[1].replace(/""/g, '"').replace(/'/g, "''")}'`;
    if (/^-?\d+(\.\d+)?$/.test(x)) return x;
    if (x === 'null') return 'NULL';
    if (x === 'true' || x === 'false') return x === 'true' ? '1' : '0';
    if ((m = x.match(/^#date\((\d+),\s*(\d+),\s*(\d+)\)$/))) return `convert(date, '${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}')`;
    if ((m = x.match(/^\[([^\]]+)\]$/))) return q(m[1]);
    return null;
  };
  const atom = (x: string): string | null => {
    x = x.trim();
    while (x.startsWith('(') && x.endsWith(')') && balanced(x.slice(1, -1))) x = x.slice(1, -1).trim();
    for (const op of [' or ', ' and ']) {
      const parts = splitTop(x, op);
      if (parts.length > 1) { const ps = parts.map(atom); return ps.some(p => p === null) ? null : `(${ps.join(op.toUpperCase())})`; }
    }
    if (x.startsWith('not ')) { const a = atom(x.slice(4)); return a && `NOT ${a}`; }
    let m: RegExpMatchArray | null;
    if ((m = x.match(/^Text\.(StartsWith|EndsWith|Contains)\(\s*\[([^\]]+)\]\s*,\s*"((?:[^"]|"")*)"\s*\)$/))) {
      const v = m[3].replace(/'/g, "''");
      return `${q(m[2])} LIKE '${m[1] === 'StartsWith' ? '' : '%'}${v}${m[1] === 'EndsWith' ? '' : '%'}'`;
    }
    if ((m = x.match(/^List\.Contains\(\s*\{([^}]*)\}\s*,\s*\[([^\]]+)\]\s*\)$/))) return `${q(m[2])} IN (${m[1].split(',').map(v => lit(v) ?? 'NULL').join(', ')})`;
    if ((m = x.match(/^Date\.Year\(\s*\[([^\]]+)\]\s*\)\s*(=|<>|>=|<=|>|<)\s*(\d+)$/))) return `datepart("yyyy", ${q(m[1])}) ${m[2]} ${m[3]}`;
    for (const op of ['<>', '>=', '<=', '=', '>', '<']) {
      const i = topIndex(x, op);
      if (i > 0) {
        const a = lit(x.slice(0, i)), b = lit(x.slice(i + op.length));
        if (a === null || b === null) return null;
        if (b === 'NULL') return `${a} IS ${op === '=' ? '' : 'NOT '}NULL`;
        return `${a} ${op} ${b}`;
      }
    }
    return null;
  };
  return atom(s);
}
function balanced(x: string) { let d = 0, inS = false; for (const ch of x) { if (ch === '"') inS = !inS; if (inS) continue; if (ch === '(' || ch === '{' || ch === '[') d++; if (ch === ')' || ch === '}' || ch === ']') d--; if (d < 0) return false; } return d === 0; }
function splitTop(x: string, sep: string) { const out: string[] = []; let d = 0, inS = false, last = 0; for (let i = 0; i < x.length; i++) { const ch = x[i]; if (ch === '"') inS = !inS; if (inS) continue; if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; else if (d === 0 && x.startsWith(sep, i)) { out.push(x.slice(last, i)); last = i + sep.length; i += sep.length - 1; } } out.push(x.slice(last)); return out; }
function topIndex(x: string, op: string) { let d = 0, inS = false; for (let i = 0; i < x.length; i++) { const ch = x[i]; if (ch === '"') inS = !inS; if (inS) continue; if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; else if (d === 0 && x.startsWith(op, i) && !(op.length === 1 && '<>'.includes(x[i - 1] ?? '') ) && !(op.length === 1 && (x[i + 1] === '=' || x[i + 1] === '>'))) return i; } return -1; }

function render(s: Sel): string {
  const cols = s.group ? [...s.group.keys.map(q), ...s.group.aggs] : s.cols ?? ['*'];
  let sql = `select ${s.top !== null ? `top ${s.top} ` : ''}${s.distinct ? 'distinct ' : ''}${cols.join(',\n    ')}\nfrom ${s.from} as [$Table]`;
  for (const j of s.joins) sql += `\n${j}`;
  if (s.where.length) sql += `\nwhere ${s.where.join('\n    and ')}`;
  if (s.group) sql += `\ngroup by ${s.group.keys.map(q).join(', ')}`;
  if (s.order.length) sql += `\norder by ${s.order.join(', ')}`;
  return sql;
}

/** Analyse a query. `foldingQueries` names other queries that fold (for merges). */
export function analyseFolding(code: string, foldingQueries: Set<string> = new Set()): FoldInfo[] {
  const parsed = splitSteps(code);
  if (!parsed) return [];
  const out: FoldInfo[] = [];
  let sel: Sel | null = null;
  let source: 'sql' | 'other' | null = null;
  let broken = false;
  parsed.steps.forEach((st: Step, i: number) => {
    const c = st.code.replace(/\s+/g, ' ').trim();
    if (i === 0 || source === null) {
      if (/^Sql\.Databases?\(/.test(c)) { source = 'sql'; out.push({ name: st.name, status: 'folds' }); return; }
      const ref = c.match(/^#?"?([^"(]+?)"?$/);
      if (ref && foldingQueries.has(ref[1])) { source = 'sql'; sel = { from: `(${ref[1]})`, cols: null, where: [], order: [], top: null, distinct: false, group: null, joins: [] }; out.push({ name: st.name, status: 'folds', sql: render(sel) }); return; }
      source = 'other'; out.push({ name: st.name, status: 'na', reason: 'This source (a file or an in-memory table) doesn\'t support query folding; Power Query does all the work.' }); return;
    }
    if (source === 'other') { out.push({ name: st.name, status: 'na' }); return; }
    if (broken) { out.push({ name: st.name, status: 'notfolds', reason: 'An earlier step stopped query folding, so this step is evaluated locally by Power Query.' }); return; }
    let m: RegExpMatchArray | null;
    if (!sel && (m = c.match(/\{\[Schema\s*=\s*"([^"]+)"\s*,\s*Item\s*=\s*"([^"]+)"\]\}\[Data\]/))) {
      sel = { from: `[${m[1]}].[${m[2]}]`, cols: null, where: [], order: [], top: null, distinct: false, group: null, joins: [] };
      out.push({ name: st.name, status: 'folds', sql: render(sel) }); return;
    }
    if (!sel && (m = c.match(/^Value\.NativeQuery\([^,]+,\s*"((?:[^"]|"")*)"/))) {
      sel = { from: `(${m[1].replace(/""/g, '"')})`, cols: null, where: [], order: [], top: null, distinct: false, group: null, joins: [] };
      const folds = /EnableFolding\s*=\s*true/.test(c);
      out.push({ name: st.name, status: 'folds', sql: m[1].replace(/""/g, '"') });
      if (!folds) broken = true;
      return;
    }
    const fail = (reason: string) => { broken = true; out.push({ name: st.name, status: 'notfolds', reason }); };
    const nv = c.match(NEVER);
    if (nv) return fail(`${nv[1]} can't be translated to the source's query language, so folding stops here. Move this step as late as possible, or do it in the source.`);
    if (!FOLDABLE.test(c) || !sel) return fail('This step can\'t be folded to the source.');
    const s: Sel = sel; const fn = c.match(/^([\w.]+)\(/)![1];
    switch (fn) {
      case 'Table.SelectRows': {
        const pred = c.replace(/^Table\.SelectRows\(\s*[^,]+,\s*/, '').replace(/\)\s*$/, '');
        const p = predicate(pred);
        if (p === null) {
          if (/\b(Text\.Proper|Text\.PositionOf|List\.Max|List\.Min|Table\.)/.test(pred)) return fail('The filter uses a function the source doesn\'t support, so folding stops here.');
          s.where.push('/* filter */ 1 = 1');
        } else s.where.push(p);
        if (s.group || s.top !== null) { s.from = `(${render(s)})`; s.where = []; s.top = null; s.group = null; s.cols = null; s.order = []; }
        break;
      }
      case 'Table.SelectColumns': s.cols = strList(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1)).map(q); break;
      case 'Table.RemoveColumns': { const rm = strList(c.slice(c.indexOf(','))).map(q); s.cols = s.cols ? s.cols.filter(x => !rm.includes(x)) : [`/* every column except ${rm.join(', ')} */`]; break; }
      case 'Table.RenameColumns': {
        const pairs = [...c.matchAll(/\{\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*\}/g)];
        s.from = `(${render(s)})`; s.cols = null; s.where = []; s.order = []; s.top = null;
        s.cols = pairs.length ? ['*', ...pairs.map(p => `${q(p[1])} as ${q(p[2])}`)] : null; break;
      }
      case 'Table.Sort': s.order = [...c.matchAll(/\{\s*"((?:[^"]|"")*)"\s*,\s*Order\.(Ascending|Descending)\s*\}/g)].map(p => `${q(p[1])}${p[2] === 'Descending' ? ' desc' : ''}`); break;
      case 'Table.FirstN': { const n = c.match(/,\s*(\d+)\s*\)$/); if (!n) return fail('Keep top rows with a condition can\'t fold.'); s.top = +n[1]; break; }
      case 'Table.Distinct': s.distinct = true; break;
      case 'Table.Group': {
        const keys = strList(c.slice(c.indexOf('{'), c.indexOf('}') + 1));
        const aggs = [...c.matchAll(/\{\s*"((?:[^"]|"")*)"\s*,\s*each\s+(List\.(\w+)\(\s*\[([^\]]+)\]\s*\)|Table\.RowCount\(_\))/g)].map(a => a[3] ? `${({ Sum: 'sum', Average: 'avg', Min: 'min', Max: 'max', Count: 'count', NonNullCount: 'count' } as any)[a[3]] ?? a[3].toLowerCase()}(${q(a[4])}) as ${q(a[1])}` : `count(1) as ${q(a[1])}`);
        if (/each _\s*,/.test(c) || /type table/.test(c) && !aggs.length) return fail('Group By with "All rows" can\'t fold.');
        s.group = { keys, aggs }; break;
      }
      case 'Table.NestedJoin': case 'Table.Join': {
        const other = c.match(/,\s*\{[^}]*\}\s*,\s*#?"?([^",{]+?)"?\s*,/);
        if (other && !foldingQueries.has(other[1].trim())) return fail(`The other table (${other[1].trim()}) doesn't come from the same SQL source, so the merge can't fold. Both sides must fold to the same source (and privacy levels must allow combining them).`);
        const kind = c.match(/JoinKind\.(\w+)/)?.[1] ?? 'LeftOuter';
        s.joins.push(`${({ Inner: 'inner join', LeftOuter: 'left outer join', RightOuter: 'right outer join', FullOuter: 'full outer join', LeftAnti: 'left outer join /* anti */', RightAnti: 'right outer join /* anti */' } as any)[kind] ?? 'join'} ${other ? `(${other[1].trim()})` : '[other]'} as [$Other] on ...`);
        break;
      }
      case 'Table.TransformColumns': if (/Text\.Proper|Number\.Round|each\s+\w+\s*\(/.test(c) && !/Text\.(Upper|Lower|Trim)/.test(c)) return fail('This column transformation can\'t be folded.'); break;
      case 'Table.AddColumn': if (/Text\.Proper|List\.|Table\.|Record\.|try\s/.test(c)) return fail('This custom column uses functions the source doesn\'t support, so folding stops here.'); s.cols = s.cols ? [...s.cols, '/* new column */'] : null; break;
      default: break;
    }
    out.push({ name: st.name, status: 'folds', sql: render(s) });
  });
  return out;
}

/** Steps a DirectQuery table can't have: the first step that doesn't fold. */
export function directQueryProblem(code: string, foldingQueries?: Set<string>): FoldInfo | null {
  const info = analyseFolding(code, foldingQueries);
  if (info[0]?.status === 'na') return { name: info[0].name, status: 'na', reason: 'DirectQuery isn\'t available for this source. Files and entered data can only be imported.' };
  return info.find(x => x.status === 'notfolds') ?? null;
}

/** Queries that fold completely to a SQL source (so merges with them can fold too). */
export function foldingQueries(queries: { name: string; code: string }[]): Set<string> {
  const set = new Set<string>();
  for (let pass = 0; pass < 3; pass++) {
    for (const q of queries) {
      if (set.has(q.name)) continue;
      const info = analyseFolding(q.code, set);
      if (info.length && info.every(x => x.status === 'folds')) set.add(q.name);
    }
  }
  return set;
}
