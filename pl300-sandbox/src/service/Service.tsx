// The simulated Power BI service (app.powerbi.com): navigation, home, workspaces, item lists and settings.
import React, { useEffect, useState } from 'react';
import { store, useStore } from '../store';
import { I } from '../ui/icons';
import { menuAt, menuBelow, MenuItem } from '../ui/common';
import { svc, me, ws, item, roleIn, access, can, licenseBlock, principalLabel, advance, Item, Workspace, ItemType, sid, now, mailbox, log, atLeast, WsLicense, refreshNow } from './model';
import { nav, useRoute, useSvc, openReport, canOpen } from './nav';
import { ensureSeedContent } from './seed';
import { ReportViewer, DashboardViewer, AppViewer, PaginatedViewer } from './Viewers';
import { ItemSettings, LineageView, UsageMetrics, AdminPortal, Gateways, Pipelines, AppEditor, PaginatedEditor, ExcelPivot, PublicWeb } from './Pages';
import { LABELS } from '../model/labels';

export const TYPE_ICON: Record<ItemType, string> = { SemanticModel: 'model', Report: 'report', Dashboard: 'dashboard', PaginatedReport: 'paginated', Lakehouse: 'lakehouse', Dataflow: 'transform' };
export const TYPE_NAME: Record<ItemType, string> = { SemanticModel: 'Semantic model', Report: 'Report', Dashboard: 'Dashboard', PaginatedReport: 'Paginated report', Lakehouse: 'Lakehouse', Dataflow: 'Dataflow Gen2' };
export const fmtTime = (t?: number) => (t ? new Date(t).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' }) : '—');

export function Badge({ it }: { it: Item }) {
  return <>{it.endorsement && <span className={`endorse ${it.endorsement === 'Promoted' ? 'promoted' : ''}`} title={it.endorsement}><I n={it.endorsement === 'Promoted' ? 'promoted' : 'certified'} s={13} />{it.endorsement}</span>}
    {it.label && <span className="sens" title={LABELS.find(l => l.name === it.label)?.desc}>{it.label}</span>}</>;
}

export function ServiceApp() {
  useStore();
  const s = useSvc();
  const r = useRoute();
  useEffect(() => { void ensureSeedContent(); }, []);
  const u = me();
  const unread = mailbox(u.upn).filter(m => !m.read).length;
  const navItems: [string, string, () => void, boolean][] = [
    ['home', 'Home', () => nav.go({ page: 'home' }), r.page === 'home'],
    ['workspace', 'Workspaces', () => nav.go({ page: 'workspaces' }), r.page === 'workspaces' || r.page === 'ws'],
    ['lakehouse', 'OneLake catalog', () => nav.go({ page: 'catalog' }), r.page === 'catalog'],
    ['app', 'Apps', () => nav.go({ page: 'apps' }), r.page === 'apps' || r.page === 'app'],
    ['pipeline', 'Deployment pipelines', () => nav.go({ page: 'pipelines' }), r.page === 'pipelines'],
    ['gateway', 'Connections and gateways', () => nav.go({ page: 'gateways' }), r.page === 'gateways'],
    ['subscribe', `Inbox${unread ? ` (${unread})` : ''}`, () => nav.go({ page: 'inbox' }), r.page === 'inbox'],
    ['options', 'Admin portal', () => nav.go({ page: 'admin' }), r.page === 'admin'],
  ];
  return <div className="svc">
    <div className="svc-top">
      <button className="svc-waffle" title="Back to Power BI Desktop" onClick={() => { nav.go({ page: 'home' }); store.setUI({ app: 'desktop' }); }}><I n="logo" s={20} /></button>
      <b className="svc-brand">Power BI</b><span className="tiny svc-sandbox">service · sandbox</span>
      <span style={{ flex: 1 }} />
      <div className="svc-clock" title="Simulated time: scheduled refreshes, alerts and subscriptions run when time passes">
        <I n="calendar" s={14} c="#fff" /><span>{new Date(s.clock).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        <button onClick={() => advance(3600_000)}>+1 h</button><button onClick={() => advance(24 * 3600_000)}>+1 day</button><button onClick={() => advance(7 * 24 * 3600_000)}>+1 wk</button>
      </div>
      <button className="svc-icon" title="Inbox (emails from Power BI)" onClick={() => nav.go({ page: 'inbox' })}><I n="alert" s={16} c="#fff" />{unread > 0 && <span className="dot">{unread}</span>}</button>
      <button className="svc-user" onClick={e => menuBelow(e.currentTarget, [
        { header: 'Switch user (sandbox)' },
        ...s.users.map(x => ({ label: `${x.name} · ${x.license}`, checked: x.upn === s.me, onClick: () => { nav.go(r.page === 'item' ? { page: 'home' } : r); svc.change(st => { st.me = x.upn; }); store.toast(`Signed in as ${x.name} (${x.license} license). ${x.title}.`); } })),
        { sep: true },
        { label: 'Reset the sandbox service', icon: 'refresh', onClick: () => store.openDialog({ type: 'confirm', title: 'Reset service', text: 'Delete everything published to the sandbox service and start again with the seed content?', ok: 'Reset', onOk: () => { nav.go({ page: 'home' }); svc.reset(); void ensureSeedContent(); } }) },
      ])}><span className="avatar">{u.name.split(' ').map(x => x[0]).join('')}</span><span className="svc-uname">{u.name}<span className="tiny">{u.license} · {u.upn}</span></span></button>
      <button className="btn sm" onClick={() => { nav.go({ page: 'home' }); store.setUI({ app: 'desktop' }); }}>Open Desktop</button>
    </div>
    <div className="svc-body">
      <nav className="svc-nav">{navItems.map(([icon, label, go, on]) => <button key={label} className={on ? 'on' : ''} onClick={go} title={label}><I n={icon} s={18} /><span>{label}</span></button>)}</nav>
      <main className="svc-main">
        {r.page === 'home' && <Home />}
        {r.page === 'workspaces' && <Workspaces />}
        {r.page === 'ws' && (r.view === 'lineage' ? <LineageView wsId={r.id} /> : <WorkspaceView id={r.id} />)}
        {r.page === 'item' && <ItemRoute id={r.id} pageId={r.pageId} />}
        {r.page === 'settings' && <ItemSettings id={r.id} tab={r.tab} />}
        {r.page === 'apps' && <Apps />}
        {r.page === 'app' && <AppViewer id={r.id} itemId={r.itemId} />}
        {r.page === 'appEdit' && <AppEditor wsId={r.wsId} />}
        {r.page === 'pipelines' && <Pipelines id={r.id} />}
        {r.page === 'gateways' && <Gateways />}
        {r.page === 'admin' && <AdminPortal />}
        {r.page === 'inbox' && <Inbox />}
        {r.page === 'usage' && <UsageMetrics id={r.id} />}
        {r.page === 'catalog' && <Catalog />}
        {r.page === 'paginatedEdit' && <PaginatedEditor id={r.id} wsId={r.wsId} />}
        {r.page === 'excel' && <ExcelPivot id={r.id} />}
        {r.page === 'web' && <PublicWeb id={r.id} />}
      </main>
    </div>
  </div>;
}

function ItemRoute({ id, pageId }: { id: string; pageId?: string }) {
  const it = item(id);
  if (!it) return <Empty title="Item not found" text="It may have been deleted." />;
  const block = canOpen(it);
  if (block) return <Empty title="You can't open this item" text={block} />;
  if (it.type === 'Report') return <ReportViewer it={it} pageId={pageId} />;
  if (it.type === 'Dashboard') return <DashboardViewer it={it} />;
  if (it.type === 'PaginatedReport') return <PaginatedViewer it={it} />;
  if (it.type === 'SemanticModel') return <ItemSettings id={it.id} />;
  return <LakehouseView it={it} />;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <div className="svc-empty"><h2>{title}</h2><p>{text}</p></div>;
}

function Home() {
  const s = useSvc(); const u = me();
  const visible = s.items.filter(i => access(i, u.upn).read && ['Report', 'Dashboard', 'PaginatedReport', 'SemanticModel'].includes(i.type));
  const recent = [...visible].sort((a, b) => b.modified - a.modified).slice(0, 8);
  const apps = s.apps.filter(a => a.published && a.installed.includes(u.upn));
  return <div className="svc-page">
    <h1>Welcome, {u.name.split(' ')[0]}</h1>
    <p className="subtle">{u.title}. License: <b>{u.license}</b>. Groups: {s.groups.filter(g => g.members.includes(u.upn)).map(g => g.name).join(', ') || 'none'}.</p>
    {s.items.filter(i => i.type === 'Report').length <= 1 && <div className="info" style={{ maxWidth: 760 }}>Start in Power BI Desktop: build or open a report, then <b>Home › Publish</b> to a workspace here. A certified <b>Contoso Sales</b> semantic model and report are already in <b>Sales Analytics</b>.</div>}
    <h3>Recent</h3>
    <div className="svc-cards">{recent.map(i => <ItemCard key={i.id} it={i} />)}{!recent.length && <div className="subtle">Nothing you can open yet. Ask for access, or switch user.</div>}</div>
    <h3>Apps</h3>
    <div className="svc-cards">{apps.map(a => <button key={a.id} className="svc-card" onClick={() => nav.go({ page: 'app', id: a.id })}><span className="app-logo" style={{ background: a.color }}>{a.name[0]}</span><b>{a.name}</b><span className="tiny">{ws(a.wsId)?.name}</span></button>)}{!apps.length && <div className="subtle">No apps installed. Go to Apps › Get apps.</div>}</div>
  </div>;
}

function ItemCard({ it }: { it: Item }) {
  return <button className="svc-card" onClick={() => openItem(it)}><I n={TYPE_ICON[it.type]} s={22} /><b>{it.name}</b><span className="tiny">{TYPE_NAME[it.type]} · {ws(it.wsId)?.personal ? 'My workspace' : ws(it.wsId)?.name}</span><span><Badge it={it} /></span></button>;
}

export function openItem(it: Item) {
  if (it.type === 'SemanticModel') nav.go({ page: 'settings', id: it.id });
  else nav.go({ page: 'item', id: it.id });
}

function Workspaces() {
  const s = useSvc(); const u = me();
  const mine = s.workspaces.filter(w => (w.personal ? w.personal === u.upn : !!roleIn(w, u.upn)));
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}><h1>Workspaces</h1><button className="btn primary" onClick={() => store.openDialog({ type: 'svcNewWs' })}>+ New workspace</button></div>
    <table className="grid-table svc-table"><thead><tr><th>Name</th><th>Your role</th><th>License mode</th><th>Items</th></tr></thead><tbody>
      {mine.map(w => <tr key={w.id} className="clickable" onClick={() => nav.go({ page: 'ws', id: w.id })}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="workspace" s={16} /><b>{w.personal ? 'My workspace' : w.name}</b></span></td><td>{w.personal ? 'Admin' : roleIn(w, u.upn)}</td><td>{w.license}</td><td>{s.items.filter(i => i.wsId === w.id).length}</td></tr>)}
    </tbody></table>
    <p className="tiny">You see workspaces where you have a role (directly or through a group). People who only get content through sharing or an app don't see the workspace.</p>
  </div>;
}

function WorkspaceView({ id }: { id: string }) {
  const s = useSvc(); const u = me();
  const w = ws(id); if (!w) return <Empty title="Workspace not found" text="" />;
  const role = w.personal === u.upn ? 'Admin' : roleIn(w, u.upn);
  if (!role) return <Empty title="No access" text={`${u.name} has no role in ${w.name}.`} />;
  const items = s.items.filter(i => i.wsId === id);
  const app = s.apps.find(a => a.wsId === id);
  const block = licenseBlock(w, u.upn);
  return <div className="svc-page">
    <div className="ws-head"><I n="workspace" s={30} /><div><h1>{w.personal ? 'My workspace' : w.name}</h1><span className="tiny">{w.license} · your role: <b>{role}</b>{w.description ? ` · ${w.description}` : ''}</span></div></div>
    {block && <div className="warnbox">{block}</div>}
    <div className="svc-toolbar">
      <button className="btn sm primary" onClick={e => menuBelow(e.currentTarget, [
        { label: 'Dashboard', icon: 'dashboard', onClick: () => store.openDialog({ type: 'svcNewDashboard', wsId: id }) },
        { label: 'Paginated report', icon: 'paginated', onClick: () => (can('publish', w) ? store.toast(can('publish', w)!, 'error') : nav.go({ page: 'paginatedEdit', wsId: id })) },
        { label: 'Report (from Power BI Desktop)', icon: 'report', onClick: () => store.openDialog({ type: 'message', title: 'Create a report', text: 'Build reports in Power BI Desktop and publish them here (Home › Publish). To build on an existing semantic model, use Get data › Power BI semantic models in Desktop (needs Build permission).' }) },
      ])}>+ New item</button>
      {!w.personal && <button className="btn sm" onClick={() => { const m = can('publishApp', w); if (m) store.toast(m, 'error'); else nav.go({ page: 'appEdit', wsId: id }); }}>{app?.published ? 'Update app' : 'Create app'}</button>}
      {!w.personal && <button className="btn sm" onClick={() => store.openDialog({ type: 'svcAccess', wsId: id })}>Manage access</button>}
      <button className="btn sm" onClick={() => nav.go({ page: 'ws', id, view: 'lineage' })}><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><I n="lineage" s={14} />Lineage view</span></button>
      {!w.personal && <button className="btn sm" onClick={() => store.openDialog({ type: 'svcWsSettings', wsId: id })}>Workspace settings</button>}
    </div>
    <table className="grid-table svc-table"><thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Refreshed</th><th>Next refresh</th><th>Endorsement</th><th>Sensitivity</th>{app && <th title="Included in the app">In app</th>}<th /></tr></thead><tbody>
      {items.map(it => <tr key={it.id}>
        <td><button className="linkbtn" style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={() => openItem(it)}><I n={TYPE_ICON[it.type]} s={16} />{it.name}</button></td>
        <td>{TYPE_NAME[it.type]}</td><td>{principalLabel(it.owner)}</td>
        <td>{it.type === 'SemanticModel' ? fmtTime(it.lastRefresh) : it.type === 'Report' ? fmtTime(item(it.modelId ?? '')?.lastRefresh) : '—'}</td>
        <td>{it.type === 'SemanticModel' && it.refresh?.enabled && it.refresh.times.length ? nextRun(it) : it.type === 'SemanticModel' ? 'N/A' : ''}</td>
        <td>{it.endorsement ? <Badge it={{ ...it, label: undefined }} /> : '—'}</td><td>{it.label ? <span className="sens">{it.label}</span> : '—'}</td>
        {app && <td style={{ textAlign: 'center' }}>{app.audiences.some(a => a.items.includes(it.id)) ? '✓' : ''}</td>}
        <td><button className="iconbtn" aria-label="More options" onClick={e => itemMenu(e, it)}><I n="more" s={14} /></button></td>
      </tr>)}
      {!items.length && <tr><td colSpan={9} className="subtle">This workspace is empty. Publish from Power BI Desktop (Home › Publish).</td></tr>}
    </tbody></table>
  </div>;
}

function nextRun(it: Item) {
  const r = it.refresh!; const t = new Date(now());
  for (let d = 0; d < 8; d++) for (const tm of [...r.times].sort()) {
    const c = new Date(t.getFullYear(), t.getMonth(), t.getDate() + d, +tm.slice(0, 2), +tm.slice(3, 5));
    if (c.getTime() > t.getTime() && (r.frequency === 'Daily' || r.days.includes(c.toLocaleString('en-US', { weekday: 'long' })))) return fmtTime(c.getTime());
  }
  return '—';
}

export function itemMenu(e: React.MouseEvent, it: Item) {
  const w = ws(it.wsId)!;
  const tryDo = (msg: string | null, f: () => void) => () => (msg ? store.toast(msg, 'error') : f());
  const items: MenuItem[] = [];
  if (it.type !== 'SemanticModel') items.push({ label: 'Open', onClick: () => openItem(it) });
  if (it.type === 'SemanticModel') {
    items.push({ label: 'Refresh now', icon: 'refresh', onClick: tryDo(can('refresh', it), () => { let res: any; svc.change(() => { res = refreshNow(it); }); store.toast(res.status === 'Completed' ? `Refresh of ${it.name} completed.` : `Refresh failed: ${res.msg}`, res.status === 'Completed' ? 'info' : 'error'); }) });
    items.push({ label: 'Schedule refresh', icon: 'calendar', onClick: () => nav.go({ page: 'settings', id: it.id, tab: 'refresh' }) });
    items.push({ label: 'Security (row-level security)', icon: 'role', onClick: () => nav.go({ page: 'settings', id: it.id, tab: 'security' }) });
    items.push({ label: 'Analyze in Excel', icon: 'excel', onClick: tryDo(can('analyzeExcel', it), () => nav.go({ page: 'excel', id: it.id })) });
  }
  if (it.type === 'Report') {
    items.push({ label: 'Analyze in Excel', icon: 'excel', onClick: tryDo(can('analyzeExcel', it), () => nav.go({ page: 'excel', id: it.modelId! })) });
    items.push({ label: 'Download this file', icon: 'export', onClick: () => store.openDialog({ type: 'svcDownload', id: it.id }) });
  }
  items.push({ label: 'Share', icon: 'share', onClick: tryDo(can('share', it), () => store.openDialog({ type: 'svcShare', id: it.id })) });
  items.push({ label: 'Manage permissions', icon: 'role', onClick: () => store.openDialog({ type: 'svcPerms', id: it.id }) });
  items.push({ label: 'Settings', icon: 'options', onClick: () => nav.go({ page: 'settings', id: it.id }) });
  items.push({ label: 'View lineage', icon: 'lineage', onClick: () => nav.go({ page: 'ws', id: w.id, view: 'lineage' }) });
  if (it.type === 'Report' || it.type === 'Dashboard') items.push({ label: 'View usage metrics report', icon: 'perf', onClick: () => nav.go({ page: 'usage', id: it.id }) });
  items.push({ sep: true });
  items.push({ label: 'Delete', icon: 'trash', onClick: tryDo(can('editItem', it), () => store.openDialog({ type: 'confirm', title: `Delete ${it.name}?`, text: it.type === 'SemanticModel' ? `Deleting the semantic model also breaks ${svc.get().items.filter(x => x.modelId === it.id).length} report(s) built on it. Check the impact analysis first.` : 'This can\'t be undone.', ok: 'Delete', onOk: () => svc.change(s => { s.items = s.items.filter(x => x.id !== it.id); for (const a of s.apps) for (const au of a.audiences) au.items = au.items.filter(x => x !== it.id); log(`Deleted ${it.name}`); }) })) });
  menuAt(e, items);
}

function Apps() {
  const s = useSvc(); const u = me();
  const avail = s.apps.filter(a => a.published && a.audiences.some(au => au.members.some(m => m === u.upn || s.groups.find(g => g.name === m)?.members.includes(u.upn))));
  const installed = avail.filter(a => a.installed.includes(u.upn) || a.installAuto);
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}><h1>Apps</h1><button className="btn" onClick={() => store.openDialog({ type: 'svcGetApps' })}>Get apps</button></div>
    <div className="svc-cards">{installed.map(a => <button key={a.id} className="svc-card" onClick={() => nav.go({ page: 'app', id: a.id })}><span className="app-logo" style={{ background: a.color }}>{a.name[0]}</span><b>{a.name}</b><span className="tiny">{a.description}</span><span className="tiny">Published {fmtTime(a.published)}</span></button>)}</div>
    {!installed.length && <p className="subtle">No apps yet. Apps are published from a workspace (Create app) to audiences of users and groups. Select <b>Get apps</b> to see the apps you can install.</p>}
  </div>;
}

function Inbox() {
  const s = useSvc(); const u = me();
  const mails = mailbox(u.upn);
  const [open, setOpen] = useState<string | null>(mails[0]?.id ?? null);
  const m = mails.find(x => x.id === open);
  useEffect(() => { if (m && !m.read) svc.change(() => { m.read = true; }); }, [open]);
  return <div className="svc-page" style={{ display: 'flex', gap: 12, alignItems: 'stretch', height: '100%' }}>
    <div style={{ width: 320, flexShrink: 0, overflow: 'auto' }}>
      <h1>Inbox</h1><p className="tiny">Email {u.name} received from Power BI: refresh failures, alerts, subscriptions, sharing and access requests.</p>
      {mails.map(x => <button key={x.id} className={`mail ${x.id === open ? 'on' : ''} ${x.read ? '' : 'unread'}`} onClick={() => setOpen(x.id)}><b>{x.subject}</b><span className="tiny">{x.from} · {fmtTime(x.at)}</span></button>)}
      {!mails.length && <div className="subtle">No email.</div>}
    </div>
    <div className="mail-body">{m ? <><h2>{m.subject}</h2><div className="tiny">From {m.from} · To {principalLabel(m.to)} · {fmtTime(m.at)}</div><pre>{m.body}</pre></> : <div className="subtle">Select a message.</div>}</div>
    <span hidden>{s.clock}</span>
  </div>;
}

function Catalog() {
  const s = useSvc(); const u = me();
  const [q, setQ] = useState('');
  const list = s.items.filter(i => ['SemanticModel', 'Lakehouse', 'Dataflow'].includes(i.type) && !ws(i.wsId)?.personal && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  return <div className="svc-page">
    <h1>OneLake catalog</h1>
    <p className="subtle">Discover data items. Endorsed (Promoted, Certified) items are easier to find and trust. You can request access to items you can't use yet.</p>
    <div className="pane-search" style={{ maxWidth: 360 }}><I n="search" s={13} /><input placeholder="Filter by keyword" value={q} onChange={e => setQ(e.target.value)} /></div>
    <table className="grid-table svc-table"><thead><tr><th>Name</th><th>Type</th><th>Workspace</th><th>Endorsement</th><th>Sensitivity</th><th>Your access</th><th /></tr></thead><tbody>
      {list.map(i => { const a = access(i, u.upn); return <tr key={i.id}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n={TYPE_ICON[i.type]} s={16} /><b>{i.name}</b></span></td><td>{TYPE_NAME[i.type]}</td><td>{ws(i.wsId)?.name}</td><td>{i.endorsement ?? '—'}</td><td>{i.label ?? '—'}</td><td>{a.build ? 'Build' : a.read ? 'Read' : 'None'}</td>
        <td>{a.read ? <button className="btn sm" onClick={() => openItem(i)}>Open</button> : <button className="btn sm" onClick={() => { svc.change(() => { const owner = i.owner; mailAccess(owner, i); }); store.toast('Access request sent to the owner.'); }}>Request access</button>}</td></tr>; })}
    </tbody></table>
  </div>;
}
function mailAccess(owner: string, i: Item) { svc.get().inbox.unshift({ id: sid('m'), to: owner, at: now(), from: `${me().name} via Power BI`, subject: `Access request: ${i.name}`, body: `${me().name} (${me().upn}) asked for access to "${i.name}". Share it from Manage permissions, add them to the workspace, or include them in an app audience.` }); }

function LakehouseView({ it }: { it: Item }) {
  return <div className="svc-page">
    <div className="ws-head"><I n="lakehouse" s={30} /><div><h1>{it.name}</h1><span className="tiny">Lakehouse · {ws(it.wsId)?.name} <Badge it={it} /></span></div></div>
    <p>Delta tables: DimProduct, DimCustomer, DimStore, DimDate, FactSales. The SQL analytics endpoint is <code>contoso-sandbox.datawarehouse.fabric.microsoft.com</code> / ContosoLakehouse.</p>
    <p>To build a Direct Lake semantic model, open Power BI Desktop and use <b>Get data › Lakehouses (OneLake catalog)</b>, then choose <b>Direct Lake</b>. Direct Lake reads the Delta files in OneLake directly: no import refresh (only reframing) and no Power Query transformations; it needs Fabric capacity.</p>
  </div>;
}

export function wsOptions(min: 'Contributor' | 'Viewer' = 'Contributor'): Workspace[] {
  const u = me().upn;
  return svc.get().workspaces.filter(w => (w.personal ? w.personal === u : atLeast(roleIn(w, u), min)));
}
export const LICENSE_MODES: WsLicense[] = ['Pro', 'PPU', 'Premium', 'Fabric F2', 'Fabric F64'];
export { openReport };
