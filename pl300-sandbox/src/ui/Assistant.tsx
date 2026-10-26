// "Ask how to practice this": paste an exam question; get the answer and step-by-step instructions to
// demonstrate it in the sandbox. Uses Claude when the page runs as a published artifact (the `sample`
// capability, on the viewer's own account); otherwise matches the question against the labs and syllabus.
import React, { useEffect, useRef, useState } from 'react';
import { useStore, store } from '../store';
import { I } from './icons';
import { TUTORIALS } from '../tutorials/content';
import { SYLLABUS, examBank } from '../tutorials/exam';
import { startTutorial } from '../tutorials/TutorialUI';
import { quickModel } from '../tutorials/scenarios';

interface Turn { role: 'user' | 'assistant'; content: string; source?: 'claude' | 'offline' }
const KEY = 'pl300-sandbox-assistant';
const load = (): Turn[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const save = (t: Turn[]) => { try { localStorage.setItem(KEY, JSON.stringify(t.slice(-30))); } catch { /* storage unavailable */ } };

/** What the sandbox can do and where, so Claude can write steps that match this app. */
function guide(): string {
  return `You are a PL-300 (Power BI Data Analyst) tutor inside "PL-300 Sandbox", a browser recreation of Power BI Desktop plus a simulated Power BI service. Help the learner understand the exam question and practice it hands-on IN THIS APP.

APP MAP (use these exact names):
Desktop: title bar has Save/Undo, "Ask", "Tutorials", "Power BI service" (switches to the simulated service). Left rail views: Report, Table, Model, DAX query. Ribbon tabs: Home (Get data, Excel workbook, SQL Server, Enter data, Sample data, Transform data ▾ [Transform data, Data source settings, Edit parameters], Refresh, New visual, Text box, More visuals, New measure, Quick measure, New visual calculation, Copilot, Sensitivity, Publish), Insert, Modeling (Manage relationships, New measure, Quick measure, New column, New table, Calculation group, New parameter ▾ [Numeric range, Fields], Manage roles, View as, Q&A setup), View (Themes, Page view, Mobile layout, Gridlines, Snap to grid, Reading view, Filters, Bookmarks, Selection, Performance analyzer, Sync slicers), Optimize, Help; contextual tabs Format, Data / Drill, Table tools, Column tools, Measure tools. Panes: Filters, Visualizations (Build / Format / Analytics tabs), Data. File › Options: Auto date/time, Report settings (Personalize visuals, Export data), Privacy. Status bar: storage mode (click to switch to Import), live connection "Make changes to this model".
Sample data: Home › Sample data has messy Contoso files (Sales.csv, Products.xlsx, Customers.json, Stores.xml, Budget 2025.csv, Employees.csv, Returns.txt, a Monthly folder) and "Load a ready-made star schema" (Sales, Product, Customer, Store, Date; measures Total Sales, Total Quantity, Order Count, Total Cost, Profit, Margin %). Home › SQL Server: localhost / ContosoDW (DimProduct, DimCustomer, DimStore, DimDate, FactSales) with Import or DirectQuery. Get data › Lakehouses: ContosoLakehouse with Direct Lake. Get data › Power BI semantic models: live connection (needs Build).
Power Query: full M engine, ribbons Home/Transform/Add Column/View, Applied Steps with folding indicators and View Native Query, Advanced Editor, column profiling, Merge (6 join kinds + fuzzy), Append, Group By, Pivot/Unpivot, parameters, functions, Reference/Duplicate, Enable load. Privacy levels prompt and Formula.Firewall errors are simulated; Data source settings has Change Source / Edit Permissions.
Model: relationships (cardinality, cross-filter, active/inactive), calculation groups (Model view › Calculation group; SELECTEDMEASURE), storage modes Import/DirectQuery/Dual/Direct Lake with limited relationships, mark as date table, hierarchies, RLS roles + View as, incremental refresh policy (Data pane table menu › Incremental refresh; needs RangeStart/RangeEnd Date/Time parameters), DAX engine ~240 functions, DAX query view.
Report: 30+ visuals, conditional formatting, bookmarks, buttons, drill through, report-page tooltips (Page information › Allow use as tooltip, Canvas settings › Tooltip, visual Format › Tooltips › Report page), sync slicers pane, edit interactions, field parameters, visual calculations (RUNNINGSUM, MOVINGAVERAGE, COLLAPSE, templates), Analytics pane (constant/average/min/max/median lines, trend, error bars, forecast, find anomalies), right-click Analyze (Explain the increase, Find where distribution is different), scatter … › Automatically find clusters, groups and bins, decomposition tree, key influencers, Q&A, narrative, mobile layout, automatic page refresh (DirectQuery only), Performance analyzer (Copy query / Run in DAX query view), export data (summarized/underlying), sensitivity labels, Copilot pane (needs a Fabric F2+/Premium workspace).
Service (title bar › Power BI service): switch user top-right (Pat Morgan Pro + Fabric admin; Alex Rivera Pro, Sales Managers; Brooke Lee Free, Sales Managers; Chris Ng PPU, Finance Analysts; Dana Ortiz Pro, Report Authors), simulated clock (+1 h/+1 day/+1 wk runs scheduled refresh, alerts, subscriptions), Inbox shows emails. Workspaces "Sales Analytics" (Fabric F64; Pat Admin, Report Authors Member, Sales Managers Viewer) with certified Contoso Sales model + report (RLS roles Store Managers dynamic USERPRINCIPALNAME and Europe), "Finance" (Pro). Features: Manage access (roles), Workspace settings (license mode, contributors can update app), Share (link settings, Reshare, Build), Manage permissions, Create/Update app with audiences, Pin visual / live page to dashboards, Manage alerts (card/KPI/gauge tiles), Subscribe, semantic model settings (Gateway and cloud connections, Refresh schedule with 8 vs 48 limit, failure notifications, Security RLS members + Test as role, Endorsement Promoted/Certified, Sensitivity label, Take over), Lineage view + impact analysis, Usage metrics, Deployment pipelines with rules, Connections and gateways (standard vs personal), Admin portal (Publish to web, export, certification, Copilot), Analyze in Excel (needs Build), Paginated report builder, Publish to web / SharePoint embed, Download .pbix, Personalize visuals, persistent filters, personal bookmarks, Phone view.
Labs (Tutorials): ${TUTORIALS.map(t => `${t.id}=${t.title}`).join('; ')}.

HOW TO ANSWER: Be accurate to current Power BI behaviour; if the exam question has a correct option, state it first with a one-line reason, and explain why the distractors are wrong in one line each. Then "Try it in the sandbox:" with 3-8 numbered steps using the exact menu names above and sample data, then "What you should see:". Keep it under 300 words. When a lab fits, add a line exactly like [[lab:ID]] (one of the IDs above). Add [[star]] to offer loading the star schema, or [[service]] to offer opening the service. If something can't be done in the sandbox, say so plainly and explain how it works in real Power BI.`;
}

const STOP = new Set('the a an of to in and or for is are you your what which should do does be with on by from that this it as at use using need needs can will power bi data report'.split(' '));
function offlineAnswer(q: string): string {
  const words = q.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2 && !STOP.has(w)) ?? [];
  const score = (text: string) => words.reduce((s, w) => s + (text.toLowerCase().includes(w) ? 1 : 0), 0);
  const labs = TUTORIALS.map(t => ({ t, s: score(`${t.title} ${t.summary} ${t.steps.map(x => x.title + ' ' + x.html).join(' ')} ${t.quiz.map(x => x.q).join(' ')}`) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2);
  const skills = SYLLABUS.map(r => ({ r, s: score(`${r.skill} ${r.where} ${r.group}`) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2);
  const qs = examBank().map(x => ({ x, s: score(`${x.stem} ${x.skill} ${(x.options ?? []).join(' ')}`) })).filter(x => x.s > 1).sort((a, b) => b.s - a.s).slice(0, 1);
  const out: string[] = [];
  if (qs[0]) out.push(`Closest practice-exam question (${qs[0].x.skill}): ${qs[0].x.why}`);
  if (skills.length) out.push(`Syllabus: ${skills.map(x => `${x.r.skill} — practice in: ${x.r.where}`).join('; ')}.`);
  if (labs.length) out.push(`Try it in the sandbox with the lab${labs.length > 1 ? 's' : ''} below.${labs.map(x => ` [[lab:${x.t.id}]]`).join('')}`);
  if (!out.length) out.push('I couldn\'t match that question to a lab. Try naming the feature (for example "merge left anti", "RLS Viewer role", "incremental refresh", "visual calculation").');
  out.push('\n(Offline mode: answers come from matching your question against the labs and syllabus. In the published version, Claude explains the answer and writes the steps.)');
  return out.join('\n\n');
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[\[(?:lab:[\w-]+|star|service)\]\])/g);
  return <>{parts.map((p, i) => {
    const m = /^\[\[(lab:([\w-]+)|star|service)\]\]$/.exec(p);
    if (!m) return <span key={i}>{p}</span>;
    if (m[1] === 'star') return <button key={i} className="btn sm" onClick={() => quickModel()}>Load the star schema</button>;
    if (m[1] === 'service') return <button key={i} className="btn sm" onClick={() => store.setUI({ app: 'service' })}>Open the Power BI service</button>;
    const t = TUTORIALS.find(x => x.id === m[2]);
    return t ? <button key={i} className="btn sm yellow" onClick={() => void startTutorial(t)}><span className="ib"><I n="grad" s={13} />Start lab: {t.title}</span></button> : null;
  })}</>;
}

export function AssistantPanel() {
  const s = useStore();
  const [turns, setTurns] = useState<Turn[]>(load);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [mode, setMode] = useState<'claude' | 'offline' | 'checking'>('checking');
  const sampleRef = useRef<any>(null);
  const ctl = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const c = (window as any).claude;
    if (!c?.use) { setMode('offline'); return; }
    c.use('sample').then((fn: any) => { if (!alive) return; sampleRef.current = fn; setMode(fn ? 'claude' : 'offline'); }).catch(() => alive && setMode('offline'));
    return () => { alive = false; };
  }, []);
  useEffect(() => { save(turns); logRef.current?.scrollTo(0, 1e9); }, [turns, live]);
  const send = async () => {
    const text = q.trim(); if (!text || busy) return;
    const next = [...turns, { role: 'user' as const, content: text }];
    setTurns(next); setQ('');
    if (mode !== 'claude' || !sampleRef.current) { setTurns([...next, { role: 'assistant', content: offlineAnswer(text), source: 'offline' }]); return; }
    setBusy(true); setLive('Thinking…');
    ctl.current = new AbortController();
    try {
      const convo = next.slice(-8).map(t => ({ role: t.role, content: t.content }));
      while (convo.length && convo[0].role !== 'user') convo.shift();
      const { text: answer } = await sampleRef.current([{ role: 'user', content: guide() }, ...convo], { cache: false, signal: ctl.current.signal, onText: ({ text: t }: { text: string }) => setLive(t) });
      setTurns([...next, { role: 'assistant', content: answer, source: 'claude' }]);
    } catch (e: any) {
      if (e?.code === 'not_granted' || e?.code === 'sampling_disabled' || e?.code === 'not_declared' || e?.code === 'capability_disabled') { setMode('offline'); setTurns([...next, { role: 'assistant', content: offlineAnswer(text), source: 'offline' }]); }
      else if (e?.code === 'cancelled') setTurns([...next, ...(e.text ? [{ role: 'assistant' as const, content: e.text + ' …(stopped)', source: 'claude' as const }] : [])]);
      else setTurns([...next, { role: 'assistant', content: `${e?.text ? e.text + '\n\n' : ''}${e?.code === 'rate_limited' ? 'Claude is busy or you\'ve hit a usage limit. Try again in a little while.' : 'Something went wrong reaching Claude. Here is what the labs suggest instead:\n\n' + offlineAnswer(text)}`, source: 'offline' }]);
    } finally { setBusy(false); setLive(''); ctl.current = null; }
  };
  return <div className="assistant" role="complementary" aria-label="Ask how to practice this">
    <div className="tut-h"><I n="chat" s={18} /><div style={{ flex: 1 }}><h3>Ask how to practice this</h3><div className="tiny">{mode === 'claude' ? 'Answers by Claude, using your Claude account' : mode === 'checking' ? 'Connecting…' : 'Offline: matches your question to the labs'}</div></div>
      <button className="iconbtn" title="Clear the conversation" onClick={() => setTurns([])}><I n="trash" s={14} /></button>
      <button className="iconbtn" title="Close" onClick={() => s.setUI({ assistant: false })}><I n="close" s={14} /></button></div>
    <div className="assist-log" ref={logRef}>
      {!turns.length && <div className="tiny" style={{ lineHeight: 1.55 }}>Paste an exam question (with its answer options, if you have them). You'll get the answer, why the others are wrong, and steps to demonstrate it here with sample data. For example: <i>"You need users in the Sales group to see only their region's data in an app. What should you configure?"</i></div>}
      {turns.map((t, i) => <div key={i} className={`cmsg ${t.role === 'user' ? 'me' : 'copilot'}`}><Rich text={t.content} /></div>)}
      {busy && <div className="cmsg copilot">{live}</div>}
    </div>
    <div className="assist-in">
      <textarea className="tx" rows={3} value={q} onChange={e => setQ(e.target.value)} placeholder="Paste an exam question…" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }} />
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="tiny">Ctrl+Enter to send</span>{busy ? <button className="btn sm" onClick={() => ctl.current?.abort()}>Stop</button> : <button className="btn sm primary" disabled={!q.trim()} onClick={() => void send()}>Ask</button>}</div>
    </div>
  </div>;
}
