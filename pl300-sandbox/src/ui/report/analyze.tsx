// Analyze (Explain the increase/decrease, Find where this distribution is different) and scatter-chart clustering.
import React, { useMemo, useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { EChart } from './EChart';
import { Page, Visual, FieldRef, ModelTable } from '../../model/types';
import { summarize, visualContext, drillLevels, fmt, formatFor, fieldLabel, sortRows } from '../../report/query';
import { keyOf } from '../../core/values';
import { autoUnits } from '../../core/format';
import { contributions, kmeans } from '../../report/analytics';
import { clearQueryCache } from './vhelpers';

const close = () => store.closeDialog();

/** Text columns (with few distinct values) in tables that can filter the fact behind the measure. */
function candidateColumns(exclude: FieldRef[]): FieldRef[] {
  const m = store.project.model;
  const out: FieldRef[] = [];
  const used = new Set(exclude.map(f => `${f.table}|${f.column}`));
  for (const t of m.tables as ModelTable[]) {
    if (t.calculationGroup || t.hidden || t.expression && t.dateColumn) continue;
    t.columns.forEach((c, i) => {
      if (c.hidden || c.dataType !== 'text' || used.has(`${t.name}|${c.name}`)) return;
      const n = new Set(t.rows.map(r => r[i])).size;
      if (n >= 2 && n <= 40) out.push({ table: t.name, column: c.name });
    });
  }
  return out.slice(0, 24);
}

export function openAnalyze(page: Page, v: Visual, point: { field: FieldRef; value: any }[], kind: 'explain' | 'distribution') {
  store.openDialog({ type: 'analyze', pageId: page.id, visualId: v.id, point, kind });
}

export function AnalyzeDialog({ d }: { d: DialogT }) {
  const s = store; const m = s.project.model;
  const page = s.project.report.pages.find(p => p.id === d.pageId)!; const v = s.findVisual(d.visualId)!;
  const value: FieldRef | undefined = (v.wells.values ?? v.wells.y ?? [])[0];
  const axisWell = v.wells.axis ? 'axis' : v.wells.rows ? 'rows' : 'details';
  const levels = drillLevels(s, v, axisWell).shown;
  const axis = levels[0];
  const pt = d.point.find((p: any) => axis && p.field.table === axis.table && p.field.column === axis.column && p.field.datePart === axis.datePart) ?? d.point[0];
  const result = useMemo(() => {
    if (!value || !axis || !pt) return { error: 'Analyze needs a visual with a category axis and a measure.' };
    const vc = visualContext(s, page, v);
    const all = summarize(s, [axis], [value], vc);
    const order = sortRows(s, all.rows, [axis]).map(r => r[0]);
    const i = order.findIndex(x => keyOf(x) === keyOf(pt.value));
    const prev = i > 0 ? order[i - 1] : undefined;
    if (d.kind === 'explain' && prev === undefined) return { error: `"${fmt(pt.value, formatFor(m, axis), axis)}" is the first point on the axis, so there's no previous value to compare with. Try "Find where this distribution is different".` };
    const total = (x: any) => Number(all.rows.find(r => keyOf(r[0]) === keyOf(x))?.[1]) || 0;
    const cands = candidateColumns([axis, ...levels]);
    const found = cands.map(c => {
      const res = summarize(s, [axis, c], [value], vc);
      const at = (x: any) => new Map(res.rows.filter(r => keyOf(r[0]) === keyOf(x)).map(r => [fmt(r[1], formatFor(m, c), c) || '(Blank)', Number(r[2]) || 0]));
      if (d.kind === 'explain') {
        const contrib = contributions(at(prev), at(pt.value));
        const change = total(pt.value) - total(prev);
        const top = contrib[0];
        const share = change ? Math.abs(top?.delta ?? 0) / contrib.reduce((a, x) => a + Math.abs(x.delta), 0) : 0;
        return { field: c, contrib: contrib.slice(0, 8), score: share, change };
      }
      // distribution: share of each category at the point vs overall
      const here = at(pt.value); const overall = new Map(summarize(s, [c], [value], vc).rows.map(r => [fmt(r[0], formatFor(m, c), c) || '(Blank)', Number(r[1]) || 0]));
      const sh = (mm: Map<string, number>) => { const t = [...mm.values()].reduce((a, b) => a + b, 0) || 1; return new Map([...mm].map(([k, x]) => [k, x / t])); };
      const a = sh(here), b = sh(overall);
      const keys = [...new Set([...a.keys(), ...b.keys()])];
      const dist = keys.reduce((acc, k) => acc + Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0)), 0) / 2;
      return { field: c, dist: keys.map(k => ({ key: k, here: a.get(k) ?? 0, overall: b.get(k) ?? 0 })).sort((x, y) => y.here - x.here).slice(0, 8), score: dist };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
    return { found, prev, change: total(pt.value) - total(prev) };
  }, [d]);
  const label = pt ? fmt(pt.value, formatFor(m, axis ?? pt.field), axis ?? pt.field) : '';
  return <Dialog title={d.kind === 'explain' ? `Explain the ${('change' in result && (result.change ?? 0) < 0) ? 'decrease' : 'increase'}` : 'Find where this distribution is different'} sub={value ? `${fieldLabel(value)} · ${label}` : undefined} width="min(820px, 96vw)" footer={<button className="btn primary" onClick={close}>Close</button>}>
    {'error' in result ? <div className="warnbox">{result.error}</div> : <>
      {d.kind === 'explain' && <div>{fieldLabel(value!)} {result.change! >= 0 ? 'increased' : 'decreased'} by <b>{fmt(Math.abs(result.change!), formatFor(m, value!), value!)}</b> between {fmt(result.prev, formatFor(m, axis!), axis!)} and {label}. These fields explain most of the change:</div>}
      {d.kind === 'distribution' && <div>For {label}, these fields have the most different distribution of {fieldLabel(value!)} compared with all other values:</div>}
      {!result.found!.length && <div className="subtle">No column in the model explains this point. Add descriptive columns (for example category or region) to the related tables.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
        {result.found!.map((x: any) => <div key={x.field.table + x.field.column} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{fieldLabel(x.field)}</div>
          {d.kind === 'explain'
            ? <div className="tiny">{x.contrib[0].key} contributed {x.contrib[0].delta >= 0 ? '+' : '−'}{autoUnits(Math.abs(x.contrib[0].delta))} ({Math.round(x.score * 100)}% of the movement across {fieldLabel(x.field)}).</div>
            : <div className="tiny">{x.dist[0].key} is {Math.round(x.dist[0].here * 100)}% here vs {Math.round(x.dist[0].overall * 100)}% overall.</div>}
          <div style={{ height: 200, position: 'relative' }}>
            <EChart option={d.kind === 'explain' ? {
              animation: false, grid: { left: 100, right: 20, top: 10, bottom: 24 }, tooltip: { trigger: 'axis' },
              xAxis: { type: 'value', axisLabel: { formatter: (t: number) => autoUnits(t), fontSize: 10 } }, yAxis: { type: 'category', inverse: true, data: x.contrib.map((c: any) => c.key), axisLabel: { fontSize: 10, width: 90, overflow: 'truncate' } },
              series: [{ type: 'bar', data: x.contrib.map((c: any) => ({ value: c.delta, itemStyle: { color: c.delta >= 0 ? '#118dff' : '#d64554' } })) }],
            } : {
              animation: false, grid: { left: 100, right: 20, top: 24, bottom: 24 }, legend: { top: 0, textStyle: { fontSize: 10 } }, tooltip: { trigger: 'axis', valueFormatter: (t: number) => `${(t * 100).toFixed(1)}%` },
              xAxis: { type: 'value', axisLabel: { formatter: (t: number) => `${Math.round(t * 100)}%`, fontSize: 10 } }, yAxis: { type: 'category', inverse: true, data: x.dist.map((c: any) => c.key), axisLabel: { fontSize: 10, width: 90, overflow: 'truncate' } },
              series: [{ name: label, type: 'bar', data: x.dist.map((c: any) => c.here), itemStyle: { color: '#118dff' } }, { name: 'Overall', type: 'bar', data: x.dist.map((c: any) => c.overall), itemStyle: { color: '#c8c6c4' } }],
            }} />
          </div>
        </div>)}
      </div>
      <div className="tiny">Analyze uses the visual's filters and the model's relationships. In Power BI it's available from the right-click menu of a data point in bar, column and line charts (not for measures with complex filters or non-additive values).</div>
    </>}
  </Dialog>;
}

/** Scatter chart › More options › Automatically find clusters. */
export function ClustersDialog({ d }: { d: DialogT }) {
  const s = store; const m = s.project.model;
  const page = s.project.report.pages.find(p => p.id === d.pageId)!; const v = s.findVisual(d.visualId)!;
  const det = v.wells.details?.[0];
  const [name, setName] = useState(det?.column ? `${det.column} (clusters)` : 'Clusters');
  const [desc, setDesc] = useState(det?.column ? `Clusters for ${det.column} based on ${fieldLabel(v.wells.x?.[0] ?? { table: '' })} and ${fieldLabel(v.wells.y?.[0] ?? { table: '' })}` : '');
  const [k, setK] = useState<number | ''>('');
  const ok = () => {
    if (!det?.column || !v.wells.x?.[0] || !v.wells.y?.[0]) return;
    const res = summarize(s, [det], [v.wells.x[0], v.wells.y[0]], visualContext(s, page, v));
    const pts = res.rows.filter(r => typeof r[1] === 'number' && typeof r[2] === 'number');
    const asg = kmeans(pts.map(r => [r[1], r[2]] as [number, number]), k || 0);
    const groups = new Map<number, any[]>(); asg.forEach((c, i) => { if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(pts[i][0]); });
    const lit = (x: any) => (typeof x === 'number' ? String(x) : `"${String(x).replace(/"/g, '""')}"`);
    const col = `'${det.table.replace(/'/g, "''")}'[${det.column}]`;
    const expr = `SWITCH(TRUE(),\n${[...groups.entries()].sort((a, b) => a[0] - b[0]).map(([c, vals]) => `    ${col} IN {${vals.map(lit).join(', ')}}, "Cluster${c + 1}"`).join(',\n')},\n    "(Blank)"\n)`;
    s.change(p => { const t = p.model.tables.find(x => x.name === det.table)!; t.columns = t.columns.filter(c => c.name !== name); t.columns.push({ name, dataType: 'text', expression: expr, summarizeBy: 'None', description: desc }); t.rows.forEach(r => { if (r.length < t.columns.length) r.push(null); }); }, { recalc: true });
    s.updateVisual(v.id, x => { x.wells.legend = [{ table: det.table, column: name }]; });
    clearQueryCache(); close();
    s.toast(`Created ${groups.size} clusters in the new field ${det.table}[${name}] and added it to the Legend.`);
  };
  return <Dialog title="Clusters" width={480} footer={<><button className="btn primary" disabled={!det?.column} onClick={ok}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    {!det?.column ? <div className="warnbox">Add a column to the scatter chart's Values well first; clusters group its values.</div> : <>
      <div className="field"><label>Name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field"><label>Field</label><input className="tx" value={`${det.table}[${det.column}]`} disabled /></div>
      <div className="field"><label>Description</label><textarea className="tx" rows={2} value={desc} onChange={e => setDesc(e.target.value)} /></div>
      <div className="field"><label>Number of clusters</label><input className="tx" type="number" min={1} placeholder="Auto" value={k} onChange={e => setK(e.target.value ? Math.max(1, +e.target.value) : '')} /></div>
      <div className="tiny">The clusters are saved as a new field in {det.table}. Like Power BI's clusters, they don't update when the data changes: run clustering again to refresh them.</div>
    </>}
  </Dialog>;
}

export const ANALYZE_DIALOGS = { analyze: AnalyzeDialog, clusters: ClustersDialog };
