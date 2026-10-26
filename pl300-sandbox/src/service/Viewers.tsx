// Service viewers: reports (reading view + service toolbar), dashboards (tiles, alerts), apps, paginated reports.
import React, { useEffect, useMemo, useState } from 'react';
import { store, useStore } from '../store';
import { I } from '../ui/icons';
import { menuBelow, menuAt, MenuItem, download } from '../ui/common';
import { Canvas, TooltipLayer } from '../ui/report/Canvas';
import { PhoneCanvas } from '../ui/report/MobileLayout';
import { EChart } from '../ui/report/EChart';
import { svc, me, ws, item, access, can, Item, Tile, sid, now, log, modelData, principalLabel, setTileEvaluator, App, PaginatedDef, isMember } from './model';
import { nav, useSvc, openReport, rlsFor } from './nav';
import { Badge, fmtTime, Empty, TYPE_ICON } from './Service';
import { DaxEngine } from '../dax/engine';
import { Project, Visual, Page, FieldRef } from '../model/types';
import { summarize, visualContext, evalCard, drillLevels, fmt, formatFor, fieldLabel, sortRows, isValueField } from '../report/query';
import { autoUnits } from '../core/format';
import { VISUALS, vdef } from '../report/visuals';
import { clearQueryCache } from '../ui/report/vhelpers';
import { UI } from '../store';

// ---------------------------------------------------------------- evaluating visuals outside the open report (tiles, paginated)
export function withProject<T>(p: Project, viewAs: UI['viewAs'], f: () => T): T {
  const saved = { p: store.project, dax: store.dax, ui: store.ui };
  store.project = p; store.ui = { ...store.ui, viewAs, drillthrough: null, cross: null };
  store.dax = new DaxEngine(p.model); store.applyRls();
  try { return f(); } finally { store.project = saved.p; store.dax = saved.dax; store.ui = saved.ui; }
}

export function tileData(t: Tile, upn: string): { kind: string; value?: any; text?: string; cats?: string[]; series?: { name: string; data: (number | null)[] }[]; rows?: string[][]; cols?: string[]; error?: string } {
  const rep = item(t.reportId); const model = rep?.modelId ? item(rep.modelId) : undefined;
  if (!rep || !model) return { kind: 'error', error: 'The report or semantic model behind this tile was deleted.' };
  const page = rep.report!.pages.find(p => p.id === t.pageId);
  if (!page) return { kind: 'error', error: 'The pinned page no longer exists.' };
  if (t.kind === 'page') return { kind: 'page', text: `${page.name} · ${page.visuals.length} visuals` };
  const v = page.visuals.find(x => x.id === t.visualId);
  if (!v) return { kind: 'error', error: 'The pinned visual was removed from the report.' };
  try {
    return withProject({ ...modelData(model), report: rep.report! }, rlsFor(model, upn), () => {
      const m = store.project.model;
      if (['card', 'cardNew', 'kpi', 'gauge'].includes(v.type)) { const f = v.wells.values?.[0] ?? v.wells.indicator?.[0]; if (!f) return { kind: 'card' }; const val = evalCard(store, page, v, f); return { kind: 'card', value: val, text: fmt(val, formatFor(m, f), f) || '(Blank)' }; }
      if (v.type === 'table' || v.type === 'matrix') {
        const fs = [...(v.wells.columns ?? []), ...(v.wells.rows ?? []).slice(0, 1), ...(v.wells.values ?? [])];
        const g = fs.filter(f => !isValueField(m, f)), vals = fs.filter(f => isValueField(m, f));
        const r = summarize(store, g, vals, visualContext(store, page, v));
        return { kind: 'table', cols: r.cols.map(c => c.label), rows: sortRows(store, r.rows, g).slice(0, 8).map(row => row.map((x, i) => fmt(x, formatFor(m, r.cols[i].field), r.cols[i].field))) };
      }
      const axis = drillLevels(store, v, v.wells.axis ? 'axis' : 'details').shown;
      const vals = (v.wells.values ?? v.wells.y ?? []).slice(0, 3);
      const r = summarize(store, axis, vals, visualContext(store, page, v));
      const rows = sortRows(store, r.rows, axis);
      return { kind: v.type.includes('line') || v.type.includes('area') ? 'line' : v.type === 'pie' || v.type === 'donut' ? 'pie' : 'bar', cats: rows.map(x => axis.map((g, i) => fmt(x[i], formatFor(m, g), g)).join(' ')), series: vals.map((f, j) => ({ name: fieldLabel(f), data: rows.map(x => (typeof x[axis.length + j] === 'number' ? x[axis.length + j] : null)) })) };
    });
  } catch (e) { return { kind: 'error', error: (e as Error).message }; }
}
setTileEvaluator((t, upn) => tileData(t, upn));

// ---------------------------------------------------------------- report viewer
export function ReportViewer({ it, pageId, appId }: { it: Item; pageId?: string; appId?: string }) {
  const s = useStore(); const sv = useSvc();
  const [personalize, setPersonalize] = useState(false);
  const report = appId ? sv.apps.find(a => a.id === appId)?.snapshot?.[it.id]?.report : undefined;
  useEffect(() => { openReport(it, { pageId, report, app: appId }); }, [it.id, appId]);
  if (!s.session || s.session.itemId !== it.id) return <div className="svc-page subtle">Opening {it.name}…</div>;
  const model = item(it.modelId!)!;
  const va = s.ui.viewAs;
  const sel = s.selectedVisual();
  const pages = s.project.report.pages.filter(p => !p.hidden && !p.isTooltip);
  const upn = sv.me;
  const a = access(it, upn);
  const tryDo = (msg: string | null, f: () => void) => () => (msg ? store.toast(msg, 'error') : f());
  const [phone, setPhone] = [s.ui.mobileLayout, (b: boolean) => s.setUI({ mobileLayout: b })];
  const page = s.page();
  return <div className="svc-report">
    <div className="svc-rtool">
      <button className="btn sm" onClick={e => menuBelow(e.currentTarget, [
        { label: 'Download this file', icon: 'export', onClick: () => store.openDialog({ type: 'svcDownload', id: it.id }) },
        { label: 'Print this page', icon: 'paginated', onClick: () => window.print() },
        { label: 'Embed report', icon: 'globe', items: [
          { label: 'SharePoint Online', onClick: () => store.openDialog({ type: 'svcEmbed', id: it.id, kind: 'sharepoint' }) },
          { label: 'Website or portal (secure)', onClick: () => store.openDialog({ type: 'svcEmbed', id: it.id, kind: 'secure' }) },
          { label: 'Publish to web (public)', onClick: tryDo(can('publishToWeb', it), () => store.openDialog({ type: 'svcEmbed', id: it.id, kind: 'web' })) },
        ] },
        { label: 'Settings', icon: 'options', onClick: () => nav.go({ page: 'settings', id: it.id }) },
      ])}>File ▾</button>
      <button className="btn sm" onClick={e => menuBelow(e.currentTarget, [
        { label: 'Analyze in Excel', icon: 'excel', onClick: tryDo(can('analyzeExcel', it), () => nav.go({ page: 'excel', id: model.id })) },
        { label: 'PowerPoint', icon: 'export', onClick: () => store.toast(`Exported "${it.name}" to PowerPoint${it.label ? ` with the ${it.label} label` : ''} (sandbox: no file is created).`) },
        { label: 'PDF', icon: 'export', onClick: () => store.toast(`Exported "${it.name}" to PDF${it.label ? ` with the ${it.label} label` : ''} (sandbox: no file is created).`) },
        { label: 'Export data (selected visual)', icon: 'table', disabled: !sel, onClick: () => store.openDialog({ type: 'exportData', visualId: sel!.id, pageId: page.id, service: { build: a.build } }) },
      ])}>Export ▾</button>
      <button className="btn sm" onClick={tryDo(can('share', it), () => store.openDialog({ type: 'svcShare', id: it.id }))}><span className="ib"><I n="share" s={14} />Share</span></button>
      <button className="btn sm" onClick={tryDo(can('subscribe', it), () => store.openDialog({ type: 'svcSubscribe', id: it.id }))}><span className="ib"><I n="subscribe" s={14} />Subscribe to report</span></button>
      <button className="btn sm" onClick={() => store.openDialog({ type: 'svcPin', reportId: it.id, pageId: page.id, visualId: sel?.id })}><span className="ib"><I n="pin" s={14} />{sel ? 'Pin visual' : 'Pin to a dashboard'}</span></button>
      {it.settings?.personalize && <button className={`btn sm ${personalize ? 'primary' : ''}`} onClick={() => setPersonalize(!personalize)}><span className="ib"><I n="personalize" s={14} />Personalize</span></button>}
      <button className="btn sm" onClick={() => { svc.change(() => { if (it.personal?.[upn]) delete it.personal[upn]; }); openReport(it, { report }); store.toast('Report reset to the author\'s default (filters, slicers and personalized visuals).'); }}>Reset to default</button>
      <button className="btn sm" onClick={e => menuBelow(e.currentTarget, [
        { label: 'Add a personal bookmark', onClick: () => { const name = prompt('Bookmark name', 'My view'); if (name) svc.change(() => { it.personalBookmarks ??= {}; (it.personalBookmarks[upn] ??= []).push({ id: sid('bm'), name, pageId: page.id, data: true, display: true, currentPage: true, state: { pageFilters: page.filters, visuals: Object.fromEntries(page.visuals.map(v => [v.id, { slicer: v.slicer, filters: v.filters, hidden: v.hidden }])) } }); }); } },
        ...((it.personalBookmarks?.[upn] ?? []).map(b => ({ label: b.name, onClick: () => { store.change(p => { const pg = p.report.pages.find(x => x.id === b.pageId); if (!pg) return; pg.filters = b.state.pageFilters; for (const v of pg.visuals) { const st = b.state.visuals[v.id]; if (st) { v.slicer = st.slicer; v.filters = st.filters; } } }); store.setUI({ pageId: b.pageId }); clearQueryCache(); } }))),
        ...(s.project.report.bookmarks.length ? [{ sep: true } as MenuItem, { header: 'Report bookmarks' } as MenuItem, ...s.project.report.bookmarks.map(b => ({ label: b.name, onClick: () => void import('../ui/report/bookmarks').then(m => m.applyBookmark(b)) }))] : []),
      ])}><span className="ib"><I n="bookmark" s={14} />Bookmarks</span></button>
      <button className={`btn sm ${phone ? 'primary' : ''}`} title="Phone view uses the report's mobile layout" onClick={() => setPhone(!phone)}><span className="ib"><I n="mobile" s={14} />Phone view</span></button>
      <span style={{ flex: 1 }} />
      <span className="tiny"><Badge it={it} /> Data updated {fmtTime(model.lastRefresh)}</span>
      <button className="iconbtn" onClick={e => menuBelow(e.currentTarget, [
        { label: 'View lineage', icon: 'lineage', onClick: () => nav.go({ page: 'ws', id: it.wsId, view: 'lineage' }) },
        { label: 'Usage metrics', icon: 'perf', onClick: () => nav.go({ page: 'usage', id: it.id }) },
        { label: 'Open the semantic model', icon: 'model', onClick: () => nav.go({ page: 'settings', id: model.id }) },
      ])} aria-label="More options"><I n="more" s={16} /></button>
    </div>
    {va && <div className={va.roles.includes('__deny__') ? 'warnbox' : 'info'} style={{ borderRadius: 0 }}>
      {va.roles.includes('__deny__') ? <>Row-level security applies to {principalLabel(va.user ?? '')} (they have Read or the Viewer role) but they aren't a member of any role in <b>{model.name}</b>, so the visuals show no data. Add them (or their group) to a role on the semantic model's Security page.</>
        : <>Row-level security: viewing as <b>{principalLabel(va.user ?? '')}</b> in role{va.roles.length > 1 ? 's' : ''} <b>{va.roles.join(', ')}</b>{s.session && store.session && !rlsFor(model, upn) ? ' (testing)' : ''}.</>}
    </div>}
    {!va && model.project?.model.roles.length ? <div className="info tiny" style={{ borderRadius: 0 }}>RLS doesn't apply to {me().name}: workspace {a.role}s can edit the semantic model, so they see all the data. Switch to a Viewer (or someone with Read access) to see RLS.</div> : null}
    <div className="svc-rbody">
      <div className="svc-pages">{pages.map(p => <button key={p.id} className={p.id === s.ui.pageId ? 'on' : ''} onClick={() => s.setUI({ pageId: p.id, selected: [], cross: null })}>{p.name}</button>)}</div>
      <div className="center" style={{ position: 'relative' }}>
        {phone ? (page.mobile && Object.keys(page.mobile).length ? <div className="canvas-wrap" style={{ display: 'flex', justifyContent: 'center', padding: 24, overflow: 'auto' }}><div className="phone"><PhoneCanvas page={page} /></div></div> : <Empty title="No mobile layout" text="This page has no mobile layout, so phones show the full page in landscape. The author can create one in Power BI Desktop (View › Mobile layout)." />) : <Canvas />}
        <TooltipLayer />
      </div>
      {personalize && <PersonalizePane it={it} />}
    </div>
  </div>;
}

function PersonalizePane({ it }: { it: Item }) {
  const s = useStore();
  const v = s.selectedVisual();
  const m = s.project.model;
  const upn = svc.get().me;
  const save = (patch: Partial<Visual>) => {
    s.updateVisual(v!.id, x => Object.assign(x, patch), false); clearQueryCache();
    svc.change(() => { it.personal ??= {}; const p = (it.personal[upn] ??= { visuals: {} }); p.visuals ??= {}; p.visuals[v!.id] = { type: s.findVisual(v!.id)!.type, wells: s.findVisual(v!.id)!.wells }; });
  };
  const fields: FieldRef[] = [...m.measures.filter(x => !x.hidden).map(x => ({ table: x.table, measure: x.name })), ...m.tables.filter(t => !t.hidden).flatMap(t => t.columns.filter(c => !c.hidden).map(c => ({ table: t.name, column: c.name })))];
  const key = (f?: FieldRef) => (f ? `${f.table}|${f.column ?? ''}|${f.measure ?? ''}` : '');
  return <div className="pane" style={{ width: 260 }}>
    <div className="pane-h"><span>Personalize this visual</span></div>
    <div className="pane-body">
      {!v ? <div className="tiny">Select a visual to personalize it. Your changes are saved for you only; the author's version doesn't change.</div> : <>
        <div className="field"><label>Visualization type</label><select className="tx" value={v.type} onChange={e => save({ type: e.target.value })}>{VISUALS.filter(x => x.group !== 'element' && x.chart).map(x => <option key={x.type} value={x.type}>{x.name}</option>)}</select></div>
        {vdef(v.type).wells.filter(w => w.key !== 'tooltips').map(w => <div key={w.key} className="field"><label>{w.label}</label>
          <select className="tx" value={key(v.wells[w.key]?.[0])} onChange={e => { const f = fields.find(x => key(x) === e.target.value); save({ wells: { ...v.wells, [w.key]: f ? [w.kind === 'value' && f.column ? { ...f, agg: 'Sum' as const } : f] : [] } }); }}>
            <option value="">(none)</option>{fields.filter(f => (w.kind === 'value' ? !!f.measure || true : !f.measure)).map(f => <option key={key(f)} value={key(f)}>{f.measure ?? `${f.table}[${f.column}]`}</option>)}
          </select></div>)}
        <button className="btn sm" onClick={() => { svc.change(() => { delete it.personal?.[upn]?.visuals?.[v.id]; }); openReport(it); }}>Reset this visual</button>
        <div className="tiny" style={{ marginTop: 8 }}>The report author enabled Personalize visuals (Options › Report settings). Readers can swap fields and visual types without edit permission; to keep a combination, save a personal bookmark.</div>
      </>}
    </div>
  </div>;
}

// ---------------------------------------------------------------- dashboards
export function TileView({ t, upn }: { t: Tile; upn: string }) {
  const d = useMemo(() => tileData(t, upn), [t.id, upn, svc.version()]);
  if (d.kind === 'error') return <div className="tiny" style={{ color: '#a4262c', padding: 8 }}>{d.error}</div>;
  if (d.kind === 'card') return <div className="tile-card"><div className="v">{d.value === null || d.value === undefined ? '(Blank)' : typeof d.value === 'number' ? autoUnits(d.value) : d.text}</div></div>;
  if (d.kind === 'page') return <div className="tile-card"><I n="report" s={28} /><div className="tiny">{d.text}</div></div>;
  if (d.kind === 'table') return <div style={{ overflow: 'hidden', padding: 4 }}><table className="grid-table" style={{ fontSize: 11 }}><thead><tr>{d.cols!.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{d.rows!.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table></div>;
  const option = d.kind === 'pie'
    ? { animation: false, series: [{ type: 'pie', radius: ['35%', '70%'], data: d.cats!.map((c, i) => ({ name: c, value: d.series![0]?.data[i] })), label: { fontSize: 9 } }] }
    : { animation: false, grid: { left: 40, right: 8, top: 8, bottom: 24 }, xAxis: { type: 'category', data: d.cats, axisLabel: { fontSize: 9 } }, yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (x: number) => autoUnits(x) } }, series: d.series!.map(sr => ({ type: d.kind === 'line' ? 'line' : 'bar', name: sr.name, data: sr.data, symbol: 'none' })) };
  return <div style={{ position: 'relative', height: '100%' }}><EChart option={option} /></div>;
}

export function DashboardViewer({ it, snapshot }: { it: Item; snapshot?: Tile[] }) {
  useSvc();
  const upn = svc.get().me;
  const tiles = snapshot ?? it.tiles ?? [];
  const tileMenu = (e: React.MouseEvent, t: Tile) => {
    const kind = t.visualType ?? '';
    const alertable = ['card', 'cardNew', 'kpi', 'gauge'].includes(kind);
    menuAt(e, [
      { label: 'Go to report', icon: 'report', onClick: () => nav.go({ page: 'item', id: t.reportId, pageId: t.pageId }) },
      { label: 'Manage alerts', icon: 'alert', disabled: !alertable, onClick: () => { const m = can('alert', it); if (m) store.toast(m, 'error'); else store.openDialog({ type: 'svcAlert', dashId: it.id, tileId: t.id }); } },
      ...(!alertable ? [{ label: 'Alerts are only available on card, KPI and gauge tiles', disabled: true } as MenuItem] : []),
      { label: 'Edit details', icon: 'edit', onClick: () => { const n = prompt('Tile title', t.title); if (n) svc.change(() => { t.title = n; }); } },
      { label: 'Delete tile', icon: 'trash', onClick: () => svc.change(() => { it.tiles = (it.tiles ?? []).filter(x => x.id !== t.id); }) },
    ]);
  };
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="ws-head"><I n="dashboard" s={28} /><div><h1>{it.name}</h1><span className="tiny">Dashboard · {ws(it.wsId)?.name} <Badge it={it} /></span></div></div>
      {!snapshot && <div className="row"><button className="btn sm" onClick={() => { const m = can('share', it); if (m) store.toast(m, 'error'); else store.openDialog({ type: 'svcShare', id: it.id }); }}><span className="ib"><I n="share" s={14} />Share</span></button>
        <button className="btn sm" onClick={() => { const m = can('subscribe', it); if (m) store.toast(m, 'error'); else store.openDialog({ type: 'svcSubscribe', id: it.id }); }}><span className="ib"><I n="subscribe" s={14} />Subscribe</span></button></div>}
    </div>
    {!tiles.length && <Empty title="This dashboard is empty" text="Open a report, select a visual and choose Pin visual (or Pin to a dashboard for a live page). Dashboards are single-page canvases of tiles from one or more reports." />}
    <div className="tiles">{tiles.map(t => <div key={t.id} className="tile" style={{ gridColumn: `span ${t.w}`, gridRow: `span ${t.h}` }}>
      <div className="tile-h"><b>{t.title}</b>{t.alerts.some(a => a.owner === upn && a.active) && <span title="You have an alert on this tile"><I n="alert" s={12} /></span>}<button className="iconbtn" onClick={e => tileMenu(e, t)} aria-label="Tile options"><I n="more" s={13} /></button></div>
      <div className="tile-b" onClick={() => nav.go({ page: 'item', id: t.reportId, pageId: t.pageId })}><TileView t={t} upn={upn} /></div>
    </div>)}</div>
    <div className="tiny" style={{ marginTop: 10 }}>Tiles are live: they show the latest data after each refresh, filtered by RLS for each viewer. Selecting a tile opens the report it came from.</div>
  </div>;
}

// ---------------------------------------------------------------- apps
export function AppViewer({ id, itemId }: { id: string; itemId?: string }) {
  const s = useSvc(); const upn = s.me;
  const app = s.apps.find(a => a.id === id);
  if (!app?.published) return <Empty title="App not available" text="The app isn't published yet." />;
  const auds = app.audiences.filter(a => a.members.some(m => isMember(upn, m)));
  if (!auds.length) return <Empty title="You don't have access to this app" text={`${me().name} isn't in any of the app's audiences. The workspace Admin or Member can add them in Update app › Audience.`} />;
  const ids = [...new Set(auds.flatMap(a => a.items))].filter(x => app.snapshot?.[x]);
  const cur = itemId ?? ids[0];
  const snap = cur ? app.snapshot![cur] : undefined;
  const live = cur ? item(cur) : undefined;
  return <div className="svc-app">
    <div className="app-nav">
      <div className="app-title"><span className="app-logo" style={{ background: app.color }}>{app.name[0]}</span><b>{app.name}</b></div>
      {ids.map(x => <button key={x} className={x === cur ? 'on' : ''} onClick={() => nav.go({ page: 'app', id, itemId: x })}><I n={TYPE_ICON[app.snapshot![x].type]} s={15} />{app.snapshot![x].name}</button>)}
      <div className="tiny" style={{ padding: 10 }}>Published {fmtTime(app.published)}. Content changed in the workspace after that appears only after the app is updated.</div>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {!snap || !live ? <Empty title="Content unavailable" text="This item was removed from the workspace." /> :
        snap.type === 'Report' ? <ReportViewer it={live} appId={app.id} key={cur} /> :
        snap.type === 'Dashboard' ? <DashboardViewer it={live} snapshot={snap.tiles} /> :
        snap.type === 'PaginatedReport' ? <PaginatedViewer it={{ ...live, rdl: snap.rdl }} /> : <Empty title={snap.name} text="" />}
    </div>
  </div>;
}

// ---------------------------------------------------------------- paginated reports
export function paginatedRows(def: PaginatedDef, upn: string, paramValue?: string) {
  const model = item(def.modelId); if (!model) return { error: 'The semantic model was deleted.' } as const;
  return withProject({ ...modelData(model) }, rlsFor(model, upn), () => {
    const m = store.project.model;
    const fields: FieldRef[] = def.columns.map(c => (c.measure ? { table: c.table, measure: c.measure } : { table: c.table, column: c.column }));
    const g = fields.filter(f => !f.measure), vals = fields.filter(f => f.measure);
    const page: Page = { id: 'x', name: 'x', visuals: [], filters: def.param && paramValue ? [{ id: 'p', field: { table: def.param.table, column: def.param.column }, type: 'basic', values: [paramValue] }] : [] };
    const v: Visual = { id: 'x', type: 'table', x: 0, y: 0, w: 0, h: 0, wells: {}, filters: [], format: {} };
    const r = summarize(store, g, vals, visualContext(store, page, v));
    const rows = sortRows(store, r.rows, g);
    const order = fields.map(f => r.cols.findIndex(c => c.field === f));
    const paramOptions = def.param ? [...new Set((m.tables.find(t => t.name === def.param!.table)?.rows ?? []).map(row => row[m.tables.find(t => t.name === def.param!.table)!.columns.findIndex(c => c.name === def.param!.column)]))].map(String).sort() : [];
    return { rows: rows.map(row => order.map(i => fmt(row[i], formatFor(m, r.cols[i].field), r.cols[i].field))), raw: rows.map(row => order.map(i => row[i])), paramOptions } as const;
  });
}

export function PaginatedViewer({ it }: { it: Item }) {
  useSvc();
  const def = it.rdl!;
  const [param, setParam] = useState<string>('');
  const [pageNo, setPageNo] = useState(0);
  const data = useMemo(() => paginatedRows(def, svc.get().me, param || undefined), [it.id, param, svc.version()]);
  if ('error' in data) return <Empty title="Can't run the report" text={data.error as string} />;
  const per = def.rowsPerPage;
  const pages = Math.max(1, Math.ceil(data.rows.length / per));
  const cur = Math.min(pageNo, pages - 1);
  const totals = def.columns.map((c, i) => (c.measure ? data.raw.reduce((a, r) => a + (typeof r[i] === 'number' ? r[i] : 0), 0) : null));
  const sub = (t: string) => t.replace(/\[&PageNumber\]|Globals!PageNumber/g, String(cur + 1)).replace(/\[&TotalPages\]|Globals!TotalPages/g, String(pages)).replace(/\[&ExecutionTime\]|Globals!ExecutionTime/g, new Date(now()).toLocaleString()).replace(/\[&UserID\]|User!UserID/g, svc.get().me);
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="ws-head"><I n="paginated" s={28} /><div><h1>{it.name}</h1><span className="tiny">Paginated report (.rdl) · {ws(it.wsId)?.name} <Badge it={it} /></span></div></div>
      <div className="row">
        {def.param && <label className="row tiny">{def.param.label} <select className="tx" value={param} onChange={e => { setParam(e.target.value); setPageNo(0); }}><option value="">(All)</option>{data.paramOptions.map(o => <option key={o}>{o}</option>)}</select></label>}
        <button className="btn sm" disabled={cur === 0} onClick={() => setPageNo(cur - 1)}>‹</button><span className="tiny">Page {cur + 1} of {pages}</span><button className="btn sm" disabled={cur >= pages - 1} onClick={() => setPageNo(cur + 1)}>›</button>
        <button className="btn sm" onClick={e => menuBelow(e.currentTarget, ['PDF', 'Excel (.xlsx)', 'Word (.docx)', 'PowerPoint (.pptx)', 'CSV', 'XML', 'MHTML', 'Accessible PDF'].map(f => ({ label: f, onClick: () => { if (f === 'CSV') download(`${it.name}.csv`, [def.columns.map(c => c.label).join(','), ...data.rows.map(r => r.map(x => (/[",]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(','))].join('\r\n'), 'text/csv'); else store.toast(`Exported all ${pages} pages to ${f} (sandbox: no file created). Paginated reports export every row, not just what fits on screen.`); } })))}>Export ▾</button>
        <button className="btn sm" onClick={() => window.print()}>Print</button>
      </div>
    </div>
    <div className={`rdl-page ${def.orientation === 'Landscape' ? 'land' : ''}`}>
      <div className="rdl-h">{sub(def.header)}</div>
      <h2 style={{ margin: '6px 0 10px', fontSize: 18 }}>{def.title}</h2>
      <table className="grid-table rdl-table"><thead><tr>{def.columns.map((c, i) => <th key={i} className={c.measure ? 'num' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>{data.rows.slice(cur * per, cur * per + per).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className={def.columns[j].measure ? 'num' : ''}>{x}</td>)}</tr>)}</tbody>
        {cur === pages - 1 && <tfoot><tr>{def.columns.map((c, i) => <td key={i} className="num"><b>{i === 0 ? 'Total' : totals[i] !== null ? autoUnits(totals[i]!) : ''}</b></td>)}</tr></tfoot>}</table>
      <div className="rdl-f">{sub(def.footer)}</div>
    </div>
  </div>;
}

export type { App };
