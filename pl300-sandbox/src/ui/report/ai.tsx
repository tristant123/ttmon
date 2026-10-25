// AI visuals: Decomposition tree, Key influencers, Q&A and Narrative (sandbox versions).
import React, { useState } from 'react';
import { store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { summarize, fmt, formatFor, fieldLabel, valueNode, valuesFilter, visualContext, defaultSort, sortRows } from '../../report/query';
import { useQuery } from './vhelpers';
import { VisError, NoData, CartesianChart, PieChart } from './charts';
import { TableVisual } from './tables';
import { Card } from './cards';
import { Filter } from '../../dax/engine';
import { autoUnits } from '../../core/format';
import { compareValues, keyOf } from '../../core/values';

type Split = { field: number; value: any };

export function DecompositionTree({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const val = v.wells.values?.[0]; const explain = v.wells.explain ?? [];
  const path: Split[] = v.drill?.path ?? [];
  const q = useQuery(v, page, vc => {
    if (!val) return null;
    const cols: { field: FieldRef; rows: any[][]; selected: any; total: number }[] = [];
    const filters: Filter[] = [];
    const total = s.dax.scalar(valueNode(m, val), vc.ctx);
    for (let i = 0; i < path.length; i++) {
      const f = explain[path[i].field]; if (!f) break;
      const res = summarize(s, [f], [val], vc, { extraFilters: filters }).rows.sort((a, b) => compareValues(b[1], a[1]));
      const ft = res.reduce((a, r) => a + (Number(r[1]) || 0), 0);
      cols.push({ field: f, rows: res, selected: path[i].value, total: ft });
      if (path[i].value === undefined) break;
      const flt = valuesFilter(s.dax, f, [path[i].value]); if (flt) filters.push(flt);
    }
    return { total, cols };
  }, JSON.stringify(path));
  if (!val) return <NoData msg="Add a measure to Analyze and fields to Explain by." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data) return null;
  const setPath = (p: Split[]) => s.updateVisual(v.id, x => { x.drill = { level: 0, path: p }; }, false);
  const used = new Set(path.map(p => p.field));
  const avail = explain.map((f, i) => ({ f, i })).filter(x => !used.has(x.i));
  const lastSelected = path.length === 0 || path[path.length - 1].value !== undefined;
  const aiSplit = (high: boolean) => {
    // pick the field whose top (or bottom) value is most extreme relative to the others
    const vc = visualContext(s, page, v);
    const filters = path.filter(p => p.value !== undefined).map(p => valuesFilter(s.dax, explain[p.field], [p.value])).filter(Boolean) as Filter[];
    let best: { i: number; score: number } | null = null;
    for (const { f, i } of avail) {
      const rows = summarize(s, [f], [val], vc, { extraFilters: filters }).rows.map(r => Number(r[1]) || 0);
      if (rows.length < 2) continue;
      const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
      const score = (high ? Math.max(...rows) : -Math.min(...rows)) / (mean || 1);
      if (!best || score > best.score) best = { i, score };
    }
    if (best) setPath([...path, { field: best.i, value: undefined }]);
  };
  const barW = 150;
  return <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', gap: 22, padding: '10px 14px', alignItems: 'flex-start' }}>
    <div style={{ minWidth: barW }}>
      <div style={{ fontSize: 11, color: '#605e5c' }}>{fieldLabel(val)}</div>
      <div style={{ fontWeight: 600, fontSize: 13, margin: '2px 0 4px' }}>{fmt(q.data.total, formatFor(m, val), val)}</div>
      <div style={{ height: 22, background: '#118dff', width: barW }} />
    </div>
    {q.data.cols.map((c, ci) => <div key={ci} style={{ minWidth: barW }}>
      <div style={{ fontSize: 11, color: '#605e5c', display: 'flex', gap: 6 }}>{fieldLabel(c.field)}<button className="iconbtn" style={{ height: 16, minWidth: 16 }} title="Remove this level" onClick={() => setPath(path.slice(0, ci))}>×</button></div>
      {c.rows.slice(0, 12).map(r => {
        const on = c.selected !== undefined && keyOf(c.selected) === keyOf(r[0]);
        const w = c.rows[0][1] ? (Number(r[1]) / Number(c.rows[0][1])) * barW : 0;
        return <div key={keyOf(r[0])} style={{ cursor: 'pointer', margin: '4px 0', opacity: c.selected === undefined || on ? 1 : 0.55 }} onClick={() => setPath([...path.slice(0, ci), { field: path[ci].field, value: r[0] }])}>
          <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{fmt(r[0], formatFor(m, c.field), c.field) || '(Blank)'}</span><b>{autoUnits(Number(r[1]) || 0)}</b></div>
          <div style={{ height: 16, background: '#e1dfdd', width: barW }}><div style={{ height: 16, width: Math.max(1, w), background: on ? '#12239e' : '#118dff' }} /></div>
        </div>;
      })}
    </div>)}
    {lastSelected && avail.length > 0 && <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 11, color: '#605e5c', marginBottom: 4 }}>Expand by</div>
      <div className="list" style={{ maxHeight: 220 }}>
        <div className="it" onClick={() => aiSplit(true)}>High value (AI split)</div>
        <div className="it" onClick={() => aiSplit(false)}>Low value (AI split)</div>
        {avail.map(x => <div key={x.i} className="it" onClick={() => setPath([...path, { field: x.i, value: undefined }])}>{fieldLabel(x.f)}</div>)}
      </div>
    </div>}
  </div>;
}

export function KeyInfluencers({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const val = v.wells.values?.[0]; const explain = v.wells.explain ?? [];
  const q = useQuery(v, page, vc => {
    if (!val || !explain.length) return null;
    const out: { field: FieldRef; value: any; ratio: number; v: number; avg: number }[] = [];
    for (const f of explain) {
      const rows = summarize(s, [f], [val], vc).rows.filter(r => typeof r[1] === 'number');
      if (rows.length < 2) continue;
      const avg = rows.reduce((a, r) => a + r[1], 0) / rows.length;
      for (const r of rows) out.push({ field: f, value: r[0], v: r[1], avg, ratio: avg ? r[1] / avg : 0 });
    }
    return out.sort((a, b) => b.ratio - a.ratio).slice(0, 8);
  });
  if (!val || !explain.length) return <NoData msg="Add a field to Analyze and fields to Explain by." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data) return null;
  const max = Math.max(...q.data.map(x => x.ratio), 1);
  return <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '8px 12px' }}>
    <div style={{ fontWeight: 600, marginBottom: 6 }}>What influences {fieldLabel(val)} to increase?</div>
    <div className="tiny" style={{ marginBottom: 8 }}>Sandbox version: compares each value's {fieldLabel(val)} with the average across that field's values.</div>
    {q.data.map((x, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f3f2f1' }}>
      <div>When <b>{fieldLabel(x.field)}</b> is <b>{fmt(x.value, formatFor(m, x.field), x.field) || '(Blank)'}</b>, the {fieldLabel(val)} is <b>{x.ratio.toFixed(2)}x</b> the average</div>
      <div style={{ height: 14, background: '#e1dfdd' }}><div style={{ width: `${(x.ratio / max) * 100}%`, height: 14, background: '#118dff' }} /></div>
    </div>)}
  </div>;
}

/** Q&A: a keyword parser that understands "<measure> by <column> [for <value>]". */
export function parseQuestion(text: string): { value?: FieldRef; by?: FieldRef; filter?: { field: FieldRef; value: any }; top?: number; type: string } | null {
  const m = store.project.model;
  const t = text.toLowerCase();
  const words = (s0: string) => s0.toLowerCase().replace(/[_\-.]/g, ' ');
  let value: FieldRef | undefined;
  for (const ms of [...m.measures].sort((a, b) => b.name.length - a.name.length)) if (t.includes(words(ms.name))) { value = { table: ms.table, measure: ms.name }; break; }
  const cols = m.tables.flatMap(tb => tb.columns.filter(c => !c.hidden).map(c => ({ tb, c }))).sort((a, b) => b.c.name.length - a.c.name.length);
  if (!value) {
    const agg = /\b(average|avg)\b/.test(t) ? 'Average' : /\b(count|number of|how many)\b/.test(t) ? 'Count' : /\b(max|maximum|highest)\b/.test(t) ? 'Max' : /\b(min|minimum|lowest)\b/.test(t) ? 'Min' : 'Sum';
    for (const { tb, c } of cols) if (['int', 'decimal', 'currency'].includes(c.dataType) && t.includes(words(c.name))) { value = { table: tb.name, column: c.name, agg }; break; }
    if (!value && agg === 'Count') { for (const tb of m.tables) if (t.includes(words(tb.name))) { value = { table: tb.name, column: tb.columns[0].name, agg: 'Count' }; break; } }
  }
  let by: FieldRef | undefined;
  const byM = /\b(?:by|per|for each|across)\s+(.+?)(?:\s+(?:for|in|where|as)\b|$)/.exec(t);
  if (byM) for (const { tb, c } of cols) if (byM[1].includes(words(c.name))) { by = { table: tb.name, column: c.name }; break; }
  let filter: { field: FieldRef; value: any } | undefined;
  const forM = /\b(?:for|in|where)\s+(.+)$/.exec(t);
  if (forM) {
    outer: for (const { tb, c } of cols) {
      if (c.dataType !== 'text') continue;
      const ci = tb.columns.indexOf(c);
      const seen = new Set<string>();
      for (const r of tb.rows) { const x = r[ci]; if (typeof x !== 'string' || seen.has(x)) continue; seen.add(x); if (x.length > 2 && forM[1].includes(x.toLowerCase())) { filter = { field: { table: tb.name, column: c.name }, value: x }; break outer; } if (seen.size > 500) break; }
    }
  }
  const top = /\btop\s+(\d+)/.exec(t);
  const type = /\bpie\b/.test(t) ? 'pie' : /\bline\b|\bover time\b|\btrend\b/.test(t) ? 'line' : /\btable\b/.test(t) ? 'table' : /\bcolumn\b/.test(t) ? 'clusteredColumn' : 'clusteredBar';
  if (!value && !by) return null;
  return { value, by, filter, top: top ? +top[1] : undefined, type };
}

export function QnA({ v, page }: { v: Visual; page: Page }) {
  const [text, setText] = useState(v.text ?? '');
  const parsed = text.trim() ? parseQuestion(text) : null;
  const sample = store.project.model.measures[0]?.name ?? 'Sales';
  const inner: Visual | null = parsed ? {
    ...v, id: v.id + '-qna', type: parsed.by ? parsed.type : 'card',
    wells: parsed.by ? { axis: [parsed.by], values: parsed.value ? [parsed.value] : [], columns: [parsed.by, ...(parsed.value ? [parsed.value] : [])] } : { values: parsed.value ? [parsed.value] : [] },
    filters: parsed.filter ? [{ id: 'qf', field: parsed.filter.field, type: 'basic', values: [parsed.filter.value] }] : [],
    format: { ...v.format, topN: parsed.top }, drill: undefined,
  } : null;
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 8, display: 'flex', gap: 6 }}>
      <input className="tx" placeholder={`Ask a question about your data, e.g. "total ${sample.toLowerCase()} by category"`} value={text}
        onChange={e => setText(e.target.value)} onBlur={() => store.updateVisual(v.id, x => { x.text = text; }, false)} onMouseDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} />
    </div>
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      {!text.trim() && <div className="vis-empty">Try: "{sample.toLowerCase()} by year", "count of orders by country as pie", "top 5 products by {sample.toLowerCase()}"</div>}
      {text.trim() && !parsed && <div className="vis-empty">Q&A couldn't match that to a field. Use the names of measures and columns, or add synonyms in Q&A setup.</div>}
      {inner && (inner.type === 'card' ? <Card v={inner} page={page} /> : inner.type === 'table' ? <TableVisual v={inner} page={page} /> : inner.type === 'pie' ? <PieChart v={inner} page={page} /> : <CartesianChart v={inner} page={page} />)}
    </div>
  </div>;
}

export function Narrative({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const q = useQuery(v, page, vc => {
    const out: string[] = [];
    for (const o of page.visuals) {
      if (o.id === v.id) continue;
      const axis = o.wells.axis?.[0]; const val = o.wells.values?.[0];
      if (!axis || !val) continue;
      const a = { ...axis, datePart: undefined };
      const rows = summarize(s, [a], [val], vc).rows.filter(r => typeof r[1] === 'number');
      if (!rows.length) continue;
      const tot = rows.reduce((x, r) => x + r[1], 0);
      const top = [...rows].sort((x, y) => y[1] - x[1])[0];
      const sorted = sortRows(s, rows, [a], defaultSort(o.type, [a], s));
      out.push(`${fieldLabel(val)} totals ${fmt(tot, formatFor(m, val), val)} across ${rows.length} ${fieldLabel(a)} values. ${fmt(top[0], formatFor(m, a), a) || '(Blank)'} is highest at ${fmt(top[1], formatFor(m, val), val)} (${((top[1] / (tot || 1)) * 100).toFixed(1)}% of the total).${sorted.length > 2 ? ` It ranges from ${autoUnits(Math.min(...rows.map(r => r[1])))} to ${autoUnits(Math.max(...rows.map(r => r[1])))}.` : ''}`);
    }
    return out;
  });
  if (q.error) return <VisError msg={q.error} />;
  return <div style={{ position: 'absolute', inset: 0, padding: 10, overflow: 'auto', fontSize: 13, lineHeight: 1.5 }}>
    {q.data?.length ? q.data.map((t, i) => <p key={i} style={{ margin: '0 0 8px' }}>{t}</p>) : <span className="subtle">Add charts with a category and a value to this page; the narrative summarizes them.</span>}
  </div>;
}
