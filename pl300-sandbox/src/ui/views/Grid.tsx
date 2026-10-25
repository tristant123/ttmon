// Virtualised data grid used by Table view and DAX query results.
import React, { useEffect, useRef, useState } from 'react';

export interface GridCol { name: string; num?: boolean; render?: (v: any) => string; header?: React.ReactNode; onHeader?: (e: React.MouseEvent) => void; selected?: boolean; cls?: (v: any) => string }

export function Grid({ cols, rows, rowHeight = 24, onCell }: { cols: GridCol[]; rows: any[][]; rowHeight?: number; onCell?: (r: number, c: number, e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [h, setH] = useState(600);
  useEffect(() => {
    const el = ref.current!; const ro = new ResizeObserver(() => setH(el.clientHeight)); ro.observe(el); return () => ro.disconnect();
  }, []);
  const start = Math.max(0, Math.floor(scroll / rowHeight) - 10);
  const end = Math.min(rows.length, start + Math.ceil(h / rowHeight) + 30);
  return <div className="dgrid-wrap" ref={ref} onScroll={e => setScroll((e.target as HTMLElement).scrollTop)}>
    <table className="dgrid">
      <thead><tr><th className="rn" />{cols.map((c, i) => <th key={i} className={c.selected ? 'selc' : ''} onClick={c.onHeader}>{c.header ?? <div className="colh"><span className="nm">{c.name}</span></div>}</th>)}</tr></thead>
      <tbody>
        {start > 0 && <tr style={{ height: start * rowHeight }}><td colSpan={cols.length + 1} style={{ padding: 0, border: 0 }} /></tr>}
        {rows.slice(start, end).map((r, k) => {
          const ri = start + k;
          return <tr key={ri} style={{ height: rowHeight }}>
            <td className="rn">{ri + 1}</td>
            {cols.map((c, ci) => { const v = r[ci]; const txt = c.render ? c.render(v) : v === null || v === undefined ? '' : String(v); return <td key={ci} className={`${c.num ? 'num' : ''} ${c.selected ? 'selc' : ''} ${c.cls ? c.cls(v) : ''}`} onClick={e => onCell?.(ri, ci, e)} title={txt.length > 40 ? txt : undefined}>{txt}</td>; })}
          </tr>;
        })}
        {end < rows.length && <tr style={{ height: (rows.length - end) * rowHeight }}><td colSpan={cols.length + 1} style={{ padding: 0, border: 0 }} /></tr>}
      </tbody>
    </table>
  </div>;
}
