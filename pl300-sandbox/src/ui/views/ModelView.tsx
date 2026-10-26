// Model view: table cards, relationship lines with cardinality and cross-filter direction, Properties pane.
import { FormulaBar } from '../FormulaBar';
import React, { useMemo, useRef, useState } from 'react';
import { useStore, store } from '../../store';
import { DataPane } from '../panes/DataPane';
import { I } from '../icons';
import { menuAt, Toggle, typeIcon } from '../common';
import { Relationship, ModelTable } from '../../model/types';
import { isNumericType, keyOf } from '../../core/values';
import { clearQueryCache } from '../report/vhelpers';
import { openPowerQuery, startNewMeasure, startNewColumn, updateCalcGroup, editCalcItem, startCalcItem, setStorageMode } from '../actions';

const CARD_W = 200;
const cardH = (t: ModelTable, measures: number) => 34 + Math.min(260, (t.columns.filter(c => !c.hidden || true).length + measures) * 22 + 6);

/** In a composite model, a relationship between tables in different source groups is limited (no blank row, no RI assumptions). */
export function isLimited(r: Relationship, m: { tables: ModelTable[] }): boolean {
  if (r.cardinality === 'many-many') return true;
  const g = (t: string) => { const mode = m.tables.find(x => x.name === t)?.storageMode ?? 'Import'; return mode === 'Import' ? 'import' : mode === 'DirectLake' ? 'lake' : mode === 'DirectQuery' ? 'dq' : 'dual'; };
  const a = g(r.fromTable), b = g(r.toTable);
  if (a === 'dual' || b === 'dual') return false;
  return a !== b;
}

export function relationshipValid(r: Relationship): string | null {
  const m = store.project.model;
  const a = m.tables.find(t => t.name === r.fromTable), b = m.tables.find(t => t.name === r.toTable);
  if (!a || !b) return 'Table not found';
  const ai = a.columns.findIndex(c => c.name === r.fromColumn), bi = b.columns.findIndex(c => c.name === r.toColumn);
  if (ai < 0 || bi < 0) return 'Column not found';
  const uniq = (t: ModelTable, i: number) => { const s = new Set<string>(); for (const row of t.rows) { const k = keyOf(row[i]); if (s.has(k)) return false; s.add(k); } return true; };
  if (r.cardinality === 'many-one' && !uniq(b, bi)) return `The cardinality you selected isn't valid for this relationship: '${b.name}'[${r.toColumn}] contains duplicate values. Choose Many to many, or remove the duplicates.`;
  if (r.cardinality === 'one-one' && (!uniq(a, ai) || !uniq(b, bi))) return 'One to one requires unique values in both columns.';
  return null;
}

export function autoLayout(tables: ModelTable[], rels: Relationship[]) {
  // facts (many sides) in the middle row, dimensions around them
  const layout: Record<string, { x: number; y: number }> = {};
  const manyCount = (t: string) => rels.filter(r => r.fromTable === t).length;
  const facts = tables.filter(t => manyCount(t.name) > 0).sort((a, b) => manyCount(b.name) - manyCount(a.name));
  const others = tables.filter(t => !facts.includes(t));
  const h = (t: ModelTable) => cardH(t, store.project.model.measures.filter(m => m.table === t.name).length);
  // dimensions in columns either side of the fact table(s)
  const left = others.filter((_t, i) => i % 2 === 0), right = others.filter((_t, i) => i % 2 === 1);
  const perCol = 2;
  const colsL = Math.ceil(left.length / perCol);
  const place = (list: ModelTable[], x0: number, dir: 1 | -1) => list.forEach((t, i) => {
    const col = Math.floor(i / perCol), row = i % perCol;
    const above = list.slice(col * perCol, col * perCol + row).reduce((a, x) => a + h(x) + 50, 0);
    layout[t.name] = { x: x0 + dir * col * 250, y: 20 + above };
  });
  const factX = 40 + Math.max(colsL, facts.length ? 1 : 0) * 250 + (colsL ? 40 : 0);
  place(left, 40 + Math.max(0, colsL - 1) * 250, -1);
  let fy = 20; for (const f of facts) { layout[f.name] = { x: factX, y: fy }; fy += h(f) + 50; }
  place(right, factX + (facts.length ? 290 : 0), 1);
  return layout;
}

export function ModelView() {
  const s = useStore();
  const m = s.project.model;
  const wrap = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ kind: 'table' | 'column' | 'measure' | 'rel'; table?: string; name?: string; id?: string } | null>(null);
  const [drag, setDrag] = useState<{ table: string; dx: number; dy: number } | null>(null);
  const [colDrag, setColDrag] = useState<{ table: string; col: string; x: number; y: number } | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const layout = useMemo(() => {
    const auto = autoLayout(m.tables, m.relationships);
    return Object.fromEntries(m.tables.map(t => [t.name, s.ui.modelLayout[t.name] ?? auto[t.name]]));
  }, [m.tables.length, m.relationships.length, s.ui.modelLayout]);
  const pos = (t: string) => { const p = layout[t] ?? { x: 0, y: 0 }; return drag?.table === t ? { x: p.x + drag.dx, y: p.y + drag.dy } : p; };
  const heights = Object.fromEntries(m.tables.map(t => [t.name, cardH(t, m.measures.filter(x => x.table === t.name).length)]));
  const startCardDrag = (e: React.MouseEvent, t: string) => {
    e.preventDefault(); const sx = e.clientX, sy = e.clientY;
    const mv = (ev: MouseEvent) => setDrag({ table: t, dx: ev.clientX - sx, dy: ev.clientY - sy });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      const p = layout[t]; setDrag(null);
      s.setUI({ modelLayout: { ...layout, [t]: { x: Math.max(0, p.x + ev.clientX - sx), y: Math.max(0, p.y + ev.clientY - sy) } } });
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    setSel({ kind: 'table', table: t }); s.setUI({ field: { table: t } });
  };
  const startColDrag = (e: React.MouseEvent, table: string, col: string) => {
    e.preventDefault(); e.stopPropagation();
    const r = wrap.current!.getBoundingClientRect();
    const mv = (ev: MouseEvent) => setColDrag({ table, col, x: ev.clientX - r.left + wrap.current!.scrollLeft, y: ev.clientY - r.top + wrap.current!.scrollTop });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      setColDrag(null); setHoverCol(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-col]') as HTMLElement | null;
      if (!el) { setSel({ kind: 'column', table, name: col }); s.setUI({ field: { table, column: col } }); return; }
      const [t2, c2] = JSON.parse(el.dataset.col!);
      if (t2 === table) return;
      createRelationship(table, col, t2, c2);
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const lines = m.relationships.map(r => {
    const a = pos(r.fromTable), b = pos(r.toTable);
    if (!a || !b) return null;
    const ac = { x: a.x + CARD_W / 2, y: a.y + heights[r.fromTable] / 2 }, bc = { x: b.x + CARD_W / 2, y: b.y + heights[r.toTable] / 2 };
    const clip = (c: { x: number; y: number }, o: { x: number; y: number }, h: number) => {
      const dx = o.x - c.x, dy = o.y - c.y; const sx = (CARD_W / 2) / Math.abs(dx || 1e-9), sy = (h / 2) / Math.abs(dy || 1e-9); const k = Math.min(sx, sy);
      return { x: c.x + dx * k, y: c.y + dy * k };
    };
    let p1 = clip(ac, bc, heights[r.fromTable]), p2 = clip(bc, ac, heights[r.toTable]);
    // spread parallel relationships between the same two tables
    const pair = m.relationships.filter(x => [x.fromTable, x.toTable].sort().join('|') === [r.fromTable, r.toTable].sort().join('|'));
    if (pair.length > 1) {
      const k = pair.indexOf(r) - (pair.length - 1) / 2;
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const nx = -(p2.y - p1.y) / len * 14 * k, ny = (p2.x - p1.x) / len * 14 * k;
      p1 = { x: p1.x + nx, y: p1.y + ny }; p2 = { x: p2.x + nx, y: p2.y + ny };
    }
    return { r, p1, p2 };
  }).filter(Boolean) as { r: Relationship; p1: { x: number; y: number }; p2: { x: number; y: number } }[];
  const W = Math.max(1200, ...m.tables.map(t => pos(t.name).x + CARD_W + 80)), H = Math.max(800, ...m.tables.map(t => pos(t.name).y + heights[t.name] + 80));
  const relMenu = (e: React.MouseEvent, r: Relationship) => menuAt(e, [
    { label: 'Properties', icon: 'edit', onClick: () => s.openDialog({ type: 'editRelationship', id: r.id }) },
    { label: r.active ? 'Make inactive' : 'Make active', onClick: () => toggleActive(r) },
    { label: 'Delete', icon: 'trash', onClick: () => { s.change(p => { p.model.relationships = p.model.relationships.filter(x => x.id !== r.id); }); clearQueryCache(); } },
  ]);
  return <>
    <div className="center">
      <FormulaBar />
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px', background: '#fff', borderBottom: '1px solid #e1dfdd', alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ marginRight: 8 }}>All tables</b>
        <button className="btn sm" onClick={() => s.openDialog({ type: 'relationships' })}>Manage relationships</button>
        <button className="btn sm" onClick={() => s.openDialog({ type: 'editRelationship' })}>New relationship</button>
        <button className="btn sm" onClick={() => s.setUI({ modelLayout: autoLayout(m.tables, m.relationships) })}>Auto-layout</button>
        <span className="tiny">Drag a column onto a column in another table to create a relationship. Double-click a line to edit it.</span>
      </div>
      <div className="model-wrap" ref={wrap} onMouseDown={e => { if (e.target === e.currentTarget) setSel(null); }}>
        <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="#605e5c" /></marker>
          </defs>
          {lines.map(({ r, p1, p2 }) => {
            const selected = sel?.kind === 'rel' && sel.id === r.id;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const ang = Math.atan2(p1.y - p2.y, p1.x - p2.x) * 180 / Math.PI; // direction one → many
            const both = r.crossFilter === 'both' || r.cardinality === 'one-one';
            const near = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: p.x + (q.x - p.x) * 0.1, y: p.y + (q.y - p.y) * 0.1 - 6 });
            const l1 = near(p1, p2), l2 = near(p2, p1);
            return <g key={r.id} className="rel-line" onClick={() => setSel({ kind: 'rel', id: r.id })} onDoubleClick={() => s.openDialog({ type: 'editRelationship', id: r.id })} onContextMenu={e => relMenu(e, r)}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={12} />
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={selected ? '#0f6cbd' : '#8a8886'} strokeWidth={selected ? 2.5 : 1.5} strokeDasharray={r.active ? undefined : '6 4'} />
              {isLimited(r, m) && [p1, p2].map((p, k) => { const o = k ? p1 : p2; const len = Math.hypot(o.x - p.x, o.y - p.y) || 1; const ux = (o.x - p.x) / len, uy = (o.y - p.y) / len; const c = { x: p.x + ux * 22, y: p.y + uy * 22 }; return <path key={k} d={`M${c.x - uy * 6 + ux * 3},${c.y + ux * 6 + uy * 3} Q${c.x - ux * 2},${c.y - uy * 2} ${c.x + uy * 6 + ux * 3},${c.y - ux * 6 + uy * 3}`} fill="none" stroke="#252423" strokeWidth={1.6}><title>Limited relationship</title></path>; })}
              <text x={l1.x} y={l1.y} fontSize={13} fontWeight={700} fill="#252423" textAnchor="middle">{r.cardinality === 'one-one' ? '1' : '*'}</text>
              <text x={l2.x} y={l2.y} fontSize={13} fontWeight={700} fill="#252423" textAnchor="middle">{r.cardinality === 'many-many' ? '*' : '1'}</text>
              <g transform={`translate(${mid.x},${mid.y}) rotate(${ang})`}>
                <rect x={-12} y={-7} width={24} height={14} rx={3} fill="#fff" stroke="#c8c6c4" />
                <path d="M-6,-3 L0,0 L-6,3" fill="none" stroke="#252423" strokeWidth={1.5} transform="translate(3,0)" />
                {both && <path d="M6,-3 L0,0 L6,3" fill="none" stroke="#252423" strokeWidth={1.5} transform="translate(-3,0)" />}
              </g>
            </g>;
          })}
          {colDrag && (() => { const p = pos(colDrag.table); return <line x1={p.x + CARD_W} y1={p.y + 40} x2={colDrag.x} y2={colDrag.y} stroke="#0f6cbd" strokeDasharray="4 3" strokeWidth={2} />; })()}
        </svg>
        {m.tables.map(t => {
          const p = pos(t.name);
          const ms = m.measures.filter(x => x.table === t.name);
          return <div key={t.name} className={`mcard ${sel?.table === t.name && sel.kind === 'table' ? 'sel' : ''} sm-${(t.storageMode ?? 'Import').toLowerCase()}`} style={{ left: p.x, top: p.y, width: CARD_W }} title={t.storageMode && t.storageMode !== 'Import' ? `Storage mode: ${t.storageMode === 'DirectLake' ? 'Direct Lake' : t.storageMode}` : undefined}>
            <div className="mcard-h" onMouseDown={e => startCardDrag(e, t.name)} onDoubleClick={() => (t.expression ? null : openPowerQuery(t.name))}
              onContextMenu={e => menuAt(e, [{ label: 'New measure', icon: 'measure', onClick: () => startNewMeasure(t.name) }, { label: 'New column', icon: 'newcolumn', onClick: () => startNewColumn(t.name) }, { label: 'Edit query', icon: 'transform', disabled: !!t.expression, onClick: () => openPowerQuery(t.name) }, { label: 'Mark as date table', icon: 'calendar', onClick: () => s.openDialog({ type: 'markDate', table: t.name }) }, { label: t.hidden ? 'Unhide in report view' : 'Hide in report view', onClick: () => s.change(pr => { pr.model.tables.find(x => x.name === t.name)!.hidden = !t.hidden; }) }])}>
              <I n={t.expression ? 'calcTable' : 'tableIcon'} s={15} /><span className="nm" style={{ fontStyle: t.hidden ? 'italic' : undefined }}>{t.name}</span>{t.dateColumn && <I n="calendar" s={13} />}{t.hidden && <I n="eyeOff" s={13} />}
            </div>
            <div className="mcard-b">
              {t.columns.map(c => {
                const key = JSON.stringify([t.name, c.name]);
                return <div key={c.name} data-col={key} className={`mcol ${sel?.kind === 'column' && sel.table === t.name && sel.name === c.name ? 'sel' : ''} ${colDrag && hoverCol === key ? 'drop' : ''} ${c.hidden ? 'hid' : ''}`}
                  onMouseDown={e => startColDrag(e, t.name, c.name)} onMouseEnter={() => colDrag && setHoverCol(key)}
                  onClick={() => { setSel({ kind: 'column', table: t.name, name: c.name }); s.setUI({ field: { table: t.name, column: c.name } }); }}>
                  <I n={c.expression ? 'fieldCalcCol' : isNumericType(c.dataType) && c.summarizeBy !== 'None' ? 'fieldNum' : typeIcon(c.dataType)} s={14} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  {c.hidden && <I n="eyeOff" s={12} />}
                  {m.relationships.some(r => (r.toTable === t.name && r.toColumn === c.name)) && <span title="Key column of a relationship"><I n="key" s={12} /></span>}
                </div>;
              })}
              {ms.map(x => <div key={'m' + x.name} className={`mcol ${sel?.kind === 'measure' && sel.name === x.name ? 'sel' : ''}`} onClick={() => { setSel({ kind: 'measure', table: t.name, name: x.name }); s.setUI({ field: { table: t.name, measure: x.name } }); }}>
                <I n="fieldCalc" s={14} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</span></div>)}
            </div>
          </div>;
        })}
        {!m.tables.length && <div className="empty-canvas"><h2>No tables in the model</h2><div>Load data first; tables and their relationships appear here.</div></div>}
      </div>
    </div>
    <PropertiesPane sel={sel} />
    <DataPane mode="model" />
  </>;
}

function toggleActive(r: Relationship) {
  const s = store;
  if (!r.active) {
    // only one active path between two tables
    const clash = s.project.model.relationships.find(x => x.active && x.id !== r.id && [x.fromTable, x.toTable].sort().join() === [r.fromTable, r.toTable].sort().join());
    if (clash) { s.openDialog({ type: 'message', title: 'Can\'t activate relationship', text: `You can't create a direct active relationship between ${r.fromTable} and ${r.toTable} because an active relationship already exists between these tables (${clash.fromTable}[${clash.fromColumn}] → ${clash.toTable}[${clash.toColumn}]). Deactivate it first, or use USERELATIONSHIP in a measure.` }); return; }
  }
  s.change(p => { p.model.relationships.find(x => x.id === r.id)!.active = !r.active; });
  clearQueryCache();
}

export function createRelationship(t1: string, c1: string, t2: string, c2: string) {
  const s = store; const m = s.project.model;
  const A = m.tables.find(t => t.name === t1)!, B = m.tables.find(t => t.name === t2)!;
  const uniq = (t: ModelTable, c: string) => { const i = t.columns.findIndex(x => x.name === c); const set = new Set<string>(); for (const r of t.rows) { const k = keyOf(r[i]); if (set.has(k)) return false; set.add(k); } return true; };
  const ua = uniq(A, c1), ub = uniq(B, c2);
  let rel: Relationship;
  const id = 'rel' + Math.random().toString(36).slice(2, 9);
  if (ua && !ub) rel = { id, fromTable: t2, fromColumn: c2, toTable: t1, toColumn: c1, cardinality: 'many-one', crossFilter: 'single', active: true };
  else if (ub && !ua) rel = { id, fromTable: t1, fromColumn: c1, toTable: t2, toColumn: c2, cardinality: 'many-one', crossFilter: 'single', active: true };
  else if (ua && ub) rel = { id, fromTable: t1, fromColumn: c1, toTable: t2, toColumn: c2, cardinality: 'one-one', crossFilter: 'both', active: true };
  else rel = { id, fromTable: t1, fromColumn: c1, toTable: t2, toColumn: c2, cardinality: 'many-many', crossFilter: 'single', active: true };
  const clash = m.relationships.some(x => x.active && [x.fromTable, x.toTable].sort().join() === [rel.fromTable, rel.toTable].sort().join());
  if (clash) rel.active = false;
  s.change(p => { p.model.relationships.push(rel); });
  clearQueryCache();
  s.toast(`Created ${rel.cardinality === 'many-one' ? 'many-to-one (*:1)' : rel.cardinality === 'one-one' ? 'one-to-one (1:1)' : 'many-to-many (*:*)'} relationship ${rel.fromTable}[${rel.fromColumn}] → ${rel.toTable}[${rel.toColumn}]${rel.active ? '' : ' (inactive: another active path already exists)'}`);
}

function PropertiesPane({ sel }: { sel: { kind: string; table?: string; name?: string; id?: string } | null }) {
  const s = store; const m = s.project.model;
  const body = (() => {
    if (!sel) return <>
      <div className="tiny">Select a table, column, measure or relationship to see its properties. These are the semantic model's properties.</div>
      <div className="frow"><label>Model</label><b>{s.project.name}</b></div>
      <div className="frow inline"><label title="Report authors can't summarize numeric columns automatically; they must use measures. Required for calculation groups.">Discourage implicit measures</label><Toggle on={!!m.discourageImplicitMeasures} onChange={b => {
        if (!b && m.tables.some(t => t.calculationGroup)) { s.toast('This model has calculation groups, so implicit measures must stay discouraged.', 'error'); return; }
        s.change(p => { p.model.discourageImplicitMeasures = b; }); clearQueryCache();
      }} /></div>
      <div className="frow"><label>Calculation groups</label>{m.tables.filter(t => t.calculationGroup).map(t => t.name).join(', ') || 'None'}</div>
    </>;
    if (sel.kind === 'rel') {
      const r = m.relationships.find(x => x.id === sel.id); if (!r) return null;
      const set = (patch: Partial<Relationship>) => { s.change(p => { Object.assign(p.model.relationships.find(x => x.id === r.id)!, patch); }); clearQueryCache(); };
      return <>
        <div className="frow"><label>From</label><b>{r.fromTable}[{r.fromColumn}]</b></div>
        <div className="frow"><label>To</label><b>{r.toTable}[{r.toColumn}]</b></div>
        <div className="frow"><label>Cardinality</label><select className="tx" value={r.cardinality} onChange={e => set({ cardinality: e.target.value as any })}><option value="many-one">Many to one (*:1)</option><option value="one-one">One to one (1:1)</option><option value="many-many">Many to many (*:*)</option></select></div>
        <div className="frow"><label>Cross-filter direction</label><select className="tx" value={r.crossFilter} onChange={e => set({ crossFilter: e.target.value as any })}><option value="single">Single</option><option value="both">Both</option></select></div>
        <div className="frow inline"><label>Make this relationship active</label><Toggle on={r.active} onChange={() => toggleActive(r)} /></div>
        {isLimited(r, m) && <div className="info tiny">This is a <b>limited relationship</b>{r.cardinality === 'many-many' ? ' (many-to-many)' : ' (it crosses source groups in a composite model)'}. Unmatched rows don't produce a blank row, and RELATED can't be used across it.</div>}
        {relationshipValid(r) && <div className="errbox">{relationshipValid(r)}</div>}
        <button className="btn sm" onClick={() => s.openDialog({ type: 'editRelationship', id: r.id })}>Open editor…</button>
      </>;
    }
    const t = m.tables.find(x => x.name === sel.table); if (!t) return null;
    if (sel.kind === 'table' && t.calculationGroup) return <>
      <div className="frow"><label>Calculation group</label><b>{t.name}</b></div>
      <div className="frow"><label title="When several calculation groups apply, the one with the higher precedence is applied first (outermost).">Precedence</label><input className="tx" type="number" defaultValue={t.calculationGroup.precedence} key={'p' + t.name} onBlur={e => updateCalcGroup(t.name, g => { g.precedence = +e.target.value || 0; })} /></div>
      <div className="frow"><label>Calculation items</label></div>
      {[...t.calculationGroup.items].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)).map(it => <div key={it.name} style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>{it.name}</b><button className="linkbtn" onClick={() => editCalcItem(t.name, it.name)}>Edit</button></div>
        <code className="code" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{it.expression}</code>
        <div className="frow" style={{ marginTop: 4 }}><label title="Optional DAX that returns a format string, for example &quot;0.0%&quot; or SELECTEDMEASUREFORMATSTRING()">Dynamic format string</label><input className="tx" defaultValue={it.formatStringExpression ?? ''} key={'fs' + it.name} placeholder="None" onBlur={e => updateCalcGroup(t.name, g => { const x = g.items.find(y => y.name === it.name); if (x) x.formatStringExpression = e.target.value.trim() || undefined; })} /></div>
      </div>)}
      <button className="btn sm" onClick={() => startCalcItem(t.name)}>New calculation item</button>
    </>;
    if (sel.kind === 'table') return <>
      <div className="frow"><label>Name</label><b>{t.name}</b></div>
      <div className="frow"><label>Description</label><textarea className="tx" rows={2} defaultValue={t.description ?? ''} key={t.name} onBlur={e => s.change(p => { p.model.tables.find(x => x.name === t.name)!.description = e.target.value; })} /></div>
      <div className="frow"><label>Rows</label>{t.rows.length.toLocaleString()}</div>
      <div className="frow"><label>Storage mode</label>{t.storageMode === 'DirectLake' ? <b>Direct Lake</b> : <select className="tx" value={t.storageMode ?? 'Import'} onChange={e => setStorageMode(t.name, e.target.value as any)}><option>Import</option><option disabled={(t.storageMode ?? 'Import') === 'Import'}>DirectQuery</option><option disabled={(t.storageMode ?? 'Import') === 'Import'}>Dual</option></select>}
        <span className="tiny">{(t.storageMode ?? 'Import') === 'Import' ? 'Data is copied into the model. Import tables can\'t be changed to DirectQuery or Dual.' : t.storageMode === 'DirectQuery' ? 'Queries go to the source each time a visual loads. Changing to Import is irreversible.' : t.storageMode === 'Dual' ? 'Acts as Import or DirectQuery, whichever avoids a limited relationship. Use for dimension tables in composite models.' : 'Reads Delta tables in OneLake; no import refresh, only reframing.'}</span>
        {(() => { const lim = m.relationships.filter(r => (r.fromTable === t.name || r.toTable === t.name) && isLimited(r, m) && r.cardinality !== 'many-many'); return lim.length ? <div className="warnbox tiny" style={{ marginTop: 4 }}>{lim.length} limited relationship{lim.length > 1 ? 's' : ''} (Import ↔ DirectQuery). Set the dimension table to Dual to make {lim.length > 1 ? 'them' : 'it'} regular.</div> : null; })()}
      </div>
      <div className="frow inline"><label>Is hidden</label><Toggle on={!!t.hidden} onChange={b => s.change(p => { p.model.tables.find(x => x.name === t.name)!.hidden = b; })} /></div>
      <div className="frow"><label>Marked as date table</label>{t.dateColumn ? `Yes, on ${t.dateColumn}` : 'No'}</div>
      {t.expression && <div className="frow"><label>DAX expression</label><code className="code" style={{ whiteSpace: 'pre-wrap' }}>{t.expression}</code></div>}
    </>;
    if (sel.kind === 'measure') {
      const x = m.measures.find(y => y.name === sel.name); if (!x) return null;
      return <>
        <div className="frow"><label>Name</label><b>{x.name}</b></div>
        <div className="frow"><label>Description</label><textarea className="tx" rows={2} defaultValue={x.description ?? ''} key={x.name} onBlur={e => s.change(p => { p.model.measures.find(y => y.name === x.name)!.description = e.target.value; })} /></div>
        <div className="frow"><label>Formula</label><code className="code" style={{ whiteSpace: 'pre-wrap', background: '#f8f8f8', padding: 6, borderRadius: 3 }}>{x.expression}</code></div>
        <div className="frow"><label>Format string</label><input className="tx" defaultValue={x.formatString ?? ''} key={'f' + x.name} onBlur={e => s.change(p => { p.model.measures.find(y => y.name === x.name)!.formatString = e.target.value || undefined; })} /></div>
        <div className="frow"><label>Display folder</label><input className="tx" defaultValue={x.displayFolder ?? ''} key={'d' + x.name} onBlur={e => s.change(p => { p.model.measures.find(y => y.name === x.name)!.displayFolder = e.target.value || undefined; })} /></div>
        <div className="frow inline"><label>Is hidden</label><Toggle on={!!x.hidden} onChange={b => s.change(p => { p.model.measures.find(y => y.name === x.name)!.hidden = b; })} /></div>
      </>;
    }
    const c = t.columns.find(x => x.name === sel.name); if (!c) return null;
    const set = (patch: any) => { s.change(p => { Object.assign(p.model.tables.find(x => x.name === t.name)!.columns.find(x => x.name === c.name)!, patch); }); clearQueryCache(); };
    return <>
      <div className="frow"><label>Name</label><b>{c.name}</b></div>
      <div className="frow"><label>Description</label><textarea className="tx" rows={2} defaultValue={c.description ?? ''} key={t.name + c.name} onBlur={e => set({ description: e.target.value })} /></div>
      <div className="frow"><label>Data type</label>{c.dataType}</div>
      <div className="frow"><label>Format</label><input className="tx" defaultValue={c.formatString ?? ''} key={'f' + t.name + c.name} placeholder="General" onBlur={e => set({ formatString: e.target.value || undefined })} /></div>
      <div className="frow"><label>Sort by column</label><select className="tx" value={c.sortByColumn ?? ''} onChange={e => set({ sortByColumn: e.target.value || undefined })}><option value="">{c.name}</option>{t.columns.filter(x => x !== c).map(x => <option key={x.name}>{x.name}</option>)}</select></div>
      <div className="frow"><label>Summarize by</label><select className="tx" value={c.summarizeBy ?? 'None'} onChange={e => set({ summarizeBy: e.target.value })}>{['None', 'Sum', 'Average', 'Min', 'Max', 'Count', 'DistinctCount'].map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="frow"><label>Data category</label><select className="tx" value={c.dataCategory ?? 'Uncategorized'} onChange={e => set({ dataCategory: e.target.value })}>{['Uncategorized', 'Address', 'City', 'Continent', 'Country', 'County', 'Latitude', 'Longitude', 'Place', 'Postal code', 'State or Province', 'Web URL', 'Image URL'].map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="frow"><label>Display folder</label><input className="tx" defaultValue={c.displayFolder ?? ''} key={'d' + t.name + c.name} onBlur={e => set({ displayFolder: e.target.value || undefined })} /></div>
      <div className="frow inline"><label>Is hidden</label><Toggle on={!!c.hidden} onChange={b => set({ hidden: b })} /></div>
      {c.expression && <div className="frow"><label>DAX expression</label><code className="code" style={{ whiteSpace: 'pre-wrap' }}>{c.expression}</code></div>}
    </>;
  })();
  return <div className="pane" style={{ width: 240 }}>
    <div className="pane-h"><span>Properties</span></div>
    <div className="pane-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{body}</div>
  </div>;
}
