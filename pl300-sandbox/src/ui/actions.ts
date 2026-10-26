// Commands shared by the ribbon, context menus and keyboard shortcuts.
import { store, uid } from '../store';
import { FieldRef, Visual, Measure } from '../model/types';
import { vdef } from '../report/visuals';
import { colMeta, defaultAgg } from '../report/query';
import { isNumericType } from '../core/values';
import { DaxParser, splitDefinition } from '../dax/parser';
import { clearQueryCache } from './report/vhelpers';
import { PAGE_W, PAGE_H } from './report/Canvas';

export function isValueLike(f: FieldRef) {
  if (f.measure) return true;
  if (store.project.model.discourageImplicitMeasures) return false;
  const c = colMeta(store.project.model, f);
  return !!c && isNumericType(c.dataType) && c.summarizeBy !== 'None';
}

function prep(f: FieldRef, valueWell: boolean): FieldRef {
  if (valueWell && f.column && !f.measure) return { ...f, agg: f.agg ?? defaultAgg(store.project.model, f) };
  if (!valueWell) return { ...f, agg: undefined };
  return f;
}

/** Drop a field on a visual: it goes into the well Power BI would choose. */
export function addFieldToVisual(id: string, f: FieldRef, wellKey?: string) {
  const s = store;
  const target = wellKey && vdef(s.findVisual(id)?.type ?? '')?.wells.find(w => w.key === wellKey);
  if (s.project.model.discourageImplicitMeasures && f.column && !f.measure && target && target.kind === 'value') {
    s.toast('This model discourages implicit measures, so columns can\'t be summarized in a visual. Create a measure (for example, Total = SUM(Table[Column])) and use that instead.', 'error');
    return;
  }
  s.updateVisual(id, v => {
    const def = vdef(v.type);
    let well = wellKey ? def.wells.find(w => w.key === wellKey) : undefined;
    if (!well) {
      const valueLike = isValueLike(f);
      const cands = def.wells.filter(w => w.key !== 'tooltips' && (w.kind === 'any' || (valueLike ? w.kind === 'value' : w.kind === 'group')));
      well = cands.find(w => !w.max || (v.wells[w.key]?.length ?? 0) < w.max) ?? cands[0] ?? def.wells[0];
    }
    if (!well) return;
    const list = v.wells[well.key] ?? [];
    const isVal = well.kind === 'value' || (well.kind === 'any' && isValueLike(f));
    const item = prep(f, isVal);
    if (well.max && list.length >= well.max) list.splice(well.max - 1, 1);
    list.push(item);
    v.wells[well.key] = list;
    v.drill = undefined;
  });
}

function freeSpot(w: number, h: number) {
  const page = store.page();
  for (let y = 10; y < PAGE_H - h; y += 20) for (let x = 10; x < PAGE_W - w; x += 20) {
    if (!page.visuals.some(v => x < v.x + v.w && x + w > v.x && y < v.y + v.h && y + h > v.y)) return { x, y };
  }
  return { x: 20 + page.visuals.length * 12, y: 20 + page.visuals.length * 12 };
}

export function addVisual(type: string, at?: { x: number; y: number }): string {
  const s = store;
  const size = type === 'card' ? { w: 220, h: 120 } : type === 'slicer' ? { w: 220, h: 220 } : type === 'textbox' ? { w: 300, h: 70 } : type === 'button' ? { w: 140, h: 48 } : type === 'kpi' ? { w: 260, h: 160 } : { w: 420, h: 280 };
  const pos = at ?? freeSpot(size.w, size.h);
  const v: Visual = { id: uid('v'), type, x: Math.round(pos.x), y: Math.round(pos.y), ...size, wells: {}, filters: [], format: {} };
  if (type === 'button') { v.text = 'Button'; }
  s.change(p => { p.report.pages.find(x => x.id === s.ui.pageId)!.visuals.push(v); });
  s.setUI({ selected: [v.id], vizTab: 'build' });
  return v.id;
}

/** Clicking a gallery icon with a visual selected converts it, carrying fields across. */
export function changeVisualType(id: string, type: string) {
  store.updateVisual(id, v => {
    const m = store.project.model;
    const all = Object.entries(v.wells).filter(([k]) => k !== 'tooltips').flatMap(([k, fs]) => fs.map(f => ({ k, f })));
    const old = vdef(v.type);
    const groups = all.filter(x => { const w = old.wells.find(y => y.key === x.k); return w?.kind === 'group' || (w?.kind === 'any' && !(x.f.measure || (x.f.agg && x.f.agg !== 'None'))); }).map(x => x.f);
    const vals = all.filter(x => !groups.includes(x.f)).map(x => x.f);
    const tips = v.wells.tooltips ?? [];
    v.type = type;
    v.wells = {};
    const def = vdef(type);
    const gw = def.wells.filter(w => w.kind === 'group'); const vw = def.wells.filter(w => w.kind === 'value' && w.key !== 'tooltips'); const aw = def.wells.find(w => w.kind === 'any');
    if (aw) v.wells[aw.key] = [...groups, ...vals];
    else {
      let gi = 0;
      for (const g of groups) { const w = gw[gi] ?? gw[0]; if (!w) break; (v.wells[w.key] ??= []).push(g); if (w.max && v.wells[w.key].length >= w.max) gi++; }
      let vi = 0;
      for (const f of vals) { const w = vw[vi] ?? vw[0]; if (!w) break; (v.wells[w.key] ??= []).push(f.measure || f.agg ? f : { ...f, agg: defaultAgg(m, f) }); if (w.max && v.wells[w.key].length >= w.max) vi++; }
    }
    if (def.wells.some(w => w.key === 'tooltips') && tips.length) v.wells.tooltips = tips;
    v.drill = undefined;
  });
}

export function newVisualAt(f: FieldRef, x: number, y: number) {
  const c = colMeta(store.project.model, f);
  const type = isValueLike(f) ? 'clusteredColumn' : c && (c.dataType === 'date' || c.dataType === 'datetime') ? 'line' : c?.dataCategory && ['Country', 'City', 'State or Province', 'Continent', 'Place'].includes(c.dataCategory) ? 'map' : 'table';
  const id = addVisual(type, { x: Math.max(0, x - 40), y: Math.max(0, y - 20) });
  addFieldToVisual(id, f);
}

/** Data pane checkbox: add to the selected visual, or make a new one. */
export function checkField(f: FieldRef) {
  const v = store.selectedVisual();
  if (v && !['textbox', 'button', 'shape', 'image'].includes(v.type)) addFieldToVisual(v.id, f);
  else { const p = freeSpot(420, 280); newVisualAt(f, p.x + 40, p.y + 20); }
}

export function removeFieldEverywhere(f: FieldRef) {
  const v = store.selectedVisual(); if (!v) return;
  store.updateVisual(v.id, x => { for (const k of Object.keys(x.wells)) x.wells[k] = x.wells[k].filter(g => !(g.table === f.table && g.column === f.column && g.measure === f.measure && g.hierarchy === f.hierarchy)); });
}

export function copyVisuals() {
  const s = store; const page = s.page();
  s.ui.clipboard = page.visuals.filter(v => s.ui.selected.includes(v.id)).map(v => JSON.parse(JSON.stringify(v)));
}
export function pasteVisuals() {
  const s = store; const clip = s.ui.clipboard; if (!clip?.length) return;
  const ids: string[] = [];
  s.change(p => {
    const page = p.report.pages.find(x => x.id === s.ui.pageId)!;
    for (const v of clip) { const n = { ...JSON.parse(JSON.stringify(v)), id: uid('v') }; if (page.visuals.some(x => x.x === n.x && x.y === n.y)) { n.x += 20; n.y += 20; } page.visuals.push(n); ids.push(n.id); }
  });
  s.setUI({ selected: ids });
  // pasting a slicer onto another page: Power BI offers to sync it with the original
  const pairs = clip.map((v, i) => ({ orig: v, copy: ids[i] })).filter(x => x.orig.type === 'slicer' && !s.page().visuals.some(y => y.id === x.orig.id) && s.findVisual(x.orig.id));
  if (pairs.length) s.openDialog({ type: 'confirm', title: 'Sync visuals', text: 'Do you want to sync the slicer you pasted with the one you copied? Synced slicers share their selection across pages (see View › Sync slicers).', ok: 'Sync', onOk: () => {
    s.change(p => { for (const pr of pairs) { const g = pr.orig.syncGroup ?? `${pr.orig.wells.field?.[0]?.column ?? 'Slicer'} ${Math.random().toString(36).slice(2, 6)}`; for (const pg of p.report.pages) for (const x of pg.visuals) if (x.id === pr.orig.id || x.id === pr.copy) { x.syncGroup = g; x.syncOff = false; } } });
  } });
}
export function deleteSelected() {
  const s = store; const ids = s.ui.selected; if (!ids.length) return;
  s.change(p => { for (const pg of p.report.pages) pg.visuals = pg.visuals.filter(v => !ids.includes(v.id)); });
  s.setUI({ selected: [], cross: s.ui.cross && ids.includes(s.ui.cross.visualId) ? null : s.ui.cross });
}

export function newPage() {
  const s = store;
  s.change(p => { const n = { id: uid('pg'), name: `Page ${p.report.pages.length + 1}`, visuals: [], filters: [] }; p.report.pages.push(n); s.ui.pageId = n.id; });
}

// ---------- DAX formula bar ----------
export function homeTable(): string | null {
  const s = store;
  if (s.ui.field?.table) return s.ui.field.table;
  if (s.ui.tableViewTable) return s.ui.tableViewTable;
  return s.project.model.tables[0]?.name ?? null;
}
const uniq = (base: string, taken: string[]) => { let n = base, i = 2; while (taken.some(t => t.toLowerCase() === n.toLowerCase())) n = `${base} ${i++}`; return n; };

export function startNewMeasure(table?: string) {
  const s = store; const t = table ?? homeTable();
  if (!t) { s.toast('Load data before creating measures.', 'error'); return; }
  const name = uniq('Measure', s.project.model.measures.map(m => m.name));
  s.setUI({ formula: { kind: 'measure', table: t, text: `${name} = ` } });
}
export function startNewColumn(table?: string) {
  const s = store; const t = table ?? homeTable();
  if (!t) { s.toast('Load data before creating columns.', 'error'); return; }
  const name = uniq('Column', s.project.model.tables.find(x => x.name === t)?.columns.map(c => c.name) ?? []);
  s.setUI({ formula: { kind: 'column', table: t, text: `${name} = ` }, field: { table: t } });
}
export function startNewTable() {
  const s = store;
  const name = uniq('Table', s.project.model.tables.map(t => t.name));
  s.setUI({ formula: { kind: 'table', table: name, text: `${name} = ` } });
}
export function editMeasure(m: Measure) { store.setUI({ formula: { kind: 'measure', table: m.table, text: `${m.name} = ${m.expression}`, editing: m.name }, field: { table: m.table, measure: m.name } }); }
export function editColumn(table: string, col: string) {
  const c = store.project.model.tables.find(t => t.name === table)?.columns.find(x => x.name === col);
  if (c?.expression) store.setUI({ formula: { kind: 'column', table, text: `${c.name} = ${c.expression}`, editing: c.name }, field: { table, column: col } });
}
export function editTable(table: string) {
  const t = store.project.model.tables.find(x => x.name === table);
  if (t?.expression) store.setUI({ formula: { kind: 'table', table, text: `${t.name} = ${t.expression}`, editing: t.name } });
}

// ---------- calculation groups ----------
/** Model view › Calculation group. Like Power BI, this turns on "Discourage implicit measures". */
export function newCalculationGroup() {
  const s = store;
  const create = () => {
    const name = uniq('Calculation group', s.project.model.tables.map(t => t.name));
    s.change(p => {
      p.model.discourageImplicitMeasures = true;
      p.model.tables.push({ name, columns: [{ name: 'Name', dataType: 'text' }], rows: [], calculationGroup: { precedence: 0, items: [{ name: 'Calculation item', expression: 'SELECTEDMEASURE()', ordinal: 0 }] } });
    }, { recalc: true });
    clearQueryCache();
    s.setUI({ field: { table: name }, formula: { kind: 'calcitem', table: name, text: 'Calculation item = SELECTEDMEASURE()', editing: 'Calculation item' } });
  };
  if (s.project.model.discourageImplicitMeasures) { create(); return; }
  s.openDialog({ type: 'confirm', title: 'Discourage implicit measures', text: 'Calculation groups only apply to explicit measures, so creating one turns on the model property "Discourage implicit measures". Report authors will no longer be able to add a numeric column to a visual\'s values and have it summarized automatically. Create explicit measures instead (for example, Total Sales = SUM(Sales[Amount])).', ok: 'Yes', onOk: create });
}
export function startCalcItem(table: string) {
  const s = store; const t = s.project.model.tables.find(x => x.name === table); if (!t?.calculationGroup) return;
  const name = uniq('Calculation item', t.calculationGroup.items.map(i => i.name));
  s.setUI({ formula: { kind: 'calcitem', table, text: `${name} = SELECTEDMEASURE()` }, field: { table } });
}
export function editCalcItem(table: string, item: string) {
  const it = store.project.model.tables.find(x => x.name === table)?.calculationGroup?.items.find(i => i.name === item);
  if (it) store.setUI({ formula: { kind: 'calcitem', table, text: `${it.name} = ${it.expression}`, editing: it.name }, field: { table } });
}
export function updateCalcGroup(table: string, f: (g: NonNullable<import('../model/types').ModelTable['calculationGroup']>) => void) {
  store.change(p => { const t = p.model.tables.find(x => x.name === table); if (t?.calculationGroup) f(t.calculationGroup); }, { recalc: true });
  clearQueryCache();
}

/** Commit the formula bar. Returns an error message or null. */
export function commitFormula(): string | null {
  const s = store; const fm = s.ui.formula; if (!fm) return null;
  const def = splitDefinition(fm.text);
  if (!def) return 'The syntax is incorrect. Write it as Name = expression.';
  if (!def.expr) return 'The expression is empty.';
  try { DaxParser.expr(def.expr); } catch (e) { return `The syntax for '${def.name}' is incorrect. ${(e as Error).message}`; }
  const model = s.project.model;
  const nameTaken = (n: string) => model.measures.some(m => m.name.toLowerCase() === n.toLowerCase() && m.name !== fm.editing) || (fm.kind !== 'table' && model.tables.find(t => t.name === fm.table)?.columns.some(c => c.name.toLowerCase() === n.toLowerCase() && c.name !== fm.editing));
  if (fm.kind === 'calcitem') {
    const g = model.tables.find(t => t.name === fm.table)?.calculationGroup; if (!g) return 'The calculation group no longer exists.';
    if (g.items.some(i => i.name.toLowerCase() === def.name.toLowerCase() && i.name !== fm.editing)) return `A calculation item named '${def.name}' already exists in '${fm.table}'.`;
    updateCalcGroup(fm.table, gg => {
      const ex = fm.editing ? gg.items.find(i => i.name === fm.editing) : undefined;
      if (ex) { ex.name = def.name; ex.expression = def.expr; }
      else gg.items.push({ name: def.name, expression: def.expr, ordinal: Math.max(-1, ...gg.items.map((i, k) => i.ordinal ?? k)) + 1 });
    });
    s.setUI({ formula: null, field: { table: fm.table } });
    return null;
  }
  if (fm.kind === 'measure') {
    if (nameTaken(def.name)) return `The name '${def.name}' is already used by a column or measure. Measure names must be unique in the model.`;
    s.change(p => {
      const ex = fm.editing ? p.model.measures.find(m => m.name === fm.editing) : undefined;
      if (ex) {
        // rename references in other measures
        if (ex.name !== def.name) for (const o of p.model.measures) o.expression = o.expression.replace(new RegExp(`\\[${ex.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), `[${def.name}]`);
        ex.name = def.name; ex.expression = def.expr;
      } else p.model.measures.push({ name: def.name, table: fm.table, expression: def.expr, formatString: guessFormat(def.expr) });
    });
    // validate by evaluating once
    try { s.dax.scalarOf(def.expr); } catch (e) { s.setUI({ formula: null, field: { table: fm.table, measure: def.name } }); clearQueryCache(); s.toast(`Measure saved, but it returns an error: ${(e as Error).message}`, 'error'); return null; }
    s.setUI({ formula: null, field: { table: fm.table, measure: def.name } });
  } else if (fm.kind === 'column') {
    const live = (s.project as any).liveConnection;
    if (live && (!live.composite || (model.tables.find(t => t.name === fm.table) as any)?.remote)) return live.composite ? 'Calculated columns can\'t be added to tables from the remote semantic model. Add them to your local tables, or ask the model owner.' : 'Calculated columns aren\'t available in a live connection. Select "Make changes to this model" to create a composite model, or create a measure instead.';
    if (model.tables.find(t => t.name === fm.table)?.storageMode === 'DirectLake') return `Calculated columns aren't supported on Direct Lake tables. Add the column to the Delta table in the lakehouse, or create a measure instead.`;
    if (nameTaken(def.name)) return `The name '${def.name}' is already used in table '${fm.table}'.`;
    s.change(p => {
      const t = p.model.tables.find(x => x.name === fm.table)!;
      const ex = fm.editing ? t.columns.find(c => c.name === fm.editing) : undefined;
      if (ex) { ex.name = def.name; ex.expression = def.expr; }
      else { t.columns.push({ name: def.name, dataType: 'any', expression: def.expr, summarizeBy: 'None' }); t.rows.forEach(r => r.push(null)); }
    }, { recalc: true });
    const c = s.project.model.tables.find(x => x.name === fm.table)?.columns.find(x => x.name === def.name);
    if (c && ['int', 'decimal', 'currency'].includes(c.dataType) && !fm.editing) c.summarizeBy = 'Sum';
    if ((c as any)?.error) { s.setUI({ field: { table: fm.table, column: def.name } }); return (c as any).error; }
    s.setUI({ formula: null, field: { table: fm.table, column: def.name } });
  } else {
    const live = (s.project as any).liveConnection;
    if (live && !live.composite) return 'Calculated tables aren\'t available in a live connection. Select "Make changes to this model" first.';
    if (model.tables.some(t => t.name.toLowerCase() === def.name.toLowerCase() && t.name !== fm.editing)) return `A table named '${def.name}' already exists.`;
    s.change(p => {
      const ex = fm.editing ? p.model.tables.find(t => t.name === fm.editing) : undefined;
      if (ex) { ex.name = def.name; ex.expression = def.expr; }
      else p.model.tables.push({ name: def.name, columns: [], rows: [], expression: def.expr });
    }, { recalc: true });
    const t = s.project.model.tables.find(x => x.name === def.name);
    if ((t as any)?.error) return (t as any).error;
    s.setUI({ formula: null, tableViewTable: def.name, field: { table: def.name } });
  }
  clearQueryCache();
  return null;
}

function guessFormat(expr: string): string | undefined {
  if (/DIVIDE|%|PCT|RATIO|MARGIN/i.test(expr) && /DIVIDE|\//.test(expr)) return '0.00%';
  return undefined;
}

export function deleteField(f: { table: string; column?: string; measure?: string }) {
  const s = store;
  s.change(p => {
    if (f.measure) p.model.measures = p.model.measures.filter(m => m.name !== f.measure);
    else if (f.column) {
      const t = p.model.tables.find(x => x.name === f.table)!; const i = t.columns.findIndex(c => c.name === f.column);
      if (!t.columns[i]?.expression) { store.toast('Only calculated columns can be deleted here. Remove source columns in Power Query (Transform data).', 'error'); return; }
      t.columns.splice(i, 1); t.rows.forEach(r => r.splice(i, 1));
      p.model.relationships = p.model.relationships.filter(r => !((r.fromTable === f.table && r.fromColumn === f.column) || (r.toTable === f.table && r.toColumn === f.column)));
    } else {
      const t = p.model.tables.find(x => x.name === f.table);
      if (t && !t.expression) {
        const q = p.queries.find(x => x.name === f.table); if (q) q.load = false;
      }
      p.model.tables = p.model.tables.filter(x => x.name !== f.table);
      p.model.measures = p.model.measures.filter(m => m.table !== f.table);
      p.model.relationships = p.model.relationships.filter(r => r.fromTable !== f.table && r.toTable !== f.table);
    }
    for (const pg of p.report.pages) for (const v of pg.visuals) for (const k of Object.keys(v.wells)) v.wells[k] = v.wells[k].filter(x => !(x.table === f.table && (!f.column || x.column === f.column) && (!f.measure || x.measure === f.measure)));
  }, { recalc: true });
  s.setUI({ field: null });
  clearQueryCache();
}

export function renameField(f: { table: string; column?: string; measure?: string }, name: string) {
  const s = store; if (!name.trim()) return;
  s.change(p => {
    if (f.measure) {
      const m = p.model.measures.find(x => x.name === f.measure)!; const old = m.name; m.name = name;
      for (const o of p.model.measures) o.expression = o.expression.split(`[${old}]`).join(`[${name}]`);
      for (const pg of p.report.pages) for (const v of pg.visuals) for (const k of Object.keys(v.wells)) for (const x of v.wells[k]) if (x.measure === old) x.measure = name;
    } else if (f.column) {
      const t = p.model.tables.find(x => x.name === f.table)!; const c = t.columns.find(x => x.name === f.column)!;
      if (!c.expression) {
        // a renamed source column becomes a Power Query step, as in Power BI
        const q = p.queries.find(x => x.name === f.table);
        if (q) q.code = appendRenameStep(q.code, f.column!, name);
      }
      c.name = name;
      for (const r of p.model.relationships) { if (r.fromTable === f.table && r.fromColumn === f.column) r.fromColumn = name; if (r.toTable === f.table && r.toColumn === f.column) r.toColumn = name; }
      for (const pg of p.report.pages) for (const v of pg.visuals) for (const k of Object.keys(v.wells)) for (const x of v.wells[k]) if (x.table === f.table && x.column === f.column) x.column = name;
      for (const o of p.model.measures) o.expression = o.expression.split(`${f.table}[${f.column}]`).join(`${f.table}[${name}]`).split(`'${f.table}'[${f.column}]`).join(`'${f.table}'[${name}]`);
      for (const tt of p.model.tables) { for (const cc of tt.columns) if (cc.sortByColumn === f.column && tt.name === f.table) cc.sortByColumn = name; if (tt.name === f.table && tt.dateColumn === f.column) tt.dateColumn = name; }
    } else {
      const t = p.model.tables.find(x => x.name === f.table)!; const old = t.name; t.name = name;
      const q = p.queries.find(x => x.name === old); if (q) q.name = name;
      for (const m of p.model.measures) { if (m.table === old) m.table = name; m.expression = m.expression.split(`'${old}'[`).join(`'${name}'[`).replace(new RegExp(`\\b${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[`, 'g'), /\s/.test(name) ? `'${name}'[` : `${name}[`); }
      for (const r of p.model.relationships) { if (r.fromTable === old) r.fromTable = name; if (r.toTable === old) r.toTable = name; }
      for (const pg of p.report.pages) for (const v of pg.visuals) for (const k of Object.keys(v.wells)) for (const x of v.wells[k]) if (x.table === old) x.table = name;
      for (const h of p.model.hierarchies) if (h.table === old) h.table = name;
    }
  }, { recalc: true });
  clearQueryCache();
}

import { splitSteps, joinSteps, mId, mStr } from '../m/parser';
export function appendRenameStep(code: string, oldName: string, newName: string) {
  const sp = splitSteps(code); if (!sp) return code;
  const last = sp.steps[sp.steps.length - 1];
  if (last.name.startsWith('Renamed Columns') && last.code.startsWith('Table.RenameColumns(')) {
    last.code = last.code.replace(/\}\}\)$/, `}, {${mStr(oldName)}, ${mStr(newName)}}})`);
    return joinSteps(sp.steps);
  }
  let n = 'Renamed Columns', i = 1; while (sp.steps.some(st => st.name === n)) n = `Renamed Columns${i++}`;
  sp.steps.push({ name: n, code: `Table.RenameColumns(${mId(last.name)},{{${mStr(oldName)}, ${mStr(newName)}}})` });
  return joinSteps(sp.steps);
}

export function openPowerQuery(select?: string) {
  const s = store;
  const live = (s.project as any).liveConnection;
  if (live && !live.composite) { s.toast(`This report is connected live to the semantic model "${live.name}", so Power Query isn't available. Select "Make changes to this model" in the status bar to add your own data (a composite model).`, 'error'); return; }
  if (select && s.project.model.tables.find(t => t.name === select)?.storageMode === 'DirectLake') { s.toast(`${select} is a Direct Lake table. Direct Lake tables can't be transformed in Power Query; change the data in the lakehouse instead.`, 'error'); return; }
  const queries = JSON.parse(JSON.stringify(s.project.queries));
  s.setUI({ pq: { queries, selected: select ?? queries[0]?.name ?? null, step: null, selectedCols: [], dirty: false, profile: { quality: true, distribution: false, profile: false, whole: false }, formulaBar: true, showSettings: true, ribbon: 'Home' } });
}

export function refreshAll() {
  const s = store;
  if (!s.project.queries.length) { s.toast('There\'s no data to refresh yet. Use Get data first.'); return; }
  const r = s.refresh({ autodetect: false });
  clearQueryCache();
  if (r.errors.length) s.openDialog({ type: 'loadErrors', errors: r.errors });
  else {
    const modes = s.project.model.tables.map(t => t.storageMode ?? 'Import');
    const note = modes.includes('DirectLake') ? ' Direct Lake tables were reframed (pointed at the latest Delta version).' : modes.includes('DirectQuery') ? ' DirectQuery tables have no imported data; their visuals query the source directly.' : '';
    s.toast(`Refreshed ${r.loaded.length} table${r.loaded.length === 1 ? '' : 's'}.${note}`);
  }
}

/** Modeling > New parameter > Numeric range (a "what-if" parameter). */
export function createWhatIf(name: string, min: number, max: number, step: number, dflt: number, slicer: boolean) {
  const s = store;
  const q = /\s/.test(name) ? `'${name}'` : name;
  s.change(p => {
    p.model.tables.push({ name, columns: [], rows: [], expression: `SELECTCOLUMNS(GENERATESERIES(${min}, ${max}, ${step}), "${name}", [Value])` });
    p.model.measures.push({ name: `${name} Value`, table: name, expression: `SELECTEDVALUE(${q}[${name}], ${dflt})` });
  }, { recalc: true });
  if (slicer) { const id = addVisual('slicer'); addFieldToVisual(id, { table: name, column: name }); store.updateVisual(id, v => { v.format = { ...v.format, singleSelect: true }; }); }
  clearQueryCache();
}

// ---------- storage mode ----------
/** Change a table's storage mode with Power BI's rules: Import is final, and only DirectQuery-capable tables can be DirectQuery or Dual. */
export function setStorageMode(table: string, mode: 'Import' | 'DirectQuery' | 'Dual') {
  const s = store; const t = s.project.model.tables.find(x => x.name === table); if (!t) return;
  const cur = t.storageMode ?? 'Import';
  if (cur === mode) return;
  if (cur === 'DirectLake') { s.toast('Direct Lake tables read Delta tables in OneLake. To use Import, add the table again with Get data and choose Import.', 'error'); return; }
  if (cur === 'Import') { s.openDialog({ type: 'message', title: 'Storage mode', text: `${table} is in Import mode. A table in Import mode can't be changed to ${mode}: its data was copied into the model when it was loaded. To use ${mode}, connect to the source again (for example Get data › SQL Server) and choose DirectQuery as the data connectivity mode.` }); return; }
  const apply = () => {
    s.change(p => {
      const tt = p.model.tables.find(x => x.name === table)!; tt.storageMode = mode;
      const q = p.queries.find(x => x.name === table); if (q) q.storageMode = mode === 'Import' ? 'Import' : 'DirectQuery';
    });
    if (mode === 'Import') { s.refresh({ only: [table], autodetect: false }); s.toast(`${table} is now in Import mode. Its data was loaded into the model; refresh it to get new data.`); }
    clearQueryCache();
  };
  if (mode === 'Import') s.openDialog({ type: 'confirm', title: 'Storage mode', text: `Setting the storage mode to Import is an irreversible operation. You won't be able to switch ${table} back to ${cur}. The data will be loaded into the model and must be refreshed to stay current.`, ok: 'OK', onOk: apply });
  else apply();
}
/** "Switch all tables to Import mode" (Power Query banner and the status bar). */
export function switchToImport(focus?: string) {
  const s = store;
  const run = () => {
    s.change(p => { for (const t of p.model.tables) if (t.storageMode === 'DirectQuery' || t.storageMode === 'Dual') t.storageMode = 'Import'; for (const q of p.queries) if (q.storageMode === 'DirectQuery') q.storageMode = 'Import'; });
    if (s.ui.pq) s.setUI({ pq: { ...s.ui.pq, queries: s.ui.pq.queries.map(q => (q.storageMode === 'DirectQuery' ? { ...q, storageMode: 'Import' as const } : q)), dirty: true } });
    clearQueryCache();
    s.toast(`All tables are now in Import mode${focus ? `; ${focus} can use any Power Query step` : ''}. Apply your changes to load the data.`);
  };
  s.openDialog({ type: 'confirm', title: 'Switch all tables to Import mode', text: 'Switching to Import mode is an irreversible operation. You won\'t be able to switch back to DirectQuery. Do you want to continue?', ok: 'Switch', onOk: run });
}

/** Status bar › Make changes to this model: turn a live connection into a composite model (DirectQuery to the semantic model). */
export function makeChangesToModel() {
  const s = store; const live = (s.project as any).liveConnection; if (!live) return;
  s.openDialog({ type: 'confirm', title: 'Make changes to this model', text: `Power BI will switch the live connection to "${live.name}" to a DirectQuery connection, so you can add data from other sources, calculated columns on your own tables and relationships (a composite model). The remote model's tables stay in DirectQuery mode and keep the owner's RLS and permissions. You need Build permission on it, and the workspace admin must allow DirectQuery connections to Power BI semantic models.`, ok: 'Add a local model', onOk: () => {
    s.change(p => { (p as any).liveConnection = { ...live, composite: true }; for (const t of p.model.tables) if ((t as any).remote) t.storageMode = 'DirectQuery'; });
    clearQueryCache(); s.toast('This is now a composite model. Use Get data to add your own tables; the semantic model\'s tables show as DirectQuery.');
  } });
}
