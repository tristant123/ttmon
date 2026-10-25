// Text box, button, shape and image elements.
import React, { useState } from 'react';
import { store } from '../../store';
import { Visual, Page } from '../../model/types';
import { applyBookmark } from './bookmarks';

export function TextBox({ v }: { v: Visual }) {
  const [edit, setEdit] = useState(false);
  const f = v.format ?? {};
  const style: React.CSSProperties = { position: 'absolute', inset: 0, padding: 8, fontSize: f.fontSize ?? 14, fontWeight: f.bold ? 600 : 400, fontStyle: f.italic ? 'italic' : 'normal', color: f.fontColor ?? '#252423', textAlign: f.align ?? 'left', whiteSpace: 'pre-wrap', overflow: 'auto', outline: 0 };
  if (edit) return <textarea autoFocus defaultValue={v.text ?? ''} style={{ ...style, border: 0, resize: 'none', fontFamily: 'inherit', background: 'transparent' }}
    onBlur={e => { const t = e.target.value; setEdit(false); store.updateVisual(v.id, x => { x.text = t; }); }} onMouseDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} />;
  return <div style={style} onDoubleClick={() => setEdit(true)}>{v.text || <span style={{ color: '#8a8886' }}>Double-click to type</span>}</div>;
}

export function runButton(v: Visual, page: Page) {
  const s = store; const a = v.action;
  if (!a) return;
  if (a.type === 'page' && a.target) { s.setUI({ pageId: a.target, selected: [], cross: null }); return; }
  if (a.type === 'bookmark' && a.target) { const b = s.project.report.bookmarks.find(x => x.id === a.target); if (b) applyBookmark(b); return; }
  if (a.type === 'back') {
    const from = s.ui.drillthrough?.from;
    s.setUI({ pageId: from ?? s.project.report.pages[0].id, drillthrough: null, selected: [] });
  }
  void page;
}

export function ButtonEl({ v, page }: { v: Visual; page: Page }) {
  const f = v.format ?? {};
  const shape = v.format?.icon ?? 'blank';
  return <button title={v.action ? 'Ctrl + click to follow this button\'s action' : 'Set an Action in the Format pane'}
    style={{ position: 'absolute', inset: 0, border: `1px solid ${f.borderColor ?? '#605e5c'}`, background: f.fill ?? '#ffffff', color: f.fontColor ?? '#252423', borderRadius: f.radius ?? 4, fontSize: f.fontSize ?? 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    onClick={e => { if (e.ctrlKey || e.metaKey || store.ui.focus === 'reading') { e.stopPropagation(); runButton(v, page); } }}>
    {shape === 'back' && '←'} {shape === 'next' && '→'} {shape === 'info' && 'ⓘ'} {v.text ?? (shape === 'back' ? '' : 'Button')}
  </button>;
}

export function Shape({ v }: { v: Visual }) {
  const f = v.format ?? {};
  const kind = f.shape ?? 'rectangle';
  return <div style={{ position: 'absolute', inset: 0, background: f.fill ?? '#c7e0f4', border: `${f.borderWidth ?? 1}px solid ${f.borderColor ?? '#118dff'}`, borderRadius: kind === 'oval' ? '50%' : kind === 'rounded' ? 12 : 0 }} />;
}

export function ImageEl({ v }: { v: Visual }) {
  const src = v.format?.src;
  if (!src) return <div className="vis-empty">Choose an image in Format › Image</div>;
  return <img src={src} alt={v.format?.alt ?? ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: v.format?.fit ?? 'contain' }} />;
}
