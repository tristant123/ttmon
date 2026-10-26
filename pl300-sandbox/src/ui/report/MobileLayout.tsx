// View › Mobile layout: arrange the page's visuals on a phone canvas (portrait), as Power BI Desktop does.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { I } from '../icons';
import { Page, Visual } from '../../model/types';
import { vdef } from '../../report/visuals';
import { VisualBody } from './Canvas';

export const PHONE_W = 360;
const GRID = 10;

export function mobileHeight(page: Page) {
  return Math.max(640, ...Object.values(page.mobile ?? {}).map(p => p.y + p.h + 40));
}

/** Read-only phone rendering (used by the service's mobile view, too). */
export function PhoneCanvas({ page, edit }: { page: Page; edit?: boolean }) {
  const s = store;
  const placed = page.visuals.filter(v => page.mobile?.[v.id]);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; mode: 'move' | 'size' } | null>(null);
  const start = (e: React.MouseEvent, v: Visual, mode: 'move' | 'size') => {
    if (!edit) return;
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const mv = (ev: MouseEvent) => setDrag({ id: v.id, dx: ev.clientX - sx, dy: ev.clientY - sy, mode });
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); setDrag(null);
      const dx = Math.round((ev.clientX - sx) / GRID) * GRID, dy = Math.round((ev.clientY - sy) / GRID) * GRID;
      s.change(p => { const pg = p.report.pages.find(x => x.id === page.id)!; const r = pg.mobile![v.id];
        if (mode === 'move') { r.x = Math.max(0, Math.min(PHONE_W - r.w, r.x + dx)); r.y = Math.max(0, r.y + dy); }
        else { r.w = Math.max(60, Math.min(PHONE_W - r.x, r.w + dx)); r.h = Math.max(40, r.h + dy); } });
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };
  return <div className={`phone-canvas ${edit ? 'grid' : ''}`} style={{ width: PHONE_W, height: mobileHeight(page), background: page.background ?? '#fff' }}>
    {placed.map(v => {
      const r = page.mobile![v.id]; const d = drag?.id === v.id ? drag : null;
      const x = r.x + (d?.mode === 'move' ? d.dx : 0), y = r.y + (d?.mode === 'move' ? d.dy : 0), w = r.w + (d?.mode === 'size' ? d.dx : 0), h = r.h + (d?.mode === 'size' ? d.dy : 0);
      return <div key={v.id} className={`vis ${edit ? 'm-edit' : ''}`} style={{ left: x, top: y, width: w, height: h, cursor: edit ? 'move' : undefined }} onMouseDown={e => start(e, v, 'move')}>
        {v.format?.title && <div className="vis-title" style={{ fontSize: 12 }}>{v.format.title}</div>}
        <div className="vis-body"><VisualBody v={v} page={page} /></div>
        {edit && <><button className="iconbtn m-remove" title="Remove from the mobile layout" onMouseDown={e => e.stopPropagation()} onClick={() => s.change(p => { delete p.report.pages.find(x => x.id === page.id)!.mobile![v.id]; })}><I n="close" s={11} /></button>
          <div className="m-size" onMouseDown={e => start(e, v, 'size')} /></>}
      </div>;
    })}
    {!placed.length && <div className="empty-canvas" style={{ pointerEvents: 'none', fontSize: 12 }}><div>Drag visuals from the <b>Page visuals</b> pane onto the phone canvas.</div></div>}
  </div>;
}

export function MobileLayoutEditor() {
  const s = useStore();
  const page = s.page();
  const add = (v: Visual, y?: number) => s.change(p => {
    const pg = p.report.pages.find(x => x.id === page.id)!; pg.mobile ??= {};
    const h = Math.round(Math.min(320, Math.max(80, v.h * (PHONE_W / Math.max(v.w, 1)) * 0.9)) / GRID) * GRID;
    pg.mobile[v.id] = { x: 0, y: y ?? Math.max(0, ...Object.values(pg.mobile).map(r => r.y + r.h)), w: PHONE_W, h };
  });
  return <>
    <div className="center">
      <div className="info" style={{ borderRadius: 0, display: 'flex', gap: 10, alignItems: 'center' }}><I n="mobile" s={16} />Mobile layout: the phone version of <b>{page.name}</b>. The Power BI mobile apps use it in portrait. <button className="btn sm" onClick={() => s.setUI({ mobileLayout: false } as any)}>Back to the report</button></div>
      <div className="canvas-wrap" style={{ display: 'flex', justifyContent: 'center', overflow: 'auto', padding: 24 }}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-visual')) e.preventDefault(); }}
        onDrop={e => { const id = e.dataTransfer.getData('application/x-visual'); const v = page.visuals.find(x => x.id === id); if (!v) return; const el = (e.currentTarget as HTMLElement).querySelector('.phone-canvas')!.getBoundingClientRect(); add(v, Math.max(0, Math.round((e.clientY - el.top) / GRID) * GRID)); }}>
        <div className="phone"><PhoneCanvas page={page} edit /></div>
      </div>
    </div>
    <div className="pane" style={{ width: 250 }}>
      <div className="pane-h"><span>Page visuals</span></div>
      <div className="pane-body">
        <div className="tiny" style={{ marginBottom: 6 }}>Drag a visual onto the phone, or click it to add it at the bottom. Changes here don't affect the desktop layout, but formatting and data are shared.</div>
        {page.visuals.filter(v => v.type !== 'shape' || true).map(v => <div key={v.id} className="tree-item" draggable onDragStart={e => e.dataTransfer.setData('application/x-visual', v.id)} onClick={() => !page.mobile?.[v.id] && add(v)} style={{ paddingLeft: 6, opacity: page.mobile?.[v.id] ? 0.55 : 1 }}>
          <I n={'v_' + v.type} s={14} /><span className="nm">{v.format?.title || v.title || vdef(v.type).name}</span>{page.mobile?.[v.id] && <span className="tiny">on canvas</span>}
        </div>)}
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => page.visuals.filter(v => !page.mobile?.[v.id] && v.type !== 'shape').forEach(v => add(v))}>Add all visuals</button>
      </div>
    </div>
  </>;
}
