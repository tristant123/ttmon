// Card, Card (new), Multi-row card and KPI visuals.
import React, { useMemo } from 'react';
import { store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { summarize, fmt, formatFor, fieldLabel, isValueField, valueNode, sortRows } from '../../report/query';
import { useQuery } from './vhelpers';
import { VisError, NoData } from './charts';
import { autoUnits } from '../../core/format';
import { EChart } from './EChart';

function display(v: Visual, val: any, f: FieldRef) {
  const m = store.project.model;
  const units = v.format?.displayUnits ?? 'auto';
  if (typeof val === 'number' && units !== 'none') {
    const fs = formatFor(m, f);
    const prefix = fs && /\$/.test(fs) ? '$' : '';
    const pct = fs && /%/.test(fs);
    if (pct) return fmt(val, fs, f);
    if (units === 'auto' && Math.abs(val) >= 1000) return (val < 0 ? '-' : '') + prefix + autoUnits(Math.abs(val), v.format?.decimals ?? 2).replace(/\.?0+([KMBTbn]+)$/, '$1').replace(/(\d)([KMT]|bn)$/, '$1$2');
  }
  return fmt(val, formatFor(m, f), f) || (val === null ? '(Blank)' : '');
}

export function Card({ v, page }: { v: Visual; page: Page }) {
  const s = store;
  const f = v.wells.values?.[0];
  const q = useQuery(v, page, vc => (f ? s.dax.scalar(valueNode(s.project.model, f), vc.ctx) : null));
  if (!f) return <NoData msg="Add a data field to Fields." />;
  if (q.error) return <VisError msg={q.error} />;
  const size = v.format?.calloutSize ?? Math.max(18, Math.min(45, v.h / 3.2));
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 6, textAlign: 'center' }}>
    <div style={{ fontSize: size, fontWeight: 600, color: v.format?.calloutColor ?? '#252423', fontFamily: 'Segoe UI Semibold, Segoe UI, sans-serif', lineHeight: 1.1, wordBreak: 'break-word' }}>{display(v, q.data, f)}</div>
    {v.format?.categoryLabel !== false && <div style={{ fontSize: 12, color: '#605e5c' }}>{fieldLabel(f)}</div>}
  </div>;
}

export function CardNew({ v, page }: { v: Visual; page: Page }) {
  const s = store;
  const fs = v.wells.values ?? [];
  const q = useQuery(v, page, vc => fs.map(f => s.dax.scalar(valueNode(s.project.model, f), vc.ctx)));
  if (!fs.length) return <NoData msg="Add data fields to Data." />;
  if (q.error) return <VisError msg={q.error} />;
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.min(fs.length, 4)}, 1fr)`, gap: 8, padding: 8 }}>
    {fs.map((f, i) => <div key={i} style={{ border: '1px solid #e1dfdd', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#605e5c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fieldLabel(f)}</div>
      <div style={{ fontSize: 26, fontWeight: 600 }}>{display(v, q.data?.[i], f)}</div>
    </div>)}
  </div>;
}

export function MultiRowCard({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const fs = v.wells.values ?? [];
  const groups = fs.filter(f => !isValueField(m, f)); const vals = fs.filter(f => isValueField(m, f));
  const q = useQuery(v, page, vc => sortRows(s, summarize(s, groups, vals, vc).rows, groups).slice(0, 200));
  if (!fs.length) return <NoData msg="Add data fields to Fields." />;
  if (q.error) return <VisError msg={q.error} />;
  return <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '4px 10px' }}>
    {(q.data ?? []).map((r, i) => <div key={i} style={{ borderLeft: '3px solid #118dff', padding: '6px 10px', margin: '6px 0', display: 'flex', flexWrap: 'wrap', gap: '4px 22px' }}>
      {fs.map((f, j) => { const idx = groups.includes(f) ? groups.indexOf(f) : groups.length + vals.indexOf(f); return <div key={j} style={{ minWidth: 0 }}>
        <div style={{ fontSize: j === 0 ? 18 : 15, fontWeight: 600 }}>{fmt(r[idx], formatFor(m, f), f)}</div>
        <div style={{ fontSize: 11, color: '#605e5c' }}>{fieldLabel(f)}</div></div>; })}
    </div>)}
  </div>;
}

export function KPI({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const val = v.wells.values?.[0]; const axis = v.wells.axis?.[0]; const target = v.wells.target?.[0];
  const q = useQuery(v, page, vc => {
    if (!val) return null;
    if (axis) {
      const ax = { ...axis, datePart: undefined };
      const rows = sortRows(s, summarize(s, [ax], [val, ...(target ? [target] : [])], vc).rows, [ax]);
      const last = rows[rows.length - 1];
      return { trend: rows.map(r => r[1]), labels: rows.map(r => fmt(r[0], formatFor(m, ax), ax)), value: last?.[1] ?? null, goal: target ? last?.[2] ?? null : null, label: last ? fmt(last[0], formatFor(m, ax), ax) : '' };
    }
    const value = s.dax.scalar(valueNode(m, val), vc.ctx);
    const goal = target ? s.dax.scalar(valueNode(m, target), vc.ctx) : null;
    return { trend: [], labels: [], value, goal, label: '' };
  });
  const chart = useMemo(() => q.data && q.data.trend.length > 1 ? { animation: false, grid: { left: 0, right: 0, top: 0, bottom: 0 }, xAxis: { type: 'category', show: false, data: q.data.labels, boundaryGap: false }, yAxis: { type: 'value', show: false, scale: true }, series: [{ type: 'line', data: q.data.trend, symbol: 'none', lineStyle: { width: 0 }, areaStyle: { color: q.data.goal === null || q.data.value >= q.data.goal ? 'rgba(26,171,64,.25)' : 'rgba(214,69,80,.25)' } }] } : null, [q.data]);
  if (!val) return <NoData msg="Add a field to Value." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data) return null;
  const { value, goal } = q.data;
  const good = goal === null || goal === undefined ? null : Number(value) >= Number(goal);
  const dist = goal ? ((Number(value) - Number(goal)) / Math.abs(Number(goal))) * 100 : null;
  return <div style={{ position: 'absolute', inset: 0 }}>
    {chart && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}><EChart option={chart} /></div>}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <div style={{ fontSize: Math.max(20, Math.min(40, v.h / 4)), fontWeight: 600, color: good === null ? '#252423' : good ? '#107c10' : '#a4262c' }}>
        {display(v, value, val)} {good !== null && (good ? '✓' : '!')}
      </div>
      {goal !== null && goal !== undefined && <div style={{ fontSize: 12, color: '#605e5c' }}>Goal: {display(v, goal, target!)} ({dist! >= 0 ? '+' : ''}{dist!.toFixed(2)}%)</div>}
      {q.data.label && <div style={{ fontSize: 11, color: '#8a8886' }}>{q.data.label}</div>}
    </div>
  </div>;
}
