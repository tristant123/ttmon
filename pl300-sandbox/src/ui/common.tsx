import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { I } from './icons';
import { store } from '../store';
import type { DataType } from '../core/values';

// ---------- context menus ----------
export interface MenuItem {
  label?: string; icon?: string; onClick?: () => void; items?: MenuItem[]; disabled?: boolean; sep?: boolean; header?: string;
  checked?: boolean; shortcut?: string;
}
let menuState: { x: number; y: number; items: MenuItem[] } | null = null;
const menuListeners = new Set<() => void>();
export function showMenu(x: number, y: number, items: MenuItem[]) { menuState = { x, y, items }; menuListeners.forEach(f => f()); }
export function hideMenu() { menuState = null; menuListeners.forEach(f => f()); }
export function menuAt(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  e.preventDefault(); e.stopPropagation();
  showMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, items);
}
export function menuBelow(el: HTMLElement, items: MenuItem[]) {
  const r = el.getBoundingClientRect();
  showMenu(r.left, r.bottom + 2, items);
}

function MenuList({ x, y, items, depth = 0 }: { x: number; y: number; items: MenuItem[]; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [sub, setSub] = useState<{ i: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x, ny = y;
    if (nx + r.width > window.innerWidth - 4) nx = depth ? x - r.width - 190 : window.innerWidth - r.width - 4;
    if (ny + r.height > window.innerHeight - 4) ny = Math.max(4, window.innerHeight - r.height - 4);
    setPos({ x: Math.max(4, nx), y: ny });
  }, [x, y, depth]);
  return <>
    <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} onMouseDown={e => e.stopPropagation()} role="menu">
      {items.map((it, i) => {
        if (it.sep) return <div key={i} className="sep" />;
        if (it.header) return <div key={i} className="mh">{it.header}</div>;
        return <div key={i} role="menuitem" className={`mi ${it.disabled ? 'dis' : ''} ${sub?.i === i ? 'hl' : ''}`}
          onMouseEnter={e => { if (it.items) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setSub({ i, x: r.right - 2, y: r.top - 4 }); } else setSub(null); }}
          onClick={() => { if (it.items) return; hideMenu(); it.onClick?.(); }}>
          <span className="ic">{it.checked !== undefined ? (it.checked ? <I n="check" s={14} c="#252423" /> : null) : it.icon ? <I n={it.icon} s={16} /> : null}</span>
          <span>{it.label}</span>
          {it.shortcut && <span className="sc">{it.shortcut}</span>}
          {it.items && <span className="sc"><I n="chevronRight" s={12} /></span>}
        </div>;
      })}
    </div>
    {sub && items[sub.i]?.items && <MenuList x={sub.x} y={sub.y} items={items[sub.i].items!} depth={depth + 1} />}
  </>;
}

export function MenuHost() {
  const m = useSyncExternalStore(f => { menuListeners.add(f); return () => menuListeners.delete(f); }, () => menuState);
  useEffect(() => {
    if (!m) return;
    const close = () => hideMenu();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hideMenu(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); window.removeEventListener('blur', close); };
  }, [m]);
  if (!m) return null;
  return <MenuList x={m.x} y={m.y} items={m.items} />;
}

// ---------- dialog ----------
export function Dialog({ title, sub, width = 560, children, footer, onClose, height }: { title: React.ReactNode; sub?: React.ReactNode; width?: number | string; height?: number | string; children: React.ReactNode; footer?: React.ReactNode; onClose?: () => void }) {
  const close = onClose ?? (() => store.closeDialog());
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [close]);
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="dialog" style={{ width, height }} role="dialog" aria-modal="true">
      <div className="dialog-h"><div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
        <button className="iconbtn" onClick={close} aria-label="Close"><I n="close" /></button></div>
      <div className="dialog-b">{children}</div>
      {footer && <div className="dialog-f">{footer}</div>}
    </div>
  </div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function typeIcon(t: DataType | undefined): string {
  switch (t) {
    case 'int': case 'decimal': case 'currency': case 'percent': return 'fieldNum';
    case 'date': case 'datetime': case 'time': return 'fieldDate';
    case 'bool': return 'fieldBool';
    default: return 'fieldText';
  }
}

/** Power Query's column-header type badges. */
export function pqTypeBadge(t: DataType): string {
  return ({ text: 'ABC', int: '1²3', decimal: '1.2', currency: '$', percent: '%', bool: '✓✗', date: '📅', datetime: '📅🕑', time: '🕑', duration: '⏱', datetimezone: '🌐', any: 'ABC​123', binary: '⬚', table: '▦', record: '▤', list: '≡' } as Record<string, string>)[t] ?? 'ABC';
}
export function pqTypeLabel(t: DataType) {
  return ({ text: 'ABC', int: '123', decimal: '1.2', currency: '$', percent: '%', bool: 'T/F', date: 'DATE', datetime: 'D/T', time: 'TIME', duration: 'DUR', datetimezone: 'DTZ', any: 'ABC 123', binary: 'BIN', table: 'TBL', record: 'REC', list: 'LIST' } as Record<string, string>)[t] ?? 'ABC';
}

export function useDrag(onMove: (dx: number, dy: number, e: MouseEvent) => void, onEnd?: (e: MouseEvent) => void) {
  return (e: React.MouseEvent) => {
    const sx = e.clientX, sy = e.clientY;
    const mv = (ev: MouseEvent) => onMove(ev.clientX - sx, ev.clientY - sy, ev);
    const up = (ev: MouseEvent) => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); onEnd?.(ev); };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  };
}

export function Collapsible({ title, children, open: initial = false, right }: { title: React.ReactNode; children: React.ReactNode; open?: boolean; right?: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  return <div className="fcard">
    <div className="fcard-h" onClick={() => setOpen(!open)}><I n={open ? 'chevronDown' : 'chevronRight'} s={12} /><span style={{ flex: 1 }}>{title}</span>{right && <span onClick={e => e.stopPropagation()}>{right}</span>}</div>
    {open && <div className="fcard-b">{children}</div>}
  </div>;
}

export function download(name: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  store.toast(`Downloading ${name}. If nothing happens, your viewer blocks downloads — open the standalone app (dist/index.html) instead.`);
}

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); store.toast('Copied to clipboard'); } catch { store.toast('Copy isn\'t allowed here; select the text and press Ctrl+C.', 'error'); }
}

export function pickFiles(accept: string, multiple = true, folder = false): Promise<File[]> {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
    if (folder) (inp as any).webkitdirectory = true;
    inp.onchange = () => res(Array.from(inp.files ?? []));
    inp.click();
  });
}
