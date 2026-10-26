// Copilot pane (simulated): needs a workspace on Fabric F2+ / Premium capacity and the tenant setting. It can
// suggest content, create a report page, summarize the page, describe the semantic model, answer questions,
// and add a narrative visual. The responses are built from the model and data (no AI service is called).
import React, { useState } from 'react';
import { useStore, store, uid } from '../store';
import { I } from './icons';
import { svc, roleIn, atLeast, Workspace } from '../service/model';
import { summarize, visualContext, fmt, formatFor, fieldLabel, sortRows } from '../report/query';
import { FieldRef, Visual, Page } from '../model/types';
import { clearQueryCache } from './report/vhelpers';

const COPILOT_CAPACITY = ['Fabric F2', 'Fabric F64', 'Premium'];

interface Msg { who: 'me' | 'copilot'; text: string; action?: () => void; actionLabel?: string }

function dims() {
  const m = store.project.model;
  return m.tables.filter(t => !t.hidden && !t.calculationGroup && !t.fieldParameter).flatMap(t => t.columns.filter(c => !c.hidden && c.dataType === 'text').map(c => ({ table: t.name, column: c.name, n: new Set(t.rows.map(r => r[t.columns.indexOf(c)])).size }))).filter(x => x.n >= 2 && x.n <= 30);
}
function dateField(): FieldRef | null {
  const m = store.project.model;
  const dt = m.tables.find(t => t.dateColumn);
  if (dt) { const ym = dt.columns.find(c => /year ?month/i.test(c.name)) ?? dt.columns.find(c => /^month$/i.test(c.name)); return ym ? { table: dt.name, column: ym.name } : { table: dt.name, column: dt.dateColumn! }; }
  return null;
}
function mentioned(prompt: string) {
  const m = store.project.model; const p = prompt.toLowerCase();
  const meas = m.measures.filter(x => !x.hidden && p.includes(x.name.toLowerCase()));
  const ds = dims().filter(d => p.includes(d.column.toLowerCase()));
  return { meas: meas.length ? meas : m.measures.filter(x => !x.hidden).slice(0, 3), ds: ds.length ? ds : dims().slice(0, 2) };
}

function createPage(prompt: string): string {
  const { meas, ds } = mentioned(prompt);
  if (!meas.length) return 'This model has no measures. Copilot works best with explicit measures and clear names; create some measures first.';
  const vis: Visual[] = [];
  const mk = (v: Partial<Visual>): Visual => ({ id: uid('v'), type: 'card', x: 0, y: 0, w: 300, h: 120, wells: {}, filters: [], format: {}, ...v });
  meas.slice(0, 4).forEach((x, i) => vis.push(mk({ type: 'card', x: 20 + i * 310, y: 16, w: 300, h: 110, wells: { values: [{ table: x.table, measure: x.name }] } })));
  const df = dateField();
  if (df) vis.push(mk({ type: 'line', x: 20, y: 140, w: 610, h: 270, wells: { axis: [df], values: [{ table: meas[0].table, measure: meas[0].name }] } }));
  if (ds[0]) vis.push(mk({ type: 'clusteredBar', x: df ? 650 : 20, y: 140, w: df ? 610 : 1240, h: 270, wells: { axis: [{ table: ds[0].table, column: ds[0].column }], values: [{ table: meas[0].table, measure: meas[0].name }] } }));
  if (ds[1]) vis.push(mk({ type: 'table', x: 20, y: 424, w: 610, h: 280, wells: { columns: [{ table: ds[1].table, column: ds[1].column }, ...meas.slice(0, 3).map(x => ({ table: x.table, measure: x.name }))] } }));
  vis.push(mk({ type: 'smartNarrative', x: 650, y: 424, w: 610, h: 280, format: { title: 'Summary (Copilot)', titleOn: true } }));
  const name = prompt.replace(/^(create|make|build)( a)?( report)? page( that)?( shows?)?/i, '').trim().slice(0, 40) || 'Copilot page';
  const page: Page = { id: uid('pg'), name: name[0].toUpperCase() + name.slice(1), visuals: vis, filters: [] };
  store.change(p => { p.report.pages.push(page); });
  store.setUI({ pageId: page.id, selected: [] }); clearQueryCache();
  return `I created the page "${page.name}" with ${vis.length} visuals: cards for ${meas.slice(0, 4).map(x => x.name).join(', ')}${df ? `, a trend over ${df.column}` : ''}${ds[0] ? `, ${meas[0].name} by ${ds[0].column}` : ''}${ds[1] ? `, a table by ${ds[1].column}` : ''} and a narrative. Review it: Copilot output can be inaccurate, and you can edit or delete anything it creates.`;
}

function summarizePage(): string {
  const s = store; const page = s.page(); const m = s.project.model;
  const out: string[] = [];
  for (const v of page.visuals) {
    const axis = v.wells.axis?.[0]; const val = v.wells.values?.[0];
    try {
      if ((v.type === 'card' || v.type === 'cardNew') && val) { const r = summarize(s, [], [val], visualContext(s, page, v)).rows[0]; out.push(`${fieldLabel(val)} is ${fmt(r?.[0], formatFor(m, val), val)}.`); continue; }
      if (!axis || !val) continue;
      const a = { ...axis, datePart: undefined };
      const rows = sortRows(s, summarize(s, [a], [val], visualContext(s, page, v)).rows.filter(r => typeof r[1] === 'number'), [a]);
      if (rows.length < 2) continue;
      const top = [...rows].sort((x, y) => y[1] - x[1])[0];
      const isTime = /date|month|year|quarter/i.test(a.column ?? '');
      out.push(isTime ? `${fieldLabel(val)} went from ${fmt(rows[0][1], formatFor(m, val), val)} in ${fmt(rows[0][0], formatFor(m, a), a)} to ${fmt(rows[rows.length - 1][1], formatFor(m, val), val)} in ${fmt(rows[rows.length - 1][0], formatFor(m, a), a)}, peaking in ${fmt(top[0], formatFor(m, a), a)}.` : `${fmt(top[0], formatFor(m, a), a)} leads ${fieldLabel(a)} with ${fmt(top[1], formatFor(m, val), val)} of ${fieldLabel(val)}.`);
    } catch { /* skip visuals that can't be evaluated */ }
  }
  return out.length ? `Here's a summary of "${page.name}":\n• ${out.join('\n• ')}` : 'There are no visuals with data on this page to summarize.';
}

function describeModel(): string {
  const m = store.project.model;
  const facts = m.tables.filter(t => m.relationships.some(r => r.fromTable === t.name));
  return `The semantic model has ${m.tables.length} tables, ${m.relationships.length} relationships and ${m.measures.length} measures. ${facts.length ? `Fact table${facts.length > 1 ? 's' : ''}: ${facts.map(t => `${t.name} (${t.rows.length.toLocaleString()} rows)`).join(', ')}. ` : ''}Dimensions: ${m.tables.filter(t => !facts.includes(t) && !t.expression).map(t => t.name).join(', ') || 'none'}${m.tables.some(t => t.dateColumn) ? '; there is a marked date table' : ''}. Key measures: ${m.measures.slice(0, 6).map(x => x.name).join(', ') || 'none'}.${m.roles.length ? ` Row-level security roles: ${m.roles.map(r => r.name).join(', ')}.` : ''} Tip: add descriptions and synonyms to tables, columns and measures so Copilot understands them better.`;
}

function suggest(): Msg[] {
  const { meas, ds } = mentioned('');
  const df = dateField();
  const ideas = [
    meas[0] && ds[0] ? `${meas[0].name} by ${ds[0].column}` : null,
    meas[0] && df ? `${meas[0].name} trends over time` : null,
    meas[1] && ds[1] ? `${meas[1].name} and ${meas[0]?.name} by ${ds[1].column}` : null,
  ].filter(Boolean) as string[];
  return ideas.map(t => ({ who: 'copilot', text: `Suggested page: ${t}`, actionLabel: 'Create', action: () => createPage(t) }));
}

export function CopilotPane() {
  const s = useStore();
  const tenantOk = svc.get().tenant.copilot;
  const wss = svc.get().workspaces.filter(w => !w.personal && atLeast(roleIn(w, svc.get().me), 'Contributor'));
  const [wsId, setWsId] = useState<string>(() => (wss.find(w => COPILOT_CAPACITY.includes(w.license))?.id ?? ''));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const w: Workspace | undefined = wss.find(x => x.id === wsId);
  const ready = tenantOk && !!w && COPILOT_CAPACITY.includes(w.license);
  const say = (me: string, reply: string | Msg[]) => setMsgs(m => [...m, { who: 'me', text: me }, ...(typeof reply === 'string' ? [{ who: 'copilot' as const, text: reply }] : reply)]);
  const ask = (text: string) => {
    const t = text.toLowerCase();
    if (/create|make|build/.test(t) && /page/.test(t)) say(text, createPage(text));
    else if (/summar/.test(t) && /model|semantic/.test(t)) say(text, describeModel());
    else if (/summar|narrative/.test(t)) say(text, summarizePage());
    else if (/suggest/.test(t)) say(text, suggest());
    else if (/describe|what.*(model|tables)/.test(t)) say(text, describeModel());
    else { const { meas, ds } = mentioned(text); say(text, meas[0] ? (() => { const page = s.page(); const v: Visual = { id: 'x', type: 'table', x: 0, y: 0, w: 0, h: 0, wells: {}, filters: [], format: {} }; const f: FieldRef = { table: meas[0].table, measure: meas[0].name }; const g = ds[0] && /by|per|each/.test(t) ? [{ table: ds[0].table, column: ds[0].column }] : []; const r = summarize(s, g, [f], visualContext(s, page, v)); return g.length ? `${meas[0].name} by ${ds[0].column}: ${sortRows(s, r.rows, g).map(x => `${x[0]} ${fmt(x[1], formatFor(s.project.model, f), f)}`).join('; ')}.` : `${meas[0].name} is ${fmt(r.rows[0]?.[0], formatFor(s.project.model, f), f)} with the current filters.`; })() : 'I couldn\'t match that to the model. Mention a measure or column by name.'); }
    setQ('');
  };
  return <div className="pane copilot" style={{ width: 300 }}>
    <div className="pane-h"><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="chat" s={15} />Copilot</span><button className="iconbtn" onClick={() => s.setUI({ copilot: false } as any)} aria-label="Close Copilot"><I n="close" s={12} /></button></div>
    <div className="pane-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!tenantOk && <div className="warnbox tiny">Copilot is turned off in the Admin portal (tenant settings).</div>}
      <div className="field"><label className="tiny">Copilot workspace (needs Fabric F2+ or Premium capacity)</label>
        <select className="tx" value={wsId} onChange={e => setWsId(e.target.value)}><option value="">Select a workspace…</option>{wss.map(x => <option key={x.id} value={x.id}>{x.name} ({x.license})</option>)}</select></div>
      {w && !COPILOT_CAPACITY.includes(w.license) && <div className="warnbox tiny">{w.name} uses the {w.license} license mode. Copilot needs a workspace on paid Fabric capacity (F2 or larger) or Premium (P1+). Pro and PPU workspaces don't qualify.</div>}
      {ready && <>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {['Suggest content for a new report page', 'Create a page that shows', 'Summarize visuals on this page', 'Summarize the semantic model'].map(x => <button key={x} className="chip" onClick={() => (x.endsWith('shows') ? setQ(x + ' ') : ask(x))}>{x}</button>)}
          <button className="chip" onClick={() => { store.change(p => { const pg = p.report.pages.find(x => x.id === s.ui.pageId)!; pg.visuals.push({ id: uid('v'), type: 'smartNarrative', x: 20, y: 20, w: 420, h: 220, wells: {}, filters: [], format: { title: 'Narrative (Copilot)', titleOn: true } }); }); setMsgs(m => [...m, { who: 'copilot', text: 'I added a narrative visual. It summarizes the other visuals on the page and updates when people filter.' }]); }}>Add a narrative visual</button>
        </div>
        <div className="copilot-log">{msgs.map((m, i) => <div key={i} className={`cmsg ${m.who}`}>{m.text}{m.action && <div><button className="btn sm" onClick={() => { const r = (m.action as any)(); if (typeof r === 'string') setMsgs(x => [...x, { who: 'copilot', text: r }]); }}>{m.actionLabel}</button></div>}</div>)}</div>
        <form onSubmit={e => { e.preventDefault(); if (q.trim()) ask(q.trim()); }} className="row"><input className="tx" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Ask Copilot about this report…" /><button className="btn sm primary">Send</button></form>
        <div className="tiny">Sandbox Copilot uses simple rules over your model. The real one uses Azure OpenAI and needs the tenant setting, a capacity workspace and, for best results, a model prepared for AI (descriptions, synonyms, verified answers).</div>
      </>}
    </div>
  </div>;
}
