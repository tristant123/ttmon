// Turns Power Query results into model tables and computes calculated columns / tables.
import { MEngine, friendlyError, paramInfo } from '../m/engine';
import { DataType, MError, MTable, MTime, MDuration, valueType, keyOf } from '../core/values';
import { textFrom, convertValue } from '../m/convert';
import { DaxEngine, emptyCtx, VTable } from '../dax/engine';
import '../dax/functions';
import { ColumnMeta, Model, ModelTable, Project, Relationship } from './types';
import { directQueryProblem, foldingQueries } from '../m/folding';
import { splitSteps } from '../m/parser';

export function modelType(t: DataType): DataType {
  switch (t) {
    case 'int': case 'decimal': case 'currency': case 'text': case 'bool': case 'date': case 'datetime': case 'time': return t;
    case 'percent': return 'decimal';
    case 'datetimezone': return 'datetime';
    case 'duration': return 'decimal';
    default: return 'text';
  }
}

function toModelValue(v: any, t: DataType): any {
  if (v === null || v === undefined || v instanceof MError) return null;
  switch (t) {
    case 'text': return typeof v === 'string' ? v : v instanceof MTable || typeof v === 'object' && !(v instanceof Date) && !(v instanceof MTime) && !(v instanceof MDuration) ? (Array.isArray(v) ? 'List' : v instanceof MTable ? 'Table' : 'Record') : textFrom(v);
    case 'decimal': case 'int': case 'currency': return typeof v === 'number' ? v : v instanceof MDuration ? v.ms / 86400000 : typeof v === 'boolean' ? +v : null;
    case 'time': return v instanceof MTime ? new Date(1899, 11, 30, v.h, v.m, v.s) : v instanceof Date ? v : null;
    default: return v;
  }
}

export function inferType(values: any[]): DataType {
  let t: DataType | null = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const vt = valueType(v);
    const m: DataType = vt === 'int' ? 'int' : vt === 'decimal' ? 'decimal' : vt === 'date' ? 'date' : vt === 'datetime' ? 'datetime' : vt === 'bool' ? 'bool' : 'text';
    if (!t) t = m;
    else if (t !== m) {
      if ((t === 'int' && m === 'decimal') || (t === 'decimal' && m === 'int')) t = 'decimal';
      else if ((t === 'date' && m === 'datetime') || (t === 'datetime' && m === 'date')) t = 'datetime';
      else return 'text';
    }
  }
  return t ?? 'text';
}

export interface RefreshResult { errors: { table: string; message: string }[]; loaded: string[] }

/** Re-run all load-enabled queries and rebuild the model's tables. */
export function refreshModel(project: Project, m: MEngine, only?: string[]): RefreshResult {
  const model = project.model;
  const live = (project as any).liveConnection as { composite?: boolean } | undefined;
  // a live connection has no queries: the data comes from the published semantic model
  if (live && !live.composite) return { errors: recalc(model), loaded: [] };
  const errors: RefreshResult['errors'] = [];
  const loaded: string[] = [];
  const keep: ModelTable[] = [];
  const folding = foldingQueries(project.queries);
  for (const q of project.queries) {
    if (!q.load || paramInfo(q.code)) continue;
    const existing = model.tables.find(t => t.name === q.name);
    const mode = existing?.storageMode ?? q.storageMode ?? 'Import';
    if (mode === 'DirectLake') {
      const steps = splitSteps(q.code)?.steps ?? [];
      if (steps.length > 2 || !/^Sql\.Database\(/.test(steps[0]?.code ?? '')) {
        errors.push({ table: q.name, message: `${q.name} is a Direct Lake table, so it can't have Power Query transformations. Direct Lake reads the Delta table in OneLake as it is: shape the data upstream (a dataflow, notebook or pipeline writing to the lakehouse), or use Import through the SQL analytics endpoint.` });
        if (existing) keep.push(existing);
        continue;
      }
    }
    if (mode === 'DirectQuery' || mode === 'Dual') {
      const prob = directQueryProblem(q.code, folding);
      if (prob) {
        errors.push({ table: q.name, message: prob.status === 'na' ? `${q.name} is in ${mode} mode, but its source doesn't support DirectQuery. ${prob.reason}` : `This step results in a query that is not supported in DirectQuery mode. (Step "${prob.name}": ${prob.reason}) Remove the step, or switch the table to Import mode.` });
        if (existing) keep.push(existing);
        continue;
      }
    }
    if (only && !only.includes(q.name) && existing) { keep.push(existing); continue; }
    if (!q.refresh && existing && existing.rows.length) { keep.push(existing); continue; }
    let v: any;
    try { v = m.evaluateQuery(q.name); } catch (e) {
      errors.push({ table: q.name, message: `${friendlyError(e).reason}: ${friendlyError(e).message}` });
      if (existing) keep.push(existing);
      continue;
    }
    if (!(v instanceof MTable)) {
      if (v instanceof Array || typeof v !== 'object' || v === null) v = new MTable([{ name: q.name, type: valueType(v) === 'int' ? 'int' : 'any' }], Array.isArray(v) ? v.map(x => [x]) : [[v]]);
      else { errors.push({ table: q.name, message: 'The query doesn\'t return a table, so it can\'t be loaded. Convert it to a table first.' }); continue; }
    }
    const t = v as MTable;
    let errCount = 0;
    const cols: ColumnMeta[] = t.columns.map((c, i) => {
      const prev = existing?.columns.find(x => x.name === c.name && !x.expression);
      let dt = modelType(c.type);
      if (c.type === 'any') dt = inferType(t.rows.slice(0, 500).map(r => r[i])) === 'text' ? 'text' : 'text';
      if ((prev as any)?.typeOverride) dt = (prev as any).typeOverride;
      const meta: ColumnMeta = { ...(prev ?? {}), name: c.name, dataType: dt };
      if (c.type === 'percent' && !meta.formatString) meta.formatString = '0.00%';
      if (c.type === 'currency' && !meta.formatString) meta.formatString = '\\$#,0.00;(\\$#,0.00);\\$#,0.00';
      if (!prev && (dt === 'int' || dt === 'decimal' || dt === 'currency') && meta.summarizeBy === undefined) meta.summarizeBy = /(key|id|year|code|number|^no$)$/i.test(c.name) ? 'None' : 'Sum';
      if (!prev && (dt === 'text' || dt === 'date' || dt === 'datetime' || dt === 'bool')) meta.summarizeBy = 'None';
      return meta;
    });
    const overridden = cols.map((c, i) => (c as any).typeOverride && modelType(t.columns[i].type) !== c.dataType);
    const rows = t.rows.map(r => r.map((x, i) => { if (x instanceof MError) errCount++; let v = toModelValue(x, overridden[i] ? 'any' as DataType : cols[i].dataType); if (overridden[i]) { v = convertValue(v, cols[i].dataType === 'time' ? 'datetime' : cols[i].dataType); if (v instanceof MError) v = null; } return v; }));
    const calc = existing?.columns.filter(c => c.expression) ?? [];
    keep.push({
      ...(existing ?? {}), name: q.name, columns: [...cols, ...calc.filter(c => !cols.some(x => x.name === c.name))], rows: rows.map(r => [...r, ...calc.map(() => null)]),
      loadErrors: errCount || undefined, expression: undefined, storageMode: mode === 'Import' ? existing?.storageMode : mode,
    });
    loaded.push(q.name);
  }
  // calculated tables survive refresh
  for (const t of model.tables) if ((t.expression || t.calculationGroup || (t as any).remote) && !keep.some(k => k.name === t.name)) keep.push(t);
  model.tables = keep;
  // drop relationships to vanished columns
  model.relationships = model.relationships.filter(r => colExists(model, r.fromTable, r.fromColumn) && colExists(model, r.toTable, r.toColumn));
  errors.push(...recalc(model));
  return { errors, loaded };
}

function colExists(model: Model, t: string, c: string) {
  const tab = model.tables.find(x => x.name === t);
  return !!tab && tab.columns.some(x => x.name === c);
}

/** Recompute calculated tables and calculated columns (in dependency-friendly order). */
export function recalc(model: Model): { table: string; message: string }[] {
  const errors: { table: string; message: string }[] = [];
  for (const t of model.tables) if (t.calculationGroup) buildCalcGroupRows(t);
  const eng = new DaxEngine(model);
  const calcCols = () => model.tables.flatMap(t => t.columns.filter(c => c.expression).map(c => ({ t, c })));
  // reset calculated column values so stale data doesn't leak into dependencies
  for (const { t, c } of calcCols()) { const i = t.columns.indexOf(c); for (const r of t.rows) r[i] = null; }
  const evalCols = (filter: (t: ModelTable) => boolean) => {
    for (let pass = 0; pass < 2; pass++) {
      for (const { t, c } of calcCols()) {
        if (!filter(t)) continue;
        const i = t.columns.indexOf(c);
        eng.reindex();
        try {
          const node = eng.parse(c.expression!);
          const base = eng.baseTable(t.name, emptyCtx());
          const vals = t.rows.map((_r, k) => eng.scalar(node, { ...emptyCtx(), rows: [{ vt: base, i: k }] }));
          vals.forEach((v, k) => { t.rows[k][i] = v; });
          eng.colKeysCache.clear(); eng.relIndex.clear();
          if (!c.dataType || c.dataType === 'any' || pass === 0) c.dataType = inferType(vals);
          if (pass === 1) delete (c as any).error;
        } catch (e) {
          (c as any).error = (e as Error).message;
          if (pass === 1) errors.push({ table: t.name, message: `Calculated column '${c.name}': ${(e as Error).message}` });
        }
      }
    }
  };
  evalCols(t => !t.expression);
  for (const t of model.tables) {
    if (!t.expression) continue;
    eng.reindex();
    try {
      const vt: VTable = eng.tableOf(t.expression);
      const used = new Set<string>();
      const cols: ColumnMeta[] = vt.cols.map((c, i) => {
        let n = c.name.replace(/^.*\[(.*)\]$/, '$1'); let k = n, j = 1; while (used.has(k.toLowerCase())) k = `${n}${j++}`; n = k; used.add(n.toLowerCase());
        const prev = t.columns.find(x => x.name === n && !x.expression);
        const dt = c.t && c.c && !c.part ? eng.table(c.t).columns.find(x => x.name === c.c)?.dataType ?? inferType(vt.rows.map(r => r[i])) : inferType(vt.rows.map(r => r[i]));
        return { ...(prev ?? {}), name: n, dataType: dt, summarizeBy: prev?.summarizeBy ?? (['int', 'decimal', 'currency'].includes(dt) && !/(key|id|year)$/i.test(n) ? 'Sum' : 'None') };
      });
      const calc = t.columns.filter(c => c.expression && !cols.some(x => x.name === c.name));
      t.columns = [...cols, ...calc];
      t.rows = vt.rows.map(r => [...r, ...calc.map(() => null)]);
      delete (t as any).error;
    } catch (e) {
      (t as any).error = (e as Error).message;
      errors.push({ table: t.name, message: `Calculated table: ${(e as Error).message}` });
    }
  }
  eng.reindex();
  evalCols(t => !!t.expression);
  // second pass for normal tables in case they depend on calculated tables
  if (model.tables.some(t => t.expression)) evalCols(t => !t.expression);
  return errors;
}

/** A calculation group is a table with a Name column (one row per item) sorted by a hidden Ordinal column. */
export function buildCalcGroupRows(t: ModelTable) {
  const items = [...t.calculationGroup!.items].map((it, i) => ({ it, o: it.ordinal ?? i })).sort((a, b) => a.o - b.o);
  const nameCol = t.columns.find(c => c.dataType === 'text' && !c.hidden)?.name ?? 'Name';
  t.columns = [
    { name: nameCol, dataType: 'text', summarizeBy: 'None', sortByColumn: 'Ordinal' },
    { name: 'Ordinal', dataType: 'int', summarizeBy: 'None', hidden: true },
  ];
  t.rows = items.map(x => [x.it.name, x.o]);
}

/** Power BI's relationship autodetect: same column name, one side unique. */
export function autodetectRelationships(model: Model): Relationship[] {
  const found: Relationship[] = [];
  const has = (a: string, b: string) => [...model.relationships, ...found].some(r => (r.fromTable === a && r.toTable === b) || (r.fromTable === b && r.toTable === a));
  const unique = (t: ModelTable, ci: number) => { const s = new Set<string>(); for (const r of t.rows) { const k = keyOf(r[ci]); if (s.has(k)) return false; s.add(k); } return t.rows.length > 0; };
  for (const a of model.tables) for (const b of model.tables) {
    if (a === b || has(a.name, b.name)) continue;
    for (let i = 0; i < a.columns.length; i++) {
      const ca = a.columns[i];
      const j = b.columns.findIndex(x => x.name.toLowerCase() === ca.name.toLowerCase());
      if (j < 0) continue;
      const cb = b.columns[j];
      const num = (t: DataType) => ['int', 'decimal', 'currency'].includes(t);
      if (ca.dataType !== cb.dataType && !(num(ca.dataType) && num(cb.dataType))) continue;
      if (['decimal', 'currency', 'bool'].includes(ca.dataType)) continue;
      const ua = unique(a, i), ub = unique(b, j);
      if (!ub || (ua && a.rows.length < b.rows.length)) continue;
      if (has(a.name, b.name)) continue;
      found.push({ id: 'rel' + Math.random().toString(36).slice(2, 9), fromTable: a.name, fromColumn: ca.name, toTable: b.name, toColumn: cb.name, cardinality: ua && ub ? 'one-one' : 'many-one', crossFilter: ua && ub ? 'both' : 'single', active: true });
      break;
    }
  }
  return found;
}
