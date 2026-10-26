// Power Query Editor operations: each UI command appends an M step, named the way Power BI names it.
import { store, PQState } from '../../store';
import { splitSteps, joinSteps, mId, mStr, mField, Step } from '../../m/parser';
import { MEngine, Query } from '../../m/engine';
import { MTable, DataType, MError } from '../../core/values';
import { typeExpr } from '../../io/getdata';
import { detectType } from '../../m/convert';

export function pq(): PQState { return store.ui.pq!; }
export function setPQ(patch: Partial<PQState>) { store.setUI({ pq: { ...pq(), ...patch } }); }
export function currentQuery(): Query | undefined { const p = pq(); return p.queries.find(q => q.name === p.selected); }

export function updateQuery(name: string, f: (q: Query) => void, extra: Partial<PQState> = {}) {
  const p = pq();
  const queries = p.queries.map(q => (q.name === name ? (() => { const c = { ...q }; f(c); return c; })() : q));
  store.setUI({ pq: { ...p, queries, dirty: true, ...extra } });
  invalidate();
}

// ---------- evaluation cache ----------
let engCache: { key: string; eng: MEngine } | null = null;
const resCache = new Map<string, { v?: any; e?: any; ms: number }>();
export function invalidate() { engCache = null; resCache.clear(); }
export function pqEngine(): MEngine {
  const qs = pq().queries;
  const key = JSON.stringify(qs.map(q => [q.name, q.code])) + store.files.length + JSON.stringify(store.privacyConfig());
  if (!engCache || engCache.key !== key) { engCache = { key, eng: new MEngine(qs, store.privacyConfig()) }; resCache.clear(); }
  return engCache.eng;
}
export function stepResult(name: string, step: number | null): { v?: any; e?: any; ms: number } {
  const eng = pqEngine();
  const k = `${name}§${step}`;
  const hit = resCache.get(k); if (hit) return hit;
  const t0 = performance.now();
  let r: { v?: any; e?: any; ms: number };
  try { r = { v: step === null ? eng.evaluateQuery(name) : eng.evaluateStep(name, step), ms: 0 }; } catch (e) { r = { e, ms: 0 }; }
  r.ms = performance.now() - t0;
  resCache.set(k, r);
  return r;
}

export function stepsOf(q: Query): { steps: Step[]; result: string } | null { return splitSteps(q.code); }
export function selectedStepIndex(): number {
  const q = currentQuery(); if (!q) return -1;
  const sp = stepsOf(q); if (!sp) return -1;
  const p = pq();
  return p.step === null ? sp.steps.length - 1 : Math.min(p.step, sp.steps.length - 1);
}
export function currentTable(): MTable | null {
  const q = currentQuery(); if (!q) return null;
  const idx = selectedStepIndex();
  const r = stepResult(q.name, idx < 0 ? null : idx);
  return r.v instanceof MTable ? r.v : null;
}

const STEP_BASE: Record<string, string> = {};
export function uniqueStep(steps: Step[], base: string) {
  let n = base, i = 1; while (steps.some(s => s.name === n)) n = `${base}${i++}`;
  return n;
}

/** Insert a step after the selected step. `code` receives the previous step's identifier. */
export function addStep(base: string, code: (prev: string) => string, opts: { mergeWith?: RegExp; mergeCode?: (existing: string) => string | null } = {}) {
  const q = currentQuery(); if (!q) return;
  const sp = stepsOf(q);
  if (!sp) { store.toast('This query isn\'t a let … in expression, so steps can\'t be added. Edit it in the Advanced Editor.', 'error'); return; }
  const idx = selectedStepIndex();
  const steps = [...sp.steps];
  const atEnd = idx === steps.length - 1;
  // merge consecutive renames / type changes like Power Query does
  if (atEnd && opts.mergeWith && opts.mergeCode && opts.mergeWith.test(steps[idx].code)) {
    const merged = opts.mergeCode(steps[idx].code);
    if (merged) { steps[idx] = { ...steps[idx], code: merged }; updateQuery(q.name, x => { x.code = joinSteps(steps); }, { step: null, selectedCols: pq().selectedCols }); return; }
  }
  const prev = steps[idx];
  const name = uniqueStep(steps, base);
  steps.splice(idx + 1, 0, { name, code: code(mId(prev.name)) });
  // the step that used to follow now builds on the new one
  if (!atEnd) {
    const next = steps[idx + 2];
    const re = new RegExp(escapeRe(mId(prev.name)) + '(?![\\w."])', 'g');
    next.code = next.code.replace(re, mId(name));
  }
  const result = atEnd ? undefined : sp.result;
  updateQuery(q.name, x => { x.code = joinSteps(steps, result); }, { step: atEnd ? null : idx + 1 });
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
void STEP_BASE;

export function deleteStep(i: number, untilEnd = false) {
  const q = currentQuery(); if (!q) return;
  const sp = stepsOf(q); if (!sp) return;
  if (sp.steps.length <= 1) { store.toast('A query needs at least one step.', 'error'); return; }
  const steps = [...sp.steps];
  const removed = steps[i];
  if (untilEnd) {
    steps.splice(i);
    if (!steps.length) return;
    updateQuery(q.name, x => { x.code = joinSteps(steps); }, { step: null });
    return;
  }
  steps.splice(i, 1);
  const prev = steps[i - 1];
  if (steps[i] && prev) {
    const re = new RegExp(escapeRe(mId(removed.name)) + '(?![\\w."])', 'g');
    steps[i].code = steps[i].code.replace(re, mId(prev.name));
  }
  const lastName = mId(removed.name);
  const result = sp.result === lastName ? undefined : sp.result;
  updateQuery(q.name, x => { x.code = joinSteps(steps, result && steps.some(st => mId(st.name) === result) ? result : undefined); }, { step: null });
}

export function renameStep(i: number, name: string) {
  const q = currentQuery(); if (!q) return;
  const sp = stepsOf(q); if (!sp || !name.trim()) return;
  if (sp.steps.some((s, j) => s.name === name && j !== i)) { store.toast(`A step named '${name}' already exists.`, 'error'); return; }
  const old = sp.steps[i].name;
  const re = new RegExp(escapeRe(mId(old)) + '(?![\\w."])', 'g');
  const steps = sp.steps.map((s, j) => (j === i ? { ...s, name } : { ...s, code: s.code.replace(re, mId(name)) }));
  const result = sp.result.replace(re, mId(name));
  updateQuery(q.name, x => { x.code = joinSteps(steps, result); });
}

export function moveStep(i: number, dir: -1 | 1) {
  const q = currentQuery(); if (!q) return;
  const sp = stepsOf(q); if (!sp) return;
  const j = i + dir; if (j < 1 || j >= sp.steps.length || i < 1) return;
  // swapping requires rewiring references; simplest faithful approach: swap codes of linear steps
  const steps = sp.steps.map(s => ({ ...s }));
  const a = steps[Math.min(i, j)], b = steps[Math.max(i, j)];
  const before = steps[Math.min(i, j) - 1];
  const reA = new RegExp(escapeRe(mId(a.name)) + '(?![\\w."])', 'g'), reBefore = new RegExp(escapeRe(mId(before.name)) + '(?![\\w."])', 'g');
  const aCode = a.code.replace(reBefore, '§PREV§'), bCode = b.code.replace(reA, '§PREV§');
  [steps[Math.min(i, j)], steps[Math.max(i, j)]] = [{ name: b.name, code: bCode.replace(/§PREV§/g, mId(before.name)) }, { name: a.name, code: aCode.replace(/§PREV§/g, mId(b.name)) }];
  const after = steps[Math.max(i, j) + 1];
  if (after) after.code = after.code.replace(new RegExp(escapeRe(mId(b.name)) + '(?![\\w."])', 'g'), mId(a.name));
  updateQuery(q.name, x => { x.code = joinSteps(steps); }, { step: j });
}

// ---------- column helpers ----------
export const colList = (cols: string[]) => `{${cols.map(mStr).join(', ')}}`;
export const colType = (t: MTable | null, c: string): DataType => t?.columns.find(x => x.name === c)?.type ?? 'any';
export function selCols(): string[] { return pq().selectedCols; }
function need(n = 1): string[] | null {
  const c = selCols();
  if (c.length < n) { store.toast(n === 1 ? 'Select a column first (click its header).' : `Select at least ${n} columns (Ctrl+click headers).`, 'error'); return null; }
  return c;
}
const typeOfFn = (t: DataType) => typeExpr(t);

// ---------- transforms ----------
export const T = {
  removeColumns() { const c = need(); if (!c) return; addStep('Removed Columns', p => `Table.RemoveColumns(${p},${colList(c)})`, { mergeWith: /^Table\.RemoveColumns\(/, mergeCode: ex => ex.replace(/\}\)$/, `, ${c.map(mStr).join(', ')}})`) }); setPQ({ selectedCols: [] }); },
  removeOther() { const c = need(); if (!c) return; addStep('Removed Other Columns', p => `Table.SelectColumns(${p},${colList(c)})`); },
  chooseColumns(cols: string[]) { addStep('Removed Other Columns', p => `Table.SelectColumns(${p},${colList(cols)})`); },
  duplicate() { const c = need(); if (!c) return; addStep('Duplicated Column', p => `Table.DuplicateColumn(${p}, ${mStr(c[0])}, ${mStr(`${c[0]} - Copy`)})`); },
  rename(old: string, nu: string) {
    if (!nu || nu === old) return;
    addStep('Renamed Columns', p => `Table.RenameColumns(${p},{{${mStr(old)}, ${mStr(nu)}}})`, { mergeWith: /^Table\.RenameColumns\(/, mergeCode: ex => ex.replace(/\}\}\)$/, `}, {${mStr(old)}, ${mStr(nu)}}})`) });
    setPQ({ selectedCols: [nu] });
  },
  changeType(t: DataType, cols?: string[]) {
    const c = cols ?? need(); if (!c) return;
    const pairs = c.map(x => `{${mStr(x)}, ${typeOfFn(t)}}`).join(', ');
    addStep('Changed Type', p => `Table.TransformColumnTypes(${p},{${pairs}})`, {
      mergeWith: /^Table\.TransformColumnTypes\(/,
      mergeCode: ex => (c.every(x => !ex.includes(`{${mStr(x)},`)) ? ex.replace(/\}\}\)$/, `}, ${pairs}})`).replace(/\}\}, \{/, '}, {') : null),
    });
  },
  detectTypes() {
    const t = currentTable(); if (!t) return;
    const c = selCols().length ? selCols() : t.names;
    const pairs = c.map(x => { const i = t.idx(x); const ty = detectType(t.rows.slice(0, 200).map(r => r[i])); return `{${mStr(x)}, ${typeOfFn(ty === 'any' ? 'text' : ty)}}`; }).join(', ');
    addStep('Changed Type', p => `Table.TransformColumnTypes(${p},{${pairs}})`);
  },
  promote() { addStep('Promoted Headers', p => `Table.PromoteHeaders(${p}, [PromoteAllScalars=true])`); },
  demote() { addStep('Demoted Headers', p => `Table.DemoteHeaders(${p})`); },
  transpose() { addStep('Transposed Table', p => `Table.Transpose(${p})`); },
  reverse() { addStep('Reversed Rows', p => `Table.ReverseRows(${p})`); },
  countRows() { addStep('Counted Rows', p => `Table.RowCount(${p})`); },
  sort(desc: boolean) { const c = need(); if (!c) return; addStep('Sorted Rows', p => `Table.Sort(${p},{{${mStr(c[0])}, Order.${desc ? 'Descending' : 'Ascending'}}})`, { mergeWith: /^Table\.Sort\(/, mergeCode: ex => ex.replace(/\}\}\)$/, `}, {${mStr(c[0])}, Order.${desc ? 'Descending' : 'Ascending'}}})`) }); },
  keepTop(n: number) { addStep('Kept First Rows', p => `Table.FirstN(${p},${n})`); },
  keepBottom(n: number) { addStep('Kept Last Rows', p => `Table.LastN(${p}, ${n})`); },
  keepRange(first: number, n: number) { addStep('Kept Range of Rows', p => `Table.Range(${p},${first - 1},${n})`); },
  removeTop(n: number) { addStep('Removed Top Rows', p => `Table.Skip(${p},${n})`); },
  removeBottom(n: number) { addStep('Removed Bottom Rows', p => `Table.RemoveLastN(${p},${n})`); },
  removeAlternate(first: number, remove: number, keep: number) { addStep('Removed Alternate Rows', p => `Table.AlternateRows(${p},${first - 1},${remove},${keep})`); },
  removeDuplicates() { const c = selCols(); addStep('Removed Duplicates', p => (c.length ? `Table.Distinct(${p}, ${colList(c)})` : `Table.Distinct(${p})`)); },
  keepDuplicates() {
    const c = selCols(); const t = currentTable(); if (!t) return;
    const cols = c.length ? c : t.names;
    addStep('Kept Duplicates', p => `let columnNames = ${colList(cols)}, addCount = Table.Group(${p}, columnNames, {{"Count", Table.RowCount, type number}}), selectDuplicates = Table.SelectRows(addCount, each [Count] > 1), removeCount = Table.RemoveColumns(selectDuplicates, "Count") in Table.Join(${p}, columnNames, removeCount, columnNames, JoinKind.Inner)`);
  },
  removeBlank() { addStep('Removed Blank Rows', p => `Table.SelectRows(${p}, each not List.IsEmpty(List.RemoveMatchingItems(Record.FieldValues(_), {"", null})))`); },
  removeErrors() { const c = selCols(); addStep('Removed Errors', p => (c.length ? `Table.RemoveRowsWithErrors(${p}, ${colList(c)})` : `Table.RemoveRowsWithErrors(${p})`)); },
  keepErrors() { const c = selCols(); addStep('Kept Errors', p => (c.length ? `Table.SelectRowsWithErrors(${p}, ${colList(c)})` : `Table.SelectRowsWithErrors(${p})`)); },
  replaceErrors(value: string) {
    const c = need(); if (!c) return; const t = currentTable();
    const lit = (col: string) => (/^(int|decimal|currency|percent)$/.test(colType(t, col)) && value !== '' && !isNaN(Number(value)) ? value : value === '' || value.toLowerCase() === 'null' ? 'null' : mStr(value));
    addStep('Replaced Errors', p => `Table.ReplaceErrorValues(${p}, {${c.map(x => `{${mStr(x)}, ${lit(x)}}`).join(', ')}})`);
  },
  replaceValues(find: string, repl: string, whole: boolean) {
    const c = need(); if (!c) return; const t = currentTable();
    const numeric = c.every(x => /^(int|decimal|currency|percent)$/.test(colType(t, x)));
    const lit = (s0: string) => (s0 === '' && !numeric ? '""' : s0.toLowerCase() === 'null' ? 'null' : numeric && !isNaN(Number(s0)) ? s0 : mStr(s0));
    const repFn = numeric || whole || find === '' || find.toLowerCase() === 'null' ? 'Replacer.ReplaceValue' : 'Replacer.ReplaceText';
    addStep('Replaced Value', p => `Table.ReplaceValue(${p},${lit(find)},${lit(repl)},${repFn},${colList(c)})`);
  },
  fill(dir: 'Down' | 'Up') { const c = need(); if (!c) return; addStep(`Filled ${dir}`, p => `Table.Fill${dir}(${p},${colList(c)})`); },
  unpivot(kind: 'selected' | 'other' | 'only') {
    const t = currentTable(); const c = need(); if (!c || !t) return;
    if (kind === 'other') addStep('Unpivoted Other Columns', p => `Table.UnpivotOtherColumns(${p}, ${colList(c)}, "Attribute", "Value")`);
    else if (kind === 'only') addStep('Unpivoted Only Selected Columns', p => `Table.Unpivot(${p}, ${colList(c)}, "Attribute", "Value")`);
    else addStep('Unpivoted Columns', p => `Table.UnpivotOtherColumns(${p}, ${colList(t.names.filter(n => !c.includes(n)))}, "Attribute", "Value")`);
    setPQ({ selectedCols: [] });
  },
  pivot(valueCol: string, agg: string) {
    const c = need(); if (!c) return;
    const f = agg === 'none' ? '' : `, List.${agg}`;
    addStep('Pivoted Column', p => `Table.Pivot(${p}, List.Distinct(${p}[${c[0].replace(/]/g, '')}]), ${mStr(c[0])}, ${mStr(valueCol)}${f})`);
  },
  move(where: 'Left' | 'Right' | 'Beginning' | 'End') {
    const t = currentTable(); const c = need(); if (!t || !c) return;
    const names = [...t.names];
    for (const col of where === 'Right' || where === 'End' ? [...c].reverse() : c) {
      const i = names.indexOf(col); names.splice(i, 1);
      const j = where === 'Left' ? Math.max(0, i - 1) : where === 'Right' ? Math.min(names.length, i + 1) : where === 'Beginning' ? 0 : names.length;
      names.splice(j, 0, col);
    }
    addStep('Reordered Columns', p => `Table.ReorderColumns(${p},${colList(names)})`);
  },
  reorder(names: string[]) { addStep('Reordered Columns', p => `Table.ReorderColumns(${p},${colList(names)})`); },
  textTransform(fn: string, label: string, asNew = false, newName?: string) {
    const c = need(); if (!c) return;
    if (asNew) addStep(`Inserted ${label}`, p => `Table.AddColumn(${p}, ${mStr(newName ?? label)}, each ${fn}(${mField(c[0])}), type text)`);
    else addStep(label, p => `Table.TransformColumns(${p},{${c.map(x => `{${mStr(x)}, ${fn}, type text}`).join(', ')}})`);
  },
  prefixSuffix(kind: 'prefix' | 'suffix', text: string, asNew = false) {
    const c = need(); if (!c) return;
    const expr = kind === 'prefix' ? `each ${mStr(text)} & _` : `each _ & ${mStr(text)}`;
    if (asNew) addStep(`Inserted ${kind === 'prefix' ? 'Prefix' : 'Suffix'}`, p => `Table.AddColumn(${p}, ${mStr(kind === 'prefix' ? 'Prefix' : 'Suffix')}, each ${kind === 'prefix' ? `${mStr(text)} & ${mField(c[0])}` : `${mField(c[0])} & ${mStr(text)}`}, type text)`);
    else addStep(kind === 'prefix' ? 'Added Prefix' : 'Added Suffix', p => `Table.TransformColumns(${p}, {${c.map(x => `{${mStr(x)}, ${expr}, type text}`).join(', ')}})`);
  },
  extract(kind: string, args: Record<string, any>, asNew = false) {
    const c = need(); if (!c) return;
    const fx: Record<string, [string, string, string]> = {
      length: ['Extracted Text Length', 'Text.Length(_)', 'Int64.Type'],
      first: [`Extracted First Characters`, `Text.Start(_, ${args.n})`, 'type text'],
      last: [`Extracted Last Characters`, `Text.End(_, ${args.n})`, 'type text'],
      range: [`Extracted Text Range`, `Text.Middle(_, ${args.start}, ${args.n})`, 'type text'],
      before: [`Extracted Text Before Delimiter`, `Text.BeforeDelimiter(_, ${mStr(args.delim ?? '')})`, 'type text'],
      after: [`Extracted Text After Delimiter`, `Text.AfterDelimiter(_, ${mStr(args.delim ?? '')})`, 'type text'],
      between: [`Extracted Text Between Delimiters`, `Text.BetweenDelimiters(_, ${mStr(args.start ?? '')}, ${mStr(args.end ?? '')})`, 'type text'],
    };
    const [nm, body, ty] = fx[kind];
    if (asNew) addStep(nm.replace('Extracted', 'Inserted'), p => `Table.AddColumn(${p}, ${mStr(kind === 'length' ? 'Length' : kind === 'first' ? 'First Characters' : kind === 'last' ? 'Last Characters' : kind === 'range' ? 'Text Range' : kind === 'before' ? 'Text Before Delimiter' : kind === 'after' ? 'Text After Delimiter' : 'Text Between Delimiters')}, each ${body.replace(/_/g, mField(c[0]))}, ${ty})`);
    else addStep(nm, p => `Table.TransformColumns(${p}, {${c.map(x => `{${mStr(x)}, each ${body}, ${ty}}`).join(', ')}})`);
  },
  parse(kind: 'JSON' | 'XML') { const c = need(); if (!c) return; addStep(`Parsed ${kind}`, p => `Table.TransformColumns(${p},{{${mStr(c[0])}, ${kind === 'JSON' ? 'Json.Document' : 'Xml.Tables'}}})`); },
  splitDelimiter(delim: string, mode: 'each' | 'left' | 'right', quote: boolean, intoRows = false) {
    const c = need(); if (!c) return; const t = currentTable(); if (!t) return;
    const d = delim === '\t' ? '"#(tab)"' : mStr(delim);
    if (intoRows) {
      addStep('Split Column by Delimiter', p => `let #"Split" = Table.ExpandListColumn(Table.TransformColumns(${p}, {{${mStr(c[0])}, Splitter.SplitTextByDelimiter(${d}, QuoteStyle.${quote ? 'Csv' : 'None'}), let itemType = (type nullable text) meta [Serialized.Text = true] in type {itemType}}}), ${mStr(c[0])}) in #"Split"`);
      return;
    }
    const i = t.idx(c[0]);
    let n = 2;
    if (mode === 'each') n = Math.max(1, ...t.rows.slice(0, 1000).map(r => (typeof r[i] === 'string' ? r[i].split(delim).length : 1)));
    const names = Array.from({ length: n }, (_, k) => `${c[0]}.${k + 1}`);
    const splitter = mode === 'each' ? `Splitter.SplitTextByDelimiter(${d}, QuoteStyle.${quote ? 'Csv' : 'None'})` : `Splitter.SplitTextByEachDelimiter({${d}}, QuoteStyle.${quote ? 'Csv' : 'None'}, ${mode === 'right' ? 'true' : 'false'})`;
    addStep('Split Column by Delimiter', p => `Table.SplitColumn(${p}, ${mStr(c[0])}, ${splitter}, ${colList(names)})`);
  },
  splitPositions(kind: 'chars' | 'positions' | 'transition', arg: any) {
    const c = need(); if (!c) return;
    if (kind === 'chars') addStep('Split Column by Position', p => `Table.SplitColumn(${p}, ${mStr(c[0])}, Splitter.SplitTextByRepeatedLengths(${arg}), ${colList([`${c[0]}.1`, `${c[0]}.2`])})`);
    else if (kind === 'positions') { const ps = String(arg).split(',').map(x => x.trim()).filter(Boolean); addStep('Split Column by Positions', p => `Table.SplitColumn(${p}, ${mStr(c[0])}, Splitter.SplitTextByPositions({${ps.join(', ')}}), ${colList(ps.map((_, k) => `${c[0]}.${k + 1}`))})`); }
    else {
      const sets: Record<string, [string, string]> = { lowerUpper: ['{"a".."z"}', '{"A".."Z"}'], upperLower: ['{"A".."Z"}', '{"a".."z"}'], digitNon: ['{"0".."9"}', '(c) => not List.Contains({"0".."9"}, c)'], nonDigit: ['(c) => not List.Contains({"0".."9"}, c)', '{"0".."9"}'] };
      const [a, b] = sets[arg];
      addStep('Split Column by Character Transition', p => `Table.SplitColumn(${p}, ${mStr(c[0])}, Splitter.SplitTextByCharacterTransition(${a}, ${b}), ${colList([`${c[0]}.1`, `${c[0]}.2`])})`);
    }
  },
  mergeColumns(sep: string, name: string, asNew: boolean) {
    const c = need(2); if (!c) return;
    const d = sep === '\t' ? '"#(tab)"' : mStr(sep);
    if (asNew) addStep('Inserted Merged Column', p => `Table.AddColumn(${p}, ${mStr(name)}, each Text.Combine({${c.map(x => `Text.From(${mField(x)})`).join(', ')}}, ${d}), type text)`);
    else addStep('Merged Columns', p => `Table.CombineColumns(Table.TransformColumnTypes(${p}, {${c.map(x => `{${mStr(x)}, type text}`).join(', ')}}),${colList(c)},Combiner.CombineTextByDelimiter(${d}, QuoteStyle.None),${mStr(name)})`);
    setPQ({ selectedCols: [name] });
  },
  numberOp(kind: string, arg: string | null, asNew: boolean) {
    const c = need(); if (!c) return;
    const ops: Record<string, [string, string, string]> = {
      add: ['Added to Column', `_ + ${arg}`, 'Addition'], subtract: ['Subtracted from Column', `_ - ${arg}`, 'Subtraction'], multiply: ['Multiplied Column', `_ * ${arg}`, 'Multiplication'],
      divide: ['Divided Column', `_ / ${arg}`, 'Division'], intdivide: ['Integer-Divided Column', `Number.IntegerDivide(_, ${arg})`, 'Integer-Division'], modulo: ['Calculated Modulo', `Number.Mod(_, ${arg})`, 'Modulo'],
      percent: ['Calculated Percentage', `_ * ${arg} / 100`, 'Percentage'], percentOf: ['Calculated Percent Of', `_ / ${arg} * 100`, 'Percent Of'],
      abs: ['Calculated Absolute Value', 'Number.Abs(_)', 'Absolute Value'], power: ['Calculated Power', `Number.Power(_, ${arg})`, 'Power'], sqrt: ['Calculated Square Root', 'Number.Sqrt(_)', 'Square Root'],
      exp: ['Calculated Exponent', 'Number.Exp(_)', 'Exponent'], ln: ['Calculated Natural Logarithm', 'Number.Ln(_)', 'Natural Logarithm'], log10: ['Calculated Base-10 Logarithm', 'Number.Log10(_)', 'Base-10 Logarithm'],
      roundUp: ['Rounded Up', 'Number.RoundUp(_)', 'Round Up'], roundDown: ['Rounded Down', 'Number.RoundDown(_)', 'Round Down'], round: ['Rounded Off', `Number.Round(_, ${arg ?? 0})`, 'Round'],
      even: ['Calculated Even', 'Number.IsEven(_)', 'Is Even'], odd: ['Calculated Odd', 'Number.IsOdd(_)', 'Is Odd'], sign: ['Calculated Sign', 'Number.Sign(_)', 'Sign'],
    };
    const [nm, body, colName] = ops[kind];
    const ty = ['even', 'odd'].includes(kind) ? 'type logical' : ['roundUp', 'roundDown', 'sign', 'intdivide'].includes(kind) ? 'Int64.Type' : 'type number';
    if (asNew) addStep(`Inserted ${colName}`, p => `Table.AddColumn(${p}, ${mStr(colName)}, each ${body.replace(/_/g, mField(c[0]))}, ${ty})`);
    else addStep(nm, p => `Table.TransformColumns(${p}, {${c.map(x => `{${mStr(x)}, each ${body}, ${ty}}`).join(', ')}})`);
  },
  statistic(fn: string, label: string) {
    const c = need(); if (!c) return;
    addStep(`Calculated ${label}`, p => (fn === 'CountDistinct' ? `List.NonNullCount(List.Distinct(${p}[${c[0]}]))` : fn === 'Count' ? `List.NonNullCount(${p}[${c[0]}])` : `List.${fn}(${p}[${c[0]}])`));
  },
  dateOp(kind: string, asNew: boolean) {
    const c = need(); if (!c) return;
    const ops: Record<string, [string, string, string]> = {
      dateOnly: ['Date', 'DateTime.Date(_)', 'type date'], year: ['Year', 'Date.Year(_)', 'Int64.Type'], startYear: ['Start of Year', 'Date.StartOfYear(_)', 'type date'], endYear: ['End of Year', 'Date.EndOfYear(_)', 'type date'],
      month: ['Month', 'Date.Month(_)', 'Int64.Type'], startMonth: ['Start of Month', 'Date.StartOfMonth(_)', 'type date'], endMonth: ['End of Month', 'Date.EndOfMonth(_)', 'type date'],
      daysInMonth: ['Days in Month', 'Date.DaysInMonth(_)', 'Int64.Type'], monthName: ['Month Name', 'Date.MonthName(_)', 'type text'],
      quarter: ['Quarter', 'Date.QuarterOfYear(_)', 'Int64.Type'], startQuarter: ['Start of Quarter', 'Date.StartOfQuarter(_)', 'type date'], endQuarter: ['End of Quarter', 'Date.EndOfQuarter(_)', 'type date'],
      weekOfYear: ['Week of Year', 'Date.WeekOfYear(_)', 'Int64.Type'], weekOfMonth: ['Week of Month', 'Date.WeekOfMonth(_)', 'Int64.Type'], startWeek: ['Start of Week', 'Date.StartOfWeek(_)', 'type date'], endWeek: ['End of Week', 'Date.EndOfWeek(_)', 'type date'],
      day: ['Day', 'Date.Day(_)', 'Int64.Type'], dayOfWeek: ['Day of Week', 'Date.DayOfWeek(_)', 'Int64.Type'], dayOfYear: ['Day of Year', 'Date.DayOfYear(_)', 'Int64.Type'], dayName: ['Day Name', 'Date.DayOfWeekName(_)', 'type text'],
      age: ['Age', 'Date.From(DateTime.LocalNow()) - _', 'type duration'],
      hour: ['Hour', 'Time.Hour(_)', 'Int64.Type'], minute: ['Minute', 'Time.Minute(_)', 'Int64.Type'], second: ['Second', 'Time.Second(_)', 'type number'],
      timeOnly: ['Time', 'DateTime.Time(_)', 'type time'],
      days: ['Days', 'Duration.Days(_)', 'Int64.Type'], totalYears: ['Total Years', 'Duration.TotalDays(_) / 365', 'type number'], totalDays: ['Total Days', 'Duration.TotalDays(_)', 'type number'], totalHours: ['Total Hours', 'Duration.TotalHours(_)', 'type number'],
    };
    const [colName, body, ty] = ops[kind];
    if (asNew) addStep(`Inserted ${colName}`, p => `Table.AddColumn(${p}, ${mStr(colName)}, each ${body.replace(/_/g, mField(c[0]))}, ${ty})`);
    else addStep(`Extracted ${colName}`, p => `Table.TransformColumns(${p},{${c.map(x => `{${mStr(x)}, each ${body}, ${ty}}`).join(', ')}})`);
  },
  customColumn(name: string, formula: string, type?: DataType) {
    const f = formula.trim().replace(/^=\s*/, '');
    addStep('Added Custom', p => `Table.AddColumn(${p}, ${mStr(name)}, each ${f}${type && type !== 'any' ? ', ' + typeOfFn(type) : ''})`);
  },
  conditional(name: string, rules: { col: string; op: string; value: string; output: string; valueIsCol?: boolean; outIsCol?: boolean }[], elseOut: string, elseIsCol: boolean) {
    const t = currentTable();
    const lit = (v: string, isCol: boolean | undefined, col?: string) => {
      if (isCol) return mField(v);
      if (v === '' || v.toLowerCase() === 'null') return 'null';
      const ty = col ? colType(t, col) : 'any';
      if (/^(int|decimal|currency|percent)$/.test(ty) && !isNaN(Number(v))) return v;
      if (!col && !isNaN(Number(v)) && v.trim() !== '') return v;
      return mStr(v);
    };
    const cond = (r: typeof rules[0]) => {
      const L = mField(r.col), R = lit(r.value, r.valueIsCol, r.col);
      switch (r.op) {
        case 'equals': return `${L} = ${R}`; case 'notEquals': return `${L} <> ${R}`;
        case 'gt': return `${L} > ${R}`; case 'gte': return `${L} >= ${R}`; case 'lt': return `${L} < ${R}`; case 'lte': return `${L} <= ${R}`;
        case 'begins': return `Text.StartsWith(${L}, ${R})`; case 'notBegins': return `not Text.StartsWith(${L}, ${R})`;
        case 'ends': return `Text.EndsWith(${L}, ${R})`; case 'notEnds': return `not Text.EndsWith(${L}, ${R})`;
        case 'contains': return `Text.Contains(${L}, ${R})`; case 'notContains': return `not Text.Contains(${L}, ${R})`;
      }
      return 'true';
    };
    const body = rules.map((r, i) => `${i ? ' else ' : ''}if ${cond(r)} then ${lit(r.output, r.outIsCol)}`).join('') + ` else ${lit(elseOut, elseIsCol)}`;
    addStep('Added Conditional Column', p => `Table.AddColumn(${p}, ${mStr(name)}, each ${body})`);
  },
  index(start: number, step: number) { addStep('Added Index', p => `Table.AddIndexColumn(${p}, "Index", ${start}, ${step}, Int64.Type)`); },
  groupBy(keys: string[], aggs: { name: string; op: string; col: string }[]) {
    const agg = (a: typeof aggs[0]) => {
      switch (a.op) {
        case 'Count': return `{${mStr(a.name)}, each Table.RowCount(_), Int64.Type}`;
        case 'CountDistinct': return `{${mStr(a.name)}, each Table.RowCount(Table.Distinct(_)), Int64.Type}`;
        case 'All': return `{${mStr(a.name)}, each _, type table}`;
        default: return `{${mStr(a.name)}, each List.${a.op}([${a.col}]), type ${a.op === 'Count' ? 'number' : 'nullable number'}}`;
      }
    };
    addStep('Grouped Rows', p => `Table.Group(${p}, ${colList(keys)}, {${aggs.map(agg).join(', ')}})`);
  },
  filterValues(col: string, include: any[] | null, exclude: any[] | null) {
    const t = currentTable();
    const ty = colType(t, col);
    const lit = (v: any) => (v === null ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : v instanceof Date ? (ty === 'date' ? `#date(${v.getFullYear()}, ${v.getMonth() + 1}, ${v.getDate()})` : `#datetime(${v.getFullYear()}, ${v.getMonth() + 1}, ${v.getDate()}, ${v.getHours()}, ${v.getMinutes()}, ${v.getSeconds()})`) : mStr(String(v)));
    const F = mField(col);
    const cond = include ? (include.length === 1 ? `${F} = ${lit(include[0])}` : `(${include.map(v => `${F} = ${lit(v)}`).join(' or ')})`) : (exclude!.length === 1 ? `${F} <> ${lit(exclude![0])}` : exclude!.map(v => `${F} <> ${lit(v)}`).join(' and '));
    addStep('Filtered Rows', p => `Table.SelectRows(${p}, each ${include && include.length > 1 ? cond : `(${cond})`})`);
  },
  filterRows(col: string, conds: { op: string; value: string }[], logic: 'and' | 'or') {
    const t = currentTable(); const ty = colType(t, col);
    const F = mField(col);
    const lit = (v: string) => {
      if (v === '' || v.toLowerCase() === 'null') return 'null';
      if (/^(int|decimal|currency|percent)$/.test(ty) && !isNaN(Number(v))) return v;
      if ((ty === 'date' || ty === 'datetime') && /^\d{4}-\d{2}-\d{2}/.test(v)) { const [y, m, d] = v.slice(0, 10).split('-').map(Number); return ty === 'date' ? `#date(${y}, ${m}, ${d})` : `#datetime(${y}, ${m}, ${d}, 0, 0, 0)`; }
      return mStr(v);
    };
    const one = (c: { op: string; value: string }) => {
      const V = lit(c.value);
      switch (c.op) {
        case 'equals': return `${F} = ${V}`; case 'notEquals': return `${F} <> ${V}`;
        case 'gt': return `${F} > ${V}`; case 'gte': return `${F} >= ${V}`; case 'lt': return `${F} < ${V}`; case 'lte': return `${F} <= ${V}`;
        case 'begins': return `Text.StartsWith(${F}, ${V})`; case 'notBegins': return `not Text.StartsWith(${F}, ${V})`;
        case 'ends': return `Text.EndsWith(${F}, ${V})`; case 'notEnds': return `not Text.EndsWith(${F}, ${V})`;
        case 'contains': return `Text.Contains(${F}, ${V})`; case 'notContains': return `not Text.Contains(${F}, ${V})`;
        case 'isNull': return `${F} = null`; case 'notNull': return `${F} <> null`;
        case 'notEmpty': return `${F} <> null and ${F} <> ""`;
        case 'thisYear': return `Date.IsInCurrentYear(${F})`;
        case 'lastNDays': return `Date.IsInPreviousNDays(${F}, ${Number(c.value) || 7})`;
      }
      return 'true';
    };
    const parts = conds.filter(c => c.op).map(one);
    if (!parts.length) return;
    addStep('Filtered Rows', p => `Table.SelectRows(${p}, each ${parts.length > 1 ? parts.join(` ${logic} `) : parts[0]})`);
  },
  removeEmpty(col: string) { addStep('Filtered Rows', p => `Table.SelectRows(${p}, each ${mField(col)} <> null and ${mField(col)} <> "")`); },
  expand(col: string, cols: string[], prefix: boolean, kind: 'table' | 'record' | 'list') {
    if (kind === 'list') { addStep(`Expanded ${col}`, p => `Table.ExpandListColumn(${p}, ${mStr(col)})`); return; }
    const nn = cols.map(c => (prefix ? `${col}.${c}` : c));
    addStep(`Expanded ${col}`, p => `Table.Expand${kind === 'table' ? 'Table' : 'Record'}Column(${p}, ${mStr(col)}, ${colList(cols)}, ${colList(nn)})`);
  },
  aggregate(col: string, aggs: { col: string; op: string }[]) {
    addStep(`Aggregated ${col}`, p => `Table.AggregateTableColumn(${p}, ${mStr(col)}, {${aggs.map(a => `{${mStr(a.col)}, List.${a.op}, ${mStr(`${a.op} of ${a.col}`)}}`).join(', ')}})`);
  },
  merge(other: string, k1: string[], k2: string[], kind: string, fuzzy = false) {
    const fn = fuzzy ? 'Table.FuzzyNestedJoin' : 'Table.NestedJoin';
    addStep('Merged Queries', p => `${fn}(${p}, ${colList(k1)}, ${mId(other)}, ${colList(k2)}, ${mStr(other)}, JoinKind.${kind})`);
  },
  append(others: string[]) {
    addStep('Appended Query', p => `Table.Combine({${[p, ...others.map(mId)].join(', ')}})`);
  },
  drillDown(col: string, row?: number) {
    if (row === undefined) addStep(col, p => `${p}[${col}]`);
    else addStep(col, p => `${p}{${row}}[${col}]`);
  },
};

export function nameSafe(n: string, taken: string[]) { let k = n, i = 2; while (taken.includes(k)) k = `${n} (${i++})`; return k; }

export function addQuery(q: { name: string; code: string; group?: string; load?: boolean; storageMode?: Query['storageMode'] }, select = true) {
  const p = pq();
  const name = nameSafe(q.name, p.queries.map(x => x.name));
  const nq: Query = { id: 'q' + Math.random().toString(36).slice(2, 9), name, code: q.code, load: q.load ?? true, refresh: true, group: q.group, storageMode: q.storageMode };
  store.setUI({ pq: { ...p, queries: [...p.queries, nq], selected: select ? name : p.selected, step: null, selectedCols: [], dirty: true } });
  invalidate();
  return name;
}

/** Merge or append into a new query (… as New). */
export function asNewQuery(base: string, fn: (prev: string) => string, stepName: string) {
  const code = `let\n    Source = ${fn(mId(base))}\nin\n    Source`;
  return addQuery({ name: stepName, code });
}

export function closeAndApply(apply = true) {
  const s = store; const p = pq();
  if (apply) {
    s.change(pr => { pr.queries = p.queries; }, { noUndo: false });
    const res = s.refresh();
    if (res.errors.length) s.openDialog({ type: 'loadErrors', errors: res.errors });
    else if (res.loaded.length) s.toast(`Loaded ${res.loaded.join(', ')}`);
  }
  s.setUI({ pq: null });
  invalidate();
}
export function applyOnly() {
  const s = store; const p = pq();
  s.change(pr => { pr.queries = p.queries; });
  const res = s.refresh();
  setPQ({ dirty: false });
  if (res.errors.length) s.openDialog({ type: 'loadErrors', errors: res.errors });
  else s.toast('Changes applied');
}

export { MError };
(globalThis as any).__pqops = { T, setPQ, pq, currentTable, currentQuery, stepResult, selectedStepIndex, deleteStep, addQuery };
