// Chart visuals rendered with ECharts: bar/column (stacked, clustered, 100%), line, area, combo,
// ribbon, waterfall, funnel, scatter, pie, donut, treemap, gauge.
import React, { useMemo } from 'react';
import { EChart } from './EChart';
import { store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { summarize, drillLevels, sortRows, defaultSort, fmt, formatFor, fieldLabel, valueNode, QResult } from '../../report/query';
import { useQuery, colors, pathFilters, pointClick, isSelectedPoint, hoverTooltip, tooltipPageFor } from './vhelpers';
import { autoUnits } from '../../core/format';
import { keyOf, compareValues } from '../../core/values';
import { isHorizontal } from '../../report/visuals';
import { dataPointMenu } from './menus';
import { forecast, anomalies } from '../../report/analytics';

/** The next axis label after the last one (years, yyyy-mm, months, quarters, numbers). */
function nextLabel(last: string, prev?: string): string {
  let m: RegExpMatchArray | null;
  if ((m = last.match(/^(\d{4})-(\d{2})$/))) { const y = +m[1], mo = +m[2]; return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
  if (/^\d+$/.test(last) && prev !== undefined && /^\d+$/.test(prev)) return String(+last + (+last - +prev));
  if (/^\d+$/.test(last)) return String(+last + 1);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const short = months.map(x => x.slice(0, 3));
  const i = months.indexOf(last), j = short.indexOf(last);
  if (i >= 0) return months[(i + 1) % 12];
  if (j >= 0) return short[(j + 1) % 12];
  if ((m = last.match(/^Qtr (\d)$/))) return `Qtr ${(+m[1]) % 4 + 1}`;
  return `${last} +1`;
}

const axisLabel = { color: '#605e5c', fontSize: 11, fontFamily: 'Segoe UI, sans-serif' };
const splitLine = { lineStyle: { color: '#e9e9e9' } };

interface Built { cats: { key: string; vals: any[]; label: string }[]; series: { name: string; field: FieldRef; legendVal?: any; data: (number | null)[]; hl?: (number | null)[]; line?: boolean }[]; groups: FieldRef[]; legend?: FieldRef }

function buildSeries(v: Visual, res: QResult, hlRes: QResult | null, groups: FieldRef[], legend: FieldRef | undefined, values: FieldRef[], lineValues: FieldRef[]): Built {
  const ng = groups.length; const lg = legend ? 1 : 0;
  const s = store;
  const sortSpec = v.sort ? (v.sort.by === 'axis' ? { index: 0, desc: v.sort.desc } : { index: ng + lg + Math.max(0, values.findIndex((_f, i) => `value:${i}` === v.sort!.by)), desc: v.sort.desc }) : defaultSort(v.type, groups, s);
  const catKey = (r: any[]) => r.slice(0, ng).map(keyOf).join('|');
  // category order
  let rows = res.rows;
  let order: string[] = [];
  const catMap = new Map<string, any[]>();
  if (sortSpec && sortSpec.index >= ng + lg) {
    // sort categories by the total of the value across the legend
    const tot = new Map<string, number>();
    for (const r of rows) { const k = catKey(r); tot.set(k, (tot.get(k) ?? 0) + (Number(r[sortSpec.index]) || 0)); if (!catMap.has(k)) catMap.set(k, r.slice(0, ng)); }
    order = [...tot.keys()].sort((a, b) => (tot.get(b)! - tot.get(a)!) * (sortSpec.desc ? 1 : -1));
  } else {
    rows = sortRows(s, rows, [...groups, ...(legend ? [legend] : [])], sortSpec && sortSpec.index < ng ? sortSpec : undefined);
    for (const r of rows) { const k = catKey(r); if (!catMap.has(k)) { catMap.set(k, r.slice(0, ng)); order.push(k); } }
    if (sortSpec?.desc && sortSpec.index < ng) order.reverse();
  }
  const cats = order.map(k => { const vals = catMap.get(k)!; return { key: k, vals, label: vals.map((x, i) => fmt(x, formatFor(s.project.model, groups[i]), groups[i])).join(' ') || '(Blank)' }; });
  const idx = new Map(order.map((k, i) => [k, i]));
  const hlMap = new Map<string, any[]>();
  if (hlRes) for (const r of hlRes.rows) hlMap.set(catKey(r) + '§' + (legend ? keyOf(r[ng]) : ''), r);
  const series: Built['series'] = [];
  if (legend && values.length) {
    const lvals: any[] = []; const seen = new Set<string>();
    for (const r of sortRows(s, res.rows, [legend, ...groups])) { const k = keyOf(r[ng]); if (!seen.has(k)) { seen.add(k); lvals.push(r[ng]); } }
    for (const lv of lvals) {
      const data = new Array(cats.length).fill(null); const hl = hlRes ? new Array(cats.length).fill(null) : undefined;
      for (const r of res.rows) if (keyOf(r[ng]) === keyOf(lv)) { const i = idx.get(catKey(r)); if (i !== undefined) data[i] = r[ng + 1]; }
      if (hl) cats.forEach((c, i) => { const r = hlMap.get(c.key + '§' + keyOf(lv)); hl[i] = r ? r[ng + 1] : null; });
      series.push({ name: fmt(lv, formatFor(s.project.model, legend), legend) || '(Blank)', field: values[0], legendVal: lv, data, hl });
    }
  } else {
    values.forEach((f, j) => {
      const data = new Array(cats.length).fill(null); const hl = hlRes ? new Array(cats.length).fill(null) : undefined;
      for (const r of res.rows) { const i = idx.get(catKey(r)); if (i !== undefined) data[i] = r[ng + lg + j]; }
      if (hl) cats.forEach((c, i) => { const r = hlMap.get(c.key + '§'); hl[i] = r ? r[ng + lg + j] : null; });
      series.push({ name: fieldLabel(f), field: f, data, hl });
    });
  }
  lineValues.forEach((f, j) => {
    const data = new Array(cats.length).fill(null);
    for (const r of res.rows) { const i = idx.get(catKey(r)); if (i !== undefined) data[i] = r[ng + lg + values.length + j]; }
    series.push({ name: fieldLabel(f), field: f, data, line: true });
  });
  return { cats, series: series.filter(x => !x.field.hiddenInVisual), groups, legend };
}

function analyticsLines(v: Visual) {
  const a = v.format?.analytics ?? {};
  const lines: any[] = [];
  if (a.constant?.on) lines.push({ yAxis: Number(a.constant.value) || 0, name: 'Constant line', lineStyle: { color: a.constant.color ?? '#252423', type: 'dashed' }, label: { formatter: a.constant.label ? `${a.constant.label}` : '{c}' } });
  if (a.average) lines.push({ type: 'average', name: 'Average', lineStyle: { color: '#e66c37', type: 'dashed' }, label: { formatter: (p: any) => 'Avg ' + autoUnits(p.value) } });
  if (a.min) lines.push({ type: 'min', name: 'Min', lineStyle: { color: '#605e5c', type: 'dotted' }, label: { formatter: (p: any) => 'Min ' + autoUnits(p.value) } });
  if (a.max) lines.push({ type: 'max', name: 'Max', lineStyle: { color: '#605e5c', type: 'dotted' }, label: { formatter: (p: any) => 'Max ' + autoUnits(p.value) } });
  if (a.median) lines.push({ type: 'median', name: 'Median', lineStyle: { color: '#744ec2', type: 'dashed' }, label: { formatter: (p: any) => 'Median ' + autoUnits(p.value) } });
  return lines;
}

function trendData(data: (number | null)[]) {
  const pts = data.map((y, x) => [x, y]).filter(p => p[1] !== null) as number[][];
  if (pts.length < 2) return null;
  const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
  return data.map((_y, x) => a + b * x);
}

export function CartesianChart({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const lv = drillLevels(s, v, 'axis');
  const legend = v.wells.legend?.[0];
  const values = v.wells.values ?? [];
  const lineValues = v.type.startsWith('line') && v.type !== 'line' ? v.wells.lineValues ?? [] : v.type === 'line' ? v.wells.secondary ?? [] : [];
  const q = useQuery(v, page, vc => {
    const pf = pathFilters(v, 'axis');
    const groups = [...lv.shown, ...(legend ? [legend] : [])];
    const vals = [...values, ...lineValues];
    const res = summarize(s, groups, vals, vc, { extraFilters: pf });
    const hl = vc.highlight ? summarize(s, groups, vals, vc, { extraFilters: [...pf, ...vc.highlight] }) : null;
    const built = buildSeries(v, res, hl, lv.shown, legend, values, lineValues);
    // error bars from upper/lower bound measures
    const eb = v.format?.analytics?.errorBars;
    let bounds: { upper: (number | null)[]; lower: (number | null)[] } | null = null;
    if (eb?.on && eb.mode !== 'percent' && (eb.upper || eb.lower) && !legend) {
      const fs = [eb.upper, eb.lower].filter(Boolean).map((mname: string) => ({ table: m.measures.find(x => x.name === mname)?.table ?? '', measure: mname }));
      const br = summarize(s, lv.shown, fs, vc, { extraFilters: pf });
      const at = new Map(br.rows.map(r => [r.slice(0, lv.shown.length).map(keyOf).join('|'), r.slice(lv.shown.length)]));
      bounds = { upper: built.cats.map(c => (eb.upper ? at.get(c.key)?.[0] ?? null : null)), lower: built.cats.map(c => (eb.lower ? at.get(c.key)?.[eb.upper ? 1 : 0] ?? null : null)) };
    }
    return { ...built, bounds };
  });
  const option = useMemo(() => {
    if (!q.data) return null;
    const b = q.data; const pal = colors(); const f = v.format ?? {};
    const horiz = isHorizontal(v.type);
    const stacked = /stacked|ribbon/i.test(v.type) || v.type === 'lineStackedColumn';
    const pct = /100$/.test(v.type);
    const isLine = v.type === 'line'; const isArea = v.type === 'area' || v.type === 'stackedArea';
    const totals = b.cats.map((_c, i) => b.series.filter(x => !x.line).reduce((a, x) => a + (Number(x.data[i]) || 0), 0));
    const fmtVal = (val: any, field: FieldRef) => fmt(val, formatFor(m, field), field);
    const cat = { type: 'category', data: b.cats.map(c => c.label), axisLabel: { ...axisLabel, hideOverlap: true, interval: horiz ? 0 : 'auto' as any, rotate: !horiz && b.cats.length > 14 && f.rotateLabels !== false ? 35 : 0, width: horiz ? 110 : 90, overflow: 'truncate' }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#c8c6c4' } }, inverse: horiz, name: f.xTitle !== false ? b.groups.map(g => fieldLabel(g)).join(' ') : '', nameLocation: 'middle', nameGap: horiz ? 120 : (b.cats.length > 14 ? 52 : 28), nameTextStyle: { color: '#252423', fontSize: 11 } };
    const val = { type: 'value', axisLabel: { ...axisLabel, formatter: (x: number) => (pct ? Math.round(x) + '%' : autoUnits(x)) }, splitLine: f.gridlines === false ? { show: false } : splitLine, max: pct ? 100 : undefined, name: f.yTitle !== false ? [...new Set(b.series.filter(x => !x.line).map(x => fieldLabel(x.field)))].join(' and ') : '', nameLocation: 'middle', nameGap: 44, nameTextStyle: { color: '#252423', fontSize: 11 } };
    const val2 = lineValues.length ? { type: 'value', position: horiz ? 'top' : 'right', axisLabel: { ...axisLabel, formatter: (x: number) => autoUnits(x) }, splitLine: { show: false } } : null;
    const anyHl = b.series.some(x => x.hl);
    const series: any[] = [];
    b.series.forEach((ser, si) => {
      const color = f.colors?.[ser.name] ?? (b.series.length === 1 && f.defaultColor ? f.defaultColor : pal[si % pal.length]);
      const sel = (i: number) => isSelectedPoint(v, b.cats[i].vals, ser.legendVal);
      const dataOf = (arr: (number | null)[]) => arr.map((y, i) => {
        const yy = pct && y !== null ? (totals[i] ? (Number(y) / totals[i]) * 100 : 0) : y;
        const st = sel(i);
        return { value: yy, itemStyle: st === false ? { opacity: 0.35 } : undefined };
      });
      const label = { show: !!f.dataLabels, position: stacked || pct ? 'inside' : horiz ? 'right' : 'top', fontSize: 10, color: stacked ? '#fff' : '#252423', formatter: (p: any) => (p.value === null || p.value === undefined ? '' : pct ? Math.round(p.value) + '%' : autoUnits(p.value)) };
      if (ser.line || isLine || isArea) {
        series.push({
          name: ser.name, type: 'line', data: dataOf(ser.data), yAxisIndex: ser.line && val2 ? 1 : 0, smooth: false, symbol: f.markers ? 'circle' : 'none', symbolSize: 6, showSymbol: !!f.markers || b.cats.length === 1,
          connectNulls: false, lineStyle: { width: f.strokeWidth ?? 2, color: ser.line ? pal[(si + 2) % pal.length] : color }, itemStyle: { color: ser.line ? pal[(si + 2) % pal.length] : color },
          areaStyle: isArea ? { opacity: v.type === 'stackedArea' ? 0.6 : 0.35 } : undefined, stack: v.type === 'stackedArea' ? 'a' : undefined, label: { ...label, position: 'top' },
          markLine: si === 0 ? { symbol: 'none', data: analyticsLines(v) } : undefined,
        });
        if (si === 0 && v.format?.analytics?.trend) { const t = trendData(ser.data.map(x => (x === null ? null : Number(x)))); if (t) series.push({ name: 'Trend line', type: 'line', data: t, symbol: 'none', lineStyle: { type: 'dashed', color: '#605e5c', width: 1.5 }, tooltip: { show: false } }); }
        return;
      }
      const stack = stacked || pct ? 'total' : undefined;
      if (anyHl && ser.hl) {
        const hl = ser.hl.map(x => (x === null ? 0 : Number(x)));
        series.push({ name: ser.name, type: 'bar', stack: stack ?? 's' + si, data: dataOf(hl.map(x => x || null)), itemStyle: { color }, label, barMaxWidth: 60 });
        series.push({ name: ser.name + ' ', type: 'bar', stack: stack ?? 's' + si, data: ser.data.map((y, i) => ({ value: y === null ? null : Number(y) - hl[i] })), itemStyle: { color, opacity: 0.3 }, tooltip: { show: false }, legendHoverLink: false, barMaxWidth: 60 });
      } else {
        series.push({ name: ser.name, type: 'bar', stack, data: dataOf(ser.data), itemStyle: { color }, label, barMaxWidth: 60, barGap: '8%', markLine: si === 0 ? { symbol: 'none', data: analyticsLines(v).map(l => horiz ? { ...l, xAxis: l.yAxis, yAxis: undefined } : l) } : undefined });
      }
    });
    const an = f.analytics ?? {};
    const catLabels = b.cats.map(c => c.label);
    const main = b.series[0];
    // error bars: upper/lower bound measures, or ± a percentage of the value
    if (an.errorBars?.on && main && !b.legend) {
      const up = an.errorBars.mode === 'percent' ? main.data.map(y => (y === null ? null : Number(y) * (1 + (an.errorBars.pct ?? 10) / 100))) : b.bounds?.upper ?? [];
      const lo = an.errorBars.mode === 'percent' ? main.data.map(y => (y === null ? null : Number(y) * (1 - (an.errorBars.pct ?? 10) / 100))) : b.bounds?.lower ?? [];
      series.push({ name: 'Error bars', type: 'custom', z: 10, tooltip: { formatter: (p: any) => `Upper bound: <b>${autoUnits(p.value[1])}</b><br/>Lower bound: <b>${autoUnits(p.value[2])}</b>` },
        data: catLabels.map((_c, i) => [i, up[i] ?? main.data[i], lo[i] ?? main.data[i]]).filter(d => d[1] !== null || d[2] !== null),
        renderItem: (_p: any, api: any) => {
          const i = api.value(0); const hi = api.coord(horiz ? [api.value(1), i] : [i, api.value(1)]); const lw = api.coord(horiz ? [api.value(2), i] : [i, api.value(2)]);
          const w = 6; const st = { stroke: an.errorBars.color ?? '#252423', lineWidth: 1.5 };
          return { type: 'group', children: horiz
            ? [{ type: 'line', shape: { x1: hi[0], y1: hi[1], x2: lw[0], y2: lw[1] }, style: st }, { type: 'line', shape: { x1: hi[0], y1: hi[1] - w, x2: hi[0], y2: hi[1] + w }, style: st }, { type: 'line', shape: { x1: lw[0], y1: lw[1] - w, x2: lw[0], y2: lw[1] + w }, style: st }]
            : [{ type: 'line', shape: { x1: hi[0], y1: hi[1], x2: lw[0], y2: lw[1] }, style: st }, { type: 'line', shape: { x1: hi[0] - w, y1: hi[1], x2: hi[0] + w, y2: hi[1] }, style: st }, { type: 'line', shape: { x1: lw[0] - w, y1: lw[1], x2: lw[0] + w, y2: lw[1] }, style: st }] };
        } });
    }
    // anomaly detection (line charts)
    if (an.anomalies?.on && isLine && main && !b.legend) {
      const det = anomalies(main.data.map(x => (x === null ? null : Number(x))), an.anomalies.sensitivity ?? 70);
      series.push({ name: 'Expected range', type: 'line', data: det.ranges.map(r => r.low), lineStyle: { opacity: 0 }, stack: 'band', symbol: 'none', tooltip: { show: false } });
      series.push({ name: 'Expected range ', type: 'line', data: det.ranges.map(r => r.high - r.low), lineStyle: { opacity: 0 }, areaStyle: { color: '#118dff', opacity: 0.12 }, stack: 'band', symbol: 'none', tooltip: { show: false } });
      series.push({ name: 'Anomaly', type: 'scatter', symbolSize: 11, itemStyle: { color: an.anomalies.color ?? '#d64554', borderColor: '#fff', borderWidth: 1.5 }, z: 12,
        data: catLabels.map((_c, i) => { const a = det.anomalies.find(x => x.i === i); return a ? main.data[i] : null; }),
        tooltip: { formatter: (p: any) => { const a = det.anomalies.find(x => x.i === p.dataIndex)!; return `<b>Anomaly</b> at ${catLabels[p.dataIndex]}<br/>Value: <b>${autoUnits(Number(main.data[p.dataIndex]))}</b><br/>Expected range: ${autoUnits(a.low)} – ${autoUnits(a.high)}<br/><i>Right-click › Analyze to explain it</i>`; } } });
    }
    // forecast (line charts with a single series)
    let xLabels = catLabels;
    if (an.forecast?.on && isLine && main && !b.legend && b.series.length === 1) {
      const ignore = Math.max(0, an.forecast.ignoreLast ?? 0);
      const ys = main.data.slice(0, main.data.length - ignore).map(x => Number(x) || 0);
      const fc = forecast(ys, an.forecast.length ?? 6, { season: an.forecast.season || undefined, confidence: an.forecast.confidence ?? 0.95 });
      const base = ys.length;
      xLabels = [...catLabels]; for (let h = 0; h < fc.point.length; h++) if (base + h >= xLabels.length) xLabels.push(nextLabel(xLabels[xLabels.length - 1], xLabels[xLabels.length - 2]));
      const pad = (arr: number[]) => [...new Array(base - 1).fill(null), ys[base - 1], ...arr];
      series.push({ name: 'Forecast lower', type: 'line', data: pad(fc.lower), lineStyle: { opacity: 0 }, stack: 'fc', symbol: 'none', tooltip: { show: false } });
      series.push({ name: 'Confidence interval', type: 'line', data: [...new Array(base - 1).fill(null), 0, ...fc.upper.map((u, i) => u - fc.lower[i])], lineStyle: { opacity: 0 }, areaStyle: { color: '#605e5c', opacity: 0.15 }, stack: 'fc', symbol: 'none', tooltip: { show: false } });
      series.push({ name: 'Forecast', type: 'line', data: pad(fc.point), lineStyle: { type: 'dashed', color: '#252423', width: 2 }, itemStyle: { color: '#252423' }, symbol: 'none',
        tooltip: { formatter: (p: any) => { const h = p.dataIndex - base; return h >= 0 && h < fc.point.length ? `<b>Forecast</b> ${xLabels[p.dataIndex]}<br/>${autoUnits(fc.point[h])}<br/>Upper bound: ${autoUnits(fc.upper[h])}<br/>Lower bound: ${autoUnits(fc.lower[h])}${fc.season ? `<br/>Seasonality: ${fc.season} points` : ''}` : ''; } } });
      (cat as any).data = xLabels;
    }
    const showLegend = f.legend !== false && (b.series.filter(x => !x.name.endsWith(' ')).length > 1 || !!b.legend);
    return {
      animation: false, color: pal,
      grid: { left: horiz ? 130 : 56, right: val2 ? 56 : 18, top: showLegend ? 34 : 14, bottom: (b.cats.length > 14 && !horiz ? 64 : 40), containLabel: false },
      legend: showLegend ? { show: true, top: 4, left: 8, type: 'scroll', icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#605e5c' }, data: b.series.filter(x => !x.name.endsWith(' ')).map(x => x.name), formatter: (n: string) => n } : { show: false },
      tooltip: {
        show: v.format?.tooltip?.type !== 'off' && !tooltipPageFor(v), trigger: 'item', confine: true, textStyle: { fontSize: 12 },
        formatter: (p: any) => {
          const c = b.cats[p.dataIndex]; const ser = b.series.find(x => x.name === p.seriesName) ?? b.series[0];
          const raw = ser?.data[p.dataIndex];
          const lines = [...b.groups.map((g, i) => `${fieldLabel(g)}: <b>${fmt(c.vals[i], formatFor(m, g), g)}</b>`), ...(b.legend ? [`${fieldLabel(b.legend)}: <b>${ser.name}</b>`] : []), `${fieldLabel(ser.field)}: <b>${fmtVal(raw, ser.field)}</b>`];
          if (ser.hl) lines.push(`Highlighted: <b>${fmtVal(ser.hl[p.dataIndex], ser.field)}</b>`);
          if (pct) lines.push(`% of total: <b>${(p.value ?? 0).toFixed(1)}%</b>`);
          for (const t of v.wells.tooltips ?? []) lines.push(`${fieldLabel(t)}: <i>see table</i>`);
          return lines.join('<br/>');
        },
      },
      xAxis: horiz ? val : cat,
      yAxis: horiz ? [cat] : val2 ? [val, val2] : [val],
      series,
    };
  }, [q.data, v.format, v.type, v.sort]);
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data || !option) return null;
  if (!q.data.cats.length) return <NoData />;
  return <EChart option={option}
    onClick={(p, e) => {
      if (!p) { if (s.ui.cross?.visualId === v.id) s.setUI({ cross: null }); return; }
      const b = q.data!; const c = b.cats[p.dataIndex]; if (!c) return;
      const ser = b.series.find(x => x.name === p.seriesName.trimEnd());
      pointClick(page, v, 'axis', c.vals, lv.shown, b.legend && ser ? { field: b.legend, value: ser.legendVal } : undefined, e);
    }}
    onContext={(p, e) => { if (!p) return; const b = q.data!; const c = b.cats[p.dataIndex]; if (!c) return; const ser = b.series.find(x => x.name === p.seriesName.trimEnd()); dataPointMenu(e, page, v, [...lv.shown.map((g, i) => ({ field: g, value: c.vals[i] })), ...(b.legend && ser ? [{ field: b.legend, value: ser.legendVal }] : [])]); }}
    onHover={(p, e) => hoverTooltip(v, page, p, e, () => { const b = q.data!; const c = b.cats[p.dataIndex]; const ser = b.series.find(x => x.name === p.seriesName?.trimEnd()); return c ? [...lv.shown.map((g, i) => ({ field: g, value: c.vals[i] })), ...(b.legend && ser ? [{ field: b.legend, value: ser.legendVal }] : [])] : []; })} />;
}

export function PieChart({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const lv = drillLevels(s, v, 'axis');
  const val = v.wells.values?.[0];
  const det = v.wells.details?.[0];
  const q = useQuery(v, page, vc => {
    if (!val) return null;
    const pf = pathFilters(v, 'axis');
    const groups = [...lv.shown, ...(det ? [det] : [])];
    const res = summarize(s, groups, [val], vc, { extraFilters: pf });
    const hl = vc.highlight ? summarize(s, groups, [val], vc, { extraFilters: [...pf, ...vc.highlight] }) : null;
    return { res, hl, groups };
  });
  const option = useMemo(() => {
    if (!q.data) return null;
    const { res, hl, groups } = q.data; const pal = colors(); const f = v.format ?? {};
    const rows = [...res.rows].sort((a, b) => compareValues(b[groups.length], a[groups.length]));
    const hlMap = new Map(hl?.rows.map(r => [r.slice(0, groups.length).map(keyOf).join('|'), r[groups.length]]) ?? []);
    const total = rows.reduce((a, r) => a + (Number(r[groups.length]) || 0), 0);
    const data = rows.map((r, i) => {
      const name = r.slice(0, groups.length).map((x, j) => fmt(x, formatFor(m, groups[j]), groups[j])).join(' ') || '(Blank)';
      const sel = isSelectedPoint(v, r.slice(0, lv.shown.length));
      const hv = hl ? hlMap.get(r.slice(0, groups.length).map(keyOf).join('|')) : undefined;
      return { name, value: r[groups.length], raw: r, itemStyle: { color: f.colors?.[name] ?? pal[i % pal.length], opacity: sel === false || (hl && !hv) ? 0.3 : 1 } };
    });
    if (v.type === 'treemap') {
      return { animation: false, tooltip: { formatter: (p: any) => `${p.name}<br/><b>${fmt(p.value, formatFor(m, val!), val!)}</b>` },
        series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, width: '100%', height: '100%', top: 0, left: 0, label: { show: true, fontSize: 11, formatter: (p: any) => `${p.name}${f.dataLabels !== false ? '\n' + autoUnits(p.value) : ''}` }, itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 }, data }] };
    }
    if (v.type === 'funnel') {
      return { animation: false, tooltip: { formatter: (p: any) => `${p.name}<br/><b>${fmt(p.value, formatFor(m, val!), val!)}</b> (${total ? ((p.value / (rows[0][groups.length] || 1)) * 100).toFixed(1) : 0}% of first)` },
        series: [{ type: 'funnel', sort: 'descending', left: '10%', width: '80%', top: 8, bottom: 8, gap: 2, label: { show: true, position: 'inside', formatter: (p: any) => `${p.name}  ${autoUnits(p.value)}`, fontSize: 11 }, data }] };
    }
    return {
      animation: false,
      tooltip: { confine: true, formatter: (p: any) => `${groups.map(g => fieldLabel(g)).join(', ')}: <b>${p.name}</b><br/>${fieldLabel(val!)}: <b>${fmt(p.value, formatFor(m, val!), val!)}</b> (${p.percent}%)` },
      legend: f.legend !== false ? { type: 'scroll', orient: 'vertical', right: 4, top: 'middle', icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11, color: '#605e5c' } } : { show: false },
      series: [{ type: 'pie', radius: v.type === 'donut' ? ['45%', '72%'] : '72%', center: [f.legend !== false ? '40%' : '50%', '52%'], avoidLabelOverlap: true, label: { show: f.dataLabels !== false, fontSize: 10.5, color: '#605e5c', formatter: (p: any) => `${autoUnits(p.value)} (${p.percent.toFixed(1)}%)` }, labelLine: { length: 6, length2: 6 }, data }],
    };
  }, [q.data, v.format, v.type]);
  if (!val) return <NoData msg="Add a field to Values." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!option) return null;
  if (!q.data?.res.rows.length) return <NoData />;
  return <EChart option={option}
    onClick={(p, e) => { if (!p) { if (s.ui.cross?.visualId === v.id) s.setUI({ cross: null }); return; } const r = p.data.raw; pointClick(page, v, 'axis', r.slice(0, lv.shown.length), lv.shown, undefined, e); }}
    onContext={(p, e) => { if (!p) return; const r = p.data.raw; dataPointMenu(e, page, v, lv.shown.map((g, i) => ({ field: g, value: r[i] }))); }}
    onHover={(p, e) => hoverTooltip(v, page, p?.data?.raw ? p : null, e, () => lv.shown.map((g, i) => ({ field: g, value: p.data.raw[i] })))} />;
}

export function Waterfall({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const lv = drillLevels(s, v, 'axis');
  const val = v.wells.values?.[0];
  const q = useQuery(v, page, vc => {
    if (!val) return null;
    const res = summarize(s, lv.shown, [val], vc, { extraFilters: pathFilters(v, 'axis') });
    return sortRows(s, res.rows, lv.shown);
  });
  const option = useMemo(() => {
    if (!q.data || !val) return null;
    const rows = q.data; const ng = lv.shown.length;
    let run = 0; const base: number[] = [], up: (number | null)[] = [], down: (number | null)[] = [];
    for (const r of rows) { const x = Number(r[ng]) || 0; if (x >= 0) { base.push(run); up.push(x); down.push(null); } else { base.push(run + x); up.push(null); down.push(-x); } run += x; }
    const cats = [...rows.map(r => r.slice(0, ng).map((x, i) => fmt(x, formatFor(m, lv.shown[i]), lv.shown[i])).join(' ')), 'Total'];
    return { animation: false, grid: { left: 56, right: 16, top: 30, bottom: 40 }, legend: { top: 4, left: 8, icon: 'circle', itemWidth: 9, data: ['Increase', 'Decrease', 'Total'], textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const i = ps[0].dataIndex; const vv = i < rows.length ? rows[i][ng] : run; return `${cats[i]}<br/><b>${fmt(vv, formatFor(m, val), val)}</b>`; } },
      xAxis: { type: 'category', data: cats, axisLabel, axisTick: { show: false } }, yAxis: { type: 'value', axisLabel: { ...axisLabel, formatter: (x: number) => autoUnits(x) }, splitLine },
      series: [
        { type: 'bar', stack: 'w', data: [...base, 0], itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, tooltip: { show: false } },
        { name: 'Increase', type: 'bar', stack: 'w', data: [...up, null], itemStyle: { color: '#1aab40' }, label: { show: !!v.format?.dataLabels, position: 'top', formatter: (p: any) => autoUnits(p.value), fontSize: 10 } },
        { name: 'Decrease', type: 'bar', stack: 'w', data: [...down, null], itemStyle: { color: '#d64550' }, label: { show: !!v.format?.dataLabels, position: 'bottom', formatter: (p: any) => '-' + autoUnits(p.value), fontSize: 10 } },
        { name: 'Total', type: 'bar', stack: 'w', data: [...rows.map(() => null), run], itemStyle: { color: '#118dff' }, label: { show: !!v.format?.dataLabels, position: 'top', formatter: (p: any) => autoUnits(p.value), fontSize: 10 } },
      ] };
  }, [q.data, v.format]);
  if (!val) return <NoData msg="Add a field to Y-axis." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!option) return null;
  return <EChart option={option} onClick={(p, e) => { if (!p || p.dataIndex >= q.data!.length) return; pointClick(page, v, 'axis', q.data![p.dataIndex].slice(0, lv.shown.length), lv.shown, undefined, e); }} />;
}

export function Scatter({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const det = v.wells.details ?? []; const x = v.wells.x?.[0], y = v.wells.y?.[0], size = v.wells.size?.[0], legend = v.wells.legend?.[0];
  const q = useQuery(v, page, vc => {
    if (!x || !y) return null;
    const groups = [...det, ...(legend ? [legend] : [])];
    return summarize(s, groups, [x, y, ...(size ? [size] : [])], vc);
  });
  const option = useMemo(() => {
    if (!q.data || !x || !y) return null;
    const pal = colors(); const ng = det.length + (legend ? 1 : 0);
    const bySeries = new Map<string, any[]>();
    const sizes = size ? q.data.rows.map(r => Number(r[ng + 2]) || 0) : [];
    const maxS = Math.max(1, ...sizes);
    for (const r of q.data.rows) {
      const k = legend ? fmt(r[det.length], formatFor(m, legend), legend) : fieldLabel(y);
      if (!bySeries.has(k)) bySeries.set(k, []);
      bySeries.get(k)!.push({ value: [r[ng], r[ng + 1]], raw: r, symbolSize: size ? 6 + 30 * Math.sqrt((Number(r[ng + 2]) || 0) / maxS) : 9, itemStyle: { opacity: isSelectedPoint(v, r.slice(0, det.length)) === false ? 0.3 : 0.85 } });
    }
    return { animation: false, grid: { left: 60, right: 20, top: 30, bottom: 44 }, color: pal,
      legend: legend ? { top: 4, left: 8, icon: 'circle', itemWidth: 9, textStyle: { fontSize: 11 } } : { show: false },
      tooltip: { confine: true, formatter: (p: any) => { const r = p.data.raw; return [...det.map((g, i) => `${fieldLabel(g)}: <b>${fmt(r[i], formatFor(m, g), g)}</b>`), `${fieldLabel(x)}: <b>${fmt(r[ng], formatFor(m, x), x)}</b>`, `${fieldLabel(y)}: <b>${fmt(r[ng + 1], formatFor(m, y), y)}</b>`, ...(size ? [`${fieldLabel(size)}: <b>${fmt(r[ng + 2], formatFor(m, size), size)}</b>`] : [])].join('<br/>'); } },
      xAxis: { type: 'value', name: fieldLabel(x), nameLocation: 'middle', nameGap: 26, axisLabel: { ...axisLabel, formatter: (t: number) => autoUnits(t) }, splitLine, nameTextStyle: { fontSize: 11 } },
      yAxis: { type: 'value', name: fieldLabel(y), nameLocation: 'middle', nameGap: 44, axisLabel: { ...axisLabel, formatter: (t: number) => autoUnits(t) }, splitLine, nameTextStyle: { fontSize: 11 } },
      series: [...bySeries.entries()].map(([name, data]) => ({ name, type: 'scatter', data, label: { show: !!v.format?.dataLabels, formatter: (p: any) => det.length ? String(p.data.raw[0]) : '', position: 'right', fontSize: 10 } })) };
  }, [q.data, v.format]);
  if (!x || !y) return <NoData msg="Add fields to X-axis and Y-axis." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!option) return null;
  return <EChart option={option} onClick={(p, e) => { if (!p) { if (s.ui.cross?.visualId === v.id) s.setUI({ cross: null }); return; } if (det.length) pointClick(page, v, 'details', p.data.raw.slice(0, det.length), det, undefined, e); }}
    onContext={(p, e) => { if (!p?.data?.raw) return; dataPointMenu(e, page, v, det.map((g, i) => ({ field: g, value: p.data.raw[i] }))); }}
    onHover={(p, e) => hoverTooltip(v, page, p?.data?.raw ? p : null, e, () => det.map((g, i) => ({ field: g, value: p.data.raw[i] })))} />;
}

export function Gauge({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const val = v.wells.values?.[0];
  const q = useQuery(v, page, vc => {
    if (!val) return null;
    const ev = (f?: FieldRef) => (f ? s.dax.scalar(valueNode(m, f), vc.ctx) : null);
    return { value: ev(val), min: ev(v.wells.min?.[0]), max: ev(v.wells.max?.[0]), target: ev(v.wells.target?.[0]) };
  });
  const option = useMemo(() => {
    if (!q.data || !val) return null;
    const { value, min, max, target } = q.data;
    const vmin = Number(min ?? 0), vmax = Number(max ?? (Number(value) > 0 ? Number(value) * 2 : 1));
    return { animation: false, series: [{
      type: 'gauge', startAngle: 180, endAngle: 0, min: vmin, max: vmax, center: ['50%', '72%'], radius: '95%',
      progress: { show: true, width: 28, itemStyle: { color: v.format?.defaultColor ?? '#118dff' } }, axisLine: { lineStyle: { width: 28, color: [[1, '#e1dfdd']] } },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: true, distance: -50, fontSize: 10, color: '#605e5c', formatter: (x: number) => (x === vmin || x === vmax ? autoUnits(x) : '') },
      detail: { valueAnimation: false, offsetCenter: [0, '-12%'], fontSize: 22, fontWeight: 600, color: '#252423', formatter: () => fmt(value, formatFor(m, val), val) },
      title: { show: false },
      markLine: undefined,
      data: [{ value: Number(value) || 0 }],
    }, ...(target !== null && target !== undefined ? [{ type: 'gauge', startAngle: 180, endAngle: 0, min: vmin, max: vmax, center: ['50%', '72%'], radius: '95%', axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, detail: { show: false }, pointer: { show: true, length: '30%', offsetCenter: [0, '-70%'], width: 3, itemStyle: { color: '#252423' } }, data: [{ value: Number(target) }] }] : [])] };
  }, [q.data, v.format]);
  if (!val) return <NoData msg="Add a field to Value." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!option) return null;
  return <EChart option={option} />;
}

export function NoData({ msg }: { msg?: string }) { return <div className="vis-empty">{msg ?? 'No data available'}</div>; }
export function VisError({ msg }: { msg: string }) {
  return <div className="vis-err"><b>Couldn't load the data for this visual</b><div className="det">{msg}</div></div>;
}
