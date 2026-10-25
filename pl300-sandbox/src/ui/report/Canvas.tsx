// Report canvas: page, visual containers (move/resize/select), visual header, page tabs.
import React, { useEffect, useRef, useState } from 'react';
import { store, useStore, uid } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { CartesianChart, PieChart, Waterfall, Scatter, Gauge, NoData } from './charts';
import { TableVisual, MatrixVisual } from './tables';
import { Card, CardNew, MultiRowCard, KPI } from './cards';
import { Slicer } from './slicer';
import { TextBox, ButtonEl, Shape, ImageEl } from './elements';
import { DecompositionTree, KeyInfluencers, QnA, Narrative } from './ai';
import { I } from '../icons';
import { menuAt, menuBelow, MenuItem, download } from '../common';
import { drillLevels, fieldLabel, summarize, visualContext, fmt, formatFor, isValueField, interactionFor } from '../../report/query';
import { vdef, VISUALS } from '../../report/visuals';
import { addFieldToVisual, newVisualAt, pasteVisuals, copyVisuals, deleteSelected } from '../actions';

const PAGE_W = 1280, PAGE_H = 720;

export function VisualBody({ v, page }: { v: Visual; page: Page }) {
  switch (v.type) {
    case 'stackedBar': case 'stackedColumn': case 'clusteredBar': case 'clusteredColumn': case 'stackedBar100': case 'stackedColumn100':
    case 'line': case 'area': case 'stackedArea': case 'lineClusteredColumn': case 'lineStackedColumn': case 'ribbon':
      return <CartesianChart v={v} page={page} />;
    case 'map':
      return <><div className="tiny" style={{ position: 'absolute', top: 2, right: 6, zIndex: 2 }}>Map tiles aren't available offline; showing locations as bars.</div><CartesianChart v={{ ...v, type: 'clusteredBar' }} page={page} /></>;
    case 'pie': case 'donut': case 'treemap': case 'funnel': return <PieChart v={v} page={page} />;
    case 'waterfall': return <Waterfall v={v} page={page} />;
    case 'scatter': return <Scatter v={v} page={page} />;
    case 'gauge': return <Gauge v={v} page={page} />;
    case 'card': return <Card v={v} page={page} />;
    case 'cardNew': return <CardNew v={v} page={page} />;
    case 'multiRowCard': return <MultiRowCard v={v} page={page} />;
    case 'kpi': return <KPI v={v} page={page} />;
    case 'table': return <TableVisual v={v} page={page} />;
    case 'matrix': return <MatrixVisual v={v} page={page} />;
    case 'slicer': return <Slicer v={v} page={page} />;
    case 'textbox': return <TextBox v={v} />;
    case 'button': return <ButtonEl v={v} page={page} />;
    case 'shape': return <Shape v={v} />;
    case 'image': return <ImageEl v={v} />;
    case 'decompositionTree': return <DecompositionTree v={v} page={page} />;
    case 'keyInfluencers': return <KeyInfluencers v={v} page={page} />;
    case 'qna': return <QnA v={v} page={page} />;
    case 'smartNarrative': return <Narrative v={v} page={page} />;
  }
  return <NoData msg={`${vdef(v.type).name} isn't available.`} />;
}

const drillWell = (v: Visual) => (v.type === 'matrix' ? 'rows' : v.type === 'scatter' ? 'details' : 'axis');

export function exportVisualData(v: Visual, page: Page) {
  const s = store; const m = s.project.model;
  const fields: FieldRef[] = Object.entries(v.wells).flatMap(([k, fs]) => (k === 'tooltips' ? [] : fs.flatMap(f => (k === drillWell(v) ? drillLevels(s, v, k).shown : [f]))));
  const groups = fields.filter(f => !isValueField(m, f)); const vals = fields.filter(f => isValueField(m, f));
  const res = summarize(s, groups, vals, visualContext(s, page, v));
  const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const csv = [res.cols.map(c => esc(c.label)).join(','), ...res.rows.map(r => r.map((x, i) => esc(fmt(x, formatFor(m, res.cols[i].field), res.cols[i].field))).join(','))].join('\r\n');
  download(`${v.title || vdef(v.type).name}.csv`, csv, 'text/csv');
}

function VisualHeader({ v, page }: { v: Visual; page: Page }) {
  const s = store;
  const dw = drillWell(v);
  const lv = vdef(v.type).wells.some(w => w.key === dw) ? drillLevels(s, v, dw) : null;
  const canDrill = lv?.canDrill;
  const setDrill = (d: Visual['drill']) => s.updateVisual(v.id, x => { x.drill = d; }, false);
  const more = (e: React.MouseEvent) => {
    const items: MenuItem[] = [
      { label: 'Export data', icon: 'export', onClick: () => exportVisualData(v, page) },
      { label: 'Show as a table', icon: 'table', onClick: () => s.openDialog({ type: 'showAsTable', visualId: v.id }) },
      { label: 'Spotlight', icon: 'eye', onClick: () => s.setUI({ focus: v.id }) },
      { sep: true },
    ];
    const sortable = Object.entries(v.wells).filter(([k]) => k !== 'tooltips').flatMap(([k, fs]) => fs.map((f, i) => ({ k, f, i })));
    if (vdef(v.type).chart) {
      items.push({ label: 'Sort axis', icon: 'sort', items: [
        ...sortable.filter(x => x.k === 'axis').slice(0, 1).map(x => ({ label: fieldLabel(x.f), checked: v.sort?.by === 'axis', onClick: () => s.updateVisual(v.id, y => { y.sort = { by: 'axis', desc: y.sort?.desc ?? false }; }) })),
        ...(v.wells.values ?? []).map((f, i) => ({ label: fieldLabel(f), checked: v.sort?.by === `value:${i}`, onClick: () => s.updateVisual(v.id, y => { y.sort = { by: `value:${i}`, desc: y.sort?.desc ?? true }; }) })),
        { sep: true },
        { label: 'Sort descending', checked: !!v.sort?.desc, onClick: () => s.updateVisual(v.id, y => { y.sort = { by: y.sort?.by ?? 'value:0', desc: true }; }) },
        { label: 'Sort ascending', checked: !!v.sort && !v.sort.desc, onClick: () => s.updateVisual(v.id, y => { y.sort = { by: y.sort?.by ?? 'value:0', desc: false }; }) },
      ] });
    }
    items.push({ label: 'Remove', icon: 'trash', onClick: () => { s.setUI({ selected: [v.id] }); deleteSelected(); } });
    menuAt(e, items);
  };
  return <div className="vis-header" onMouseDown={e => e.stopPropagation()}>
    {canDrill && lv && <>
      <button title="Drill up" disabled={lv.level === 0} onClick={() => setDrill({ level: Math.max(0, lv.level - 1), path: (v.drill?.path ?? []).slice(0, Math.max(0, lv.level - 1)), expandAll: v.drill?.expandAll })}><I n="drillUp" s={15} c={lv.level === 0 ? '#c8c6c4' : undefined} /></button>
      <button title={v.format?.drillMode ? 'Drill down is on: click a data point to drill into it' : 'Turn on drill down'} className={v.format?.drillMode ? 'on' : ''} onClick={() => s.updateVisual(v.id, x => { x.format = { ...(x.format ?? {}), drillMode: !x.format?.drillMode }; }, false)}><I n="drillMode" s={15} /></button>
      <button title="Go to the next level in the hierarchy" disabled={lv.level >= lv.levels.length - 1} onClick={() => setDrill({ level: lv.level + 1, path: [], expandAll: false })}><I n="nextLevel" s={15} /></button>
      <button title="Expand all down one level in the hierarchy" disabled={lv.level >= lv.levels.length - 1} onClick={() => setDrill({ level: lv.level + 1, path: [], expandAll: true })}><I n="expandAll" s={15} /></button>
    </>}
    <button title="Filters and slicers affecting this visual" onClick={e => {
      const page0 = s.page();
      const fs = [...s.project.report.reportFilters.map(f => `Report: ${fieldLabel(f.field)}`), ...page0.filters.map(f => `Page: ${fieldLabel(f.field)}`), ...v.filters.map(f => `Visual: ${fieldLabel(f.field)}`),
        ...page0.visuals.filter(x => x.type === 'slicer' && x.id !== v.id && (x.slicer?.values?.length || x.slicer?.range) && interactionFor(page0, x, v) !== 'none').map(x => `Slicer: ${x.wells.field?.map(f => fieldLabel(f)).join(', ')}`)];
      menuBelow(e.currentTarget, fs.length ? fs.map(t => ({ label: t, icon: 'filter' })) : [{ label: 'No filters or slicers are affecting this visual', disabled: true }]);
    }}><I n="filter" s={14} /></button>
    <button title="Focus mode" onClick={() => s.setUI({ focus: s.ui.focus === v.id ? null : v.id })}><I n="focus" s={14} /></button>
    <button title="More options" onClick={more}><I n="more" s={14} /></button>
  </div>;
}

function Frame({ v, page, scale, editInteractions }: { v: Visual; page: Page; scale: number; editInteractions: string | null }) {
  const s = store;
  const sel = s.ui.selected.includes(v.id);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number; dw: number; dh: number } | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const snap = (x: number) => s.ui.snap ? Math.round(x / 8) * 8 : Math.round(x);
  const start = (e: React.MouseEvent, mode: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (mode === 'move' && (e.target as HTMLElement).closest('input,textarea,button,.slicer-list,select,a')) { if (!sel) s.setUI({ selected: [v.id] }); return; }
    if (s.ui.painter && !sel) { const fmtCopy = s.ui.painter; s.updateVisual(v.id, x => { const keep = { title: x.format?.title, expanded: x.format?.expanded, cf: x.format?.cf }; x.format = { ...JSON.parse(JSON.stringify(fmtCopy)), ...keep }; }); s.setUI({ painter: null, selected: [v.id] }); s.toast('Formatting applied'); return; }
    const additive = e.ctrlKey || e.shiftKey;
    if (!sel || additive) s.setUI({ selected: additive ? (sel ? s.ui.selected.filter(x => x !== v.id) : [...s.ui.selected, v.id]) : [v.id] });
    if (s.ui.focus === 'reading') return;
    const sx = e.clientX, sy = e.clientY; let moved = false; let last = { dx: 0, dy: 0, dw: 0, dh: 0 };
    const mv = (ev: MouseEvent) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      const d = { dx: 0, dy: 0, dw: 0, dh: 0 };
      if (mode === 'move') { d.dx = dx; d.dy = dy; }
      if (mode.includes('e')) d.dw = dx; if (mode.includes('s')) d.dh = dy;
      if (mode.includes('w')) { d.dx = dx; d.dw = -dx; } if (mode.includes('n')) { d.dy = dy; d.dh = -dy; }
      last = d; setDrag(d);
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      setDrag(null);
      if (!moved) return;
      const ids = mode === 'move' && s.ui.selected.includes(v.id) ? s.ui.selected : [v.id];
      s.change(p => { for (const pg of p.report.pages) for (const x of pg.visuals) if (ids.includes(x.id)) {
        x.x = Math.max(0, Math.min(PAGE_W - 20, snap(x.x + last.dx))); x.y = Math.max(0, Math.min(PAGE_H - 20, snap(x.y + last.dy)));
        x.w = Math.max(40, snap(x.w + last.dw)); x.h = Math.max(30, snap(x.h + last.dh));
      } });
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  const d = drag ?? { dx: 0, dy: 0, dw: 0, dh: 0 };
  const showTitle = v.format?.titleOn ?? !['textbox', 'button', 'shape', 'image', 'slicer', 'card', 'cardNew'].includes(v.type);
  const autoTitle = (() => {
    const vals = (v.wells.values ?? v.wells.columns?.filter(f => isValueField(s.project.model, f)) ?? []).map(f => fieldLabel(f));
    const by = (v.wells.axis ?? v.wells.rows ?? v.wells.details ?? []).map(f => fieldLabel(f));
    const leg = v.wells.legend?.map(f => fieldLabel(f)) ?? [];
    if (v.type === 'table') return (v.wells.columns ?? []).map(f => fieldLabel(f)).join(', ');
    return [vals.join(' and '), [...by, ...leg].length ? 'by ' + [...by, ...leg].join(' and ') : ''].filter(Boolean).join(' ');
  })();
  const drillLabel = (() => { const dw = drillWell(v); const lv = vdef(v.type).wells.some(w => w.key === dw) ? drillLevels(s, v, dw) : null; return lv && lv.canDrill && lv.level > 0 && !v.drill?.expandAll ? ` (${(v.drill?.path ?? []).slice(0, lv.level).map(x => (x instanceof Date ? x.toLocaleDateString() : String(x))).join(' › ')})` : ''; })();
  const ei = editInteractions && editInteractions !== v.id ? page.visuals.find(x => x.id === editInteractions) : null;
  const cur = ei ? interactionFor(page, ei, v) : null;
  const setI = (t: 'filter' | 'highlight' | 'none') => s.change(p => { const pg = p.report.pages.find(x => x.id === page.id)!; pg.interactions = { ...(pg.interactions ?? {}), [`${ei!.id}>${v.id}`]: t }; });
  if (v.hidden && s.ui.focus === 'reading') return null;
  const bg = v.format?.background === false ? 'transparent' : v.format?.bgColor ?? (['shape', 'image', 'textbox', 'button'].includes(v.type) ? 'transparent' : '#fff');
  return <div ref={ref} className={`vis ${sel ? 'sel' : ''} ${v.hidden ? 'hidden-v' : ''}`}
    style={{ left: v.x + d.dx, top: v.y + d.dy, width: v.w + d.dw, height: v.h + d.dh, zIndex: (v.z ?? 0) + (sel ? 1000 : 0), background: bg, borderColor: dropOver ? '#0f6cbd' : v.format?.border ? v.format.borderColor ?? '#605e5c' : undefined, borderRadius: v.format?.radius ?? 0, boxShadow: v.format?.shadow ? '0 2px 8px rgba(0,0,0,.18)' : undefined }}
    onMouseDown={e => start(e, 'move')}
    onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field')) { e.preventDefault(); setDropOver(true); } }}
    onDragLeave={() => setDropOver(false)}
    onDrop={e => { setDropOver(false); const raw = e.dataTransfer.getData('application/x-field'); if (!raw) return; e.preventDefault(); e.stopPropagation(); addFieldToVisual(v.id, JSON.parse(raw)); }}
    onContextMenu={e => { if (e.defaultPrevented) return; menuAt(e, [{ label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', onClick: () => { s.setUI({ selected: [v.id] }); copyVisuals(); } }, { label: 'Duplicate', icon: 'copy', onClick: () => { s.setUI({ selected: [v.id] }); copyVisuals(); pasteVisuals(); } }, { label: 'Bring to front', onClick: () => s.updateVisual(v.id, x => { x.z = Math.max(0, ...page.visuals.map(y => y.z ?? 0)) + 1; }) }, { label: 'Send to back', onClick: () => s.updateVisual(v.id, x => { x.z = Math.min(0, ...page.visuals.map(y => y.z ?? 0)) - 1; }) }, { sep: true }, { label: v.hidden ? 'Show' : 'Hide', icon: v.hidden ? 'eye' : 'eyeOff', onClick: () => s.updateVisual(v.id, x => { x.hidden = !x.hidden; }) }, { label: 'Remove', icon: 'trash', shortcut: 'Del', onClick: () => { s.setUI({ selected: [v.id] }); deleteSelected(); } }]); }}>
    {s.ui.focus !== 'reading' && <VisualHeader v={v} page={page} />}
    {showTitle && <div className="vis-title" style={{ fontSize: v.format?.titleSize ?? 14, textAlign: v.format?.titleAlign ?? 'left', color: v.format?.titleColor, fontWeight: v.format?.titleBold ? 600 : undefined }}>{(v.format?.title ?? v.title) || autoTitle}{drillLabel}</div>}
    <div className="vis-body"><VisualBody v={v} page={page} /></div>
    {ei && <div className="interact" onMouseDown={e => e.stopPropagation()}>
      {(['filter', 'highlight', 'none'] as const).filter(t => t !== 'highlight' || !['table', 'card', 'matrix', 'slicer', 'kpi', 'gauge', 'line', 'area', 'multiRowCard'].includes(v.type)).map(t =>
        <button key={t} className={cur === t ? 'on' : ''} title={t === 'filter' ? 'Filter' : t === 'highlight' ? 'Highlight' : 'None'} onClick={() => setI(t)}><I n={t === 'filter' ? 'filter' : t === 'highlight' ? 'v_clusteredColumn' : 'cancel'} s={14} /></button>)}
    </div>}
    {sel && s.ui.selected.length === 1 && s.ui.focus !== 'reading' && ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => {
      const pos: React.CSSProperties = {};
      if (h.includes('n')) pos.top = -5; if (h.includes('s')) pos.bottom = -5; if (h.includes('w')) pos.left = -5; if (h.includes('e')) pos.right = -5;
      if (h === 'n' || h === 's') pos.left = 'calc(50% - 4px)'; if (h === 'e' || h === 'w') pos.top = 'calc(50% - 4px)';
      return <div key={h} className="handle" style={{ ...pos, cursor: `${h}-resize` }} onMouseDown={e => start(e, h)} />;
    })}
  </div>;
}

export function Canvas() {
  const s = useStore();
  const page = s.page();
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1000, h: 600 });
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const fit = Math.max(0.2, Math.min((box.w - 48) / PAGE_W, (box.h - 48) / PAGE_H));
  const scale = s.ui.zoom ? s.ui.zoom / 100 : fit;
  const editI = s.ui.editInteractions && s.ui.selected.length === 1 ? s.ui.selected[0] : null;
  const focus = s.ui.focus && s.ui.focus !== 'reading' ? page.visuals.find(v => v.id === s.ui.focus) : null;
  if (focus) {
    return <div className="canvas-wrap" ref={wrap} style={{ background: '#fff' }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e1dfdd' }}>
        <button className="btn sm" onClick={() => s.setUI({ focus: null })}>← Back to report</button>
        <b>{vdef(focus.type).name}</b>
      </div>
      <div style={{ position: 'absolute', inset: '44px 16px 16px' }}><div className="vis" style={{ position: 'absolute', inset: 0 }}><div className="vis-body"><VisualBody v={focus} page={page} /></div></div></div>
    </div>;
  }
  const visuals = [...page.visuals].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  return <div className="canvas-wrap" ref={wrap} onMouseDown={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-inner')) s.setUI({ selected: [], cross: null }); }}>
    <div className="canvas-inner" style={{ width: PAGE_W * scale + 48, height: PAGE_H * scale + 48, padding: 24, boxSizing: 'border-box' }}>
      <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, position: 'relative' }}>
        <div className={`page ${s.ui.gridlines ? 'grid' : ''}`} style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, background: page.background ?? '#fff' }}
          onMouseDown={e => { if (e.target === e.currentTarget) s.setUI({ selected: [], cross: null }); }}
          onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field')) e.preventDefault(); }}
          onDrop={e => {
            const raw = e.dataTransfer.getData('application/x-field'); if (!raw) return; e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            newVisualAt(JSON.parse(raw), (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
          }}>
          {visuals.map(v => <Frame key={v.id} v={v} page={page} scale={scale} editInteractions={editI} />)}
          {!page.visuals.length && <EmptyPage />}
          {page.drillthrough?.length && s.ui.drillthrough && <div style={{ position: 'absolute', left: 8, bottom: 8, fontSize: 11, color: '#605e5c', background: '#fff8db', padding: '2px 8px', borderRadius: 3 }}>Drilled through: {s.ui.drillthrough.filters.map(f => `${fieldLabel(f.field)} = ${fmt(f.value, formatFor(s.project.model, f.field), f.field)}`).join(', ')}</div>}
        </div>
      </div>
    </div>
  </div>;
}

function EmptyPage() {
  const s = store;
  const hasData = s.project.model.tables.length > 0;
  if (hasData) return <div className="empty-canvas" style={{ pointerEvents: 'none' }}><h2>Build visuals with your data</h2><div>Select or drag fields from the <b>Data</b> pane onto the report canvas.</div></div>;
  return <div className="empty-canvas">
    <h2>Add data to your report</h2>
    <div>Once loaded, your data will appear in the <b>Data</b> pane.</div>
    <div className="cards">
      <button onClick={() => s.openDialog({ type: 'getData', kind: 'excel' })}><I n="excel" s={32} />Import data from Excel</button>
      <button onClick={() => s.openDialog({ type: 'getData', kind: 'sql' })}><I n="sql" s={32} />Import data from SQL Server</button>
      <button onClick={() => s.openDialog({ type: 'enterData' })}><I n="enterdata" s={32} />Paste data into a blank table</button>
      <button onClick={() => s.openDialog({ type: 'sampleData' })}><I n="sample" s={32} />Use sample data</button>
    </div>
    <button className="btn" onClick={() => s.openDialog({ type: 'getData' })}>Get data from another source →</button>
    <button className="btn yellow" onClick={() => s.setUI({ showTutorials: true })}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="grad" s={16} /> Open PL-300 tutorials</span></button>
  </div>;
}

export function PageTabs() {
  const s = useStore();
  const [edit, setEdit] = useState<string | null>(null);
  const pages = s.project.report.pages;
  const menu = (e: React.MouseEvent, p: Page) => menuAt(e, [
    { label: 'Rename page', icon: 'edit', onClick: () => setEdit(p.id) },
    { label: 'Duplicate page', icon: 'copy', onClick: () => s.change(pr => { const c: Page = JSON.parse(JSON.stringify(p)); c.id = uid('pg'); c.name = `Duplicate of ${p.name}`; const ids = new Map<string, string>(); c.visuals.forEach(v => { const n = uid('v'); ids.set(v.id, n); v.id = n; }); pr.report.pages.splice(pr.report.pages.indexOf(pr.report.pages.find(x => x.id === p.id)!) + 1, 0, c); }) },
    { label: p.hidden ? 'Show page' : 'Hide page', icon: p.hidden ? 'eye' : 'eyeOff', onClick: () => s.change(pr => { pr.report.pages.find(x => x.id === p.id)!.hidden = !p.hidden; }) },
    { label: 'Delete page', icon: 'trash', disabled: pages.length < 2, onClick: () => s.change(pr => { pr.report.pages = pr.report.pages.filter(x => x.id !== p.id); if (s.ui.pageId === p.id) s.ui.pageId = pr.report.pages[0].id; }) },
  ]);
  return <div className="pagetabs">
    <button className="iconbtn" title="Previous page" onClick={() => { const i = pages.findIndex(p => p.id === s.ui.pageId); if (i > 0) s.setUI({ pageId: pages[i - 1].id, selected: [] }); }}><I n="chevronLeft" s={14} /></button>
    <button className="iconbtn" title="Next page" onClick={() => { const i = pages.findIndex(p => p.id === s.ui.pageId); if (i < pages.length - 1) s.setUI({ pageId: pages[i + 1].id, selected: [] }); }}><I n="chevronRight" s={14} /></button>
    {pages.map(p => edit === p.id
      ? <input key={p.id} autoFocus defaultValue={p.name} onBlur={e => { const n = e.target.value.trim(); setEdit(null); if (n) s.change(pr => { pr.report.pages.find(x => x.id === p.id)!.name = n; }); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(null); }} />
      : <button key={p.id} className={`ptab ${p.id === s.ui.pageId ? 'active' : ''} ${p.hidden ? 'hiddenp' : ''}`} onClick={() => s.setUI({ pageId: p.id, selected: [], cross: null })} onDoubleClick={() => setEdit(p.id)} onContextMenu={e => menu(e, p)}>
        {p.hidden && <I n="eyeOff" s={12} style={{ marginRight: 4 }} />}{p.name}{p.isTooltip ? ' (tooltip)' : ''}
      </button>)}
    <button className="iconbtn" title="New page" onClick={() => s.change(pr => { const n: Page = { id: uid('pg'), name: `Page ${pr.report.pages.length + 1}`, visuals: [], filters: [] }; pr.report.pages.push(n); s.ui.pageId = n.id; })}><I n="plus" s={14} /></button>
  </div>;
}

export { PAGE_W, PAGE_H, VISUALS };
