// Service pages: item settings (credentials, gateway, refresh, RLS, endorsement, labels), lineage and impact
// analysis, usage metrics, Admin portal, gateways, deployment pipelines, app editor, paginated report builder,
// Analyze in Excel, and Publish to web.
import React, { useMemo, useState } from 'react';
import { store } from '../store';
import { I } from '../ui/icons';
import { Toggle } from '../ui/common';
import { EChart } from '../ui/report/EChart';
import { svc, me, ws, item, access, can, roleIn, atLeast, Item, sid, now, log, principalLabel, sourceStatus, matchingConnections, refreshNow, maxRefreshes, modelData, invalidateData, mail, isMember, Gateway, GwConn, Pipeline, App, Audience, PaginatedDef, WsLicense, groupsOf } from './model';
import { nav, useSvc, openReport } from './nav';
import { Badge, fmtTime, Empty, TYPE_ICON, TYPE_NAME, openItem, LICENSE_MODES } from './Service';
import { withProject } from './Viewers';
import { LABELS, labelRank } from '../model/labels';
import { summarize, visualContext, fmt, formatFor, sortRows } from '../report/query';
import { FieldRef, Page, Visual } from '../model/types';
import { autoUnits } from '../core/format';
import { rlsFor } from './nav';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const err = (m: string | null) => { if (m) store.toast(m, 'error'); return !!m; };

// ---------------------------------------------------------------- endorsement + labels (shared by all item settings)
function Governance({ it }: { it: Item }) {
  const s = useSvc();
  const setLabel = (name: string | undefined) => {
    if (err(can('label', it))) return;
    if (!name && s.tenant.labelsMandatory) { store.toast('Your organization requires a sensitivity label on Power BI content (mandatory labeling).', 'error'); return; }
    const apply = () => svc.change(() => {
      it.label = name; log(`Label on ${it.name}: ${name ?? 'none'}`);
      // downstream inheritance: reports and dashboards built on this model get the label if theirs is lower
      if (it.type === 'SemanticModel' && name) for (const r of svc.get().items.filter(x => x.modelId === it.id)) if (labelRank(r.label) < labelRank(name)) r.label = name;
    });
    if (labelRank(name) < labelRank(it.label)) store.openDialog({ type: 'confirm', title: 'Justify the change', text: `You're lowering the sensitivity from ${it.label} to ${name ?? 'no label'}. A justification is recorded in the audit log.`, ok: 'Change', onOk: apply });
    else apply();
  };
  return <>
    <h3>Endorsement and discovery</h3>
    <div className="radio-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
      <label><input type="radio" checked={!it.endorsement} onChange={() => !err(can('promote', it)) && svc.change(() => { it.endorsement = undefined; })} />None</label>
      <label><input type="radio" checked={it.endorsement === 'Promoted'} onChange={() => !err(can('promote', it)) && svc.change(() => { it.endorsement = 'Promoted'; log(`Promoted ${it.name}`); })} /><b>Promoted</b> — anyone with write permission can promote content they think is ready to share.</label>
      <label><input type="radio" checked={it.endorsement === 'Certified'} onChange={() => !err(can('certify', it)) && svc.change(() => { it.endorsement = 'Certified'; log(`Certified ${it.name}`); })} /><b>Certified</b> — only people the Fabric admin authorizes ({s.tenant.certifiers.join(', ')}) after a quality review.</label>
      {it.type === 'SemanticModel' && <label><input type="radio" checked={it.endorsement === 'Master data'} onChange={() => !err(can('certify', it)) && svc.change(() => { it.endorsement = 'Master data'; })} /><b>Master data</b> — the single source of truth for core data (also admin-controlled).</label>}
    </div>
    <h3>Sensitivity label</h3>
    <select className="tx" style={{ maxWidth: 280 }} value={it.label ?? ''} onChange={e => setLabel(e.target.value || undefined)}><option value="">(None)</option>{LABELS.map(l => <option key={l.name}>{l.name}</option>)}</select>
    <p className="tiny">Labels come from Microsoft Purview Information Protection. A label set on a semantic model flows down to new reports and dashboards built on it, and travels with exports (Excel, PowerPoint, PDF, .pbix).</p>
  </>;
}

// ---------------------------------------------------------------- item settings
export function ItemSettings({ id, tab }: { id: string; tab?: string }) {
  const s = useSvc();
  const [t0, setT] = useState<string | undefined>(tab);
  const it = item(id); if (!it) return <Empty title="Not found" text="" />;
  if (!access(it, s.me).read) return <Empty title="No access" text={`${me().name} can't see this item.`} />;
  const tabs = it.type === 'SemanticModel' ? ['about', 'gateway', 'refresh', 'security', 'governance'] : ['about', 'governance'];
  const t = t0 && tabs.includes(t0) ? t0 : tabs[0];
  const reports = s.items.filter(x => x.modelId === it.id);
  return <div className="svc-page">
    <div className="ws-head"><I n={TYPE_ICON[it.type]} s={28} /><div><h1>{it.name}</h1><span className="tiny">{TYPE_NAME[it.type]} · {ws(it.wsId)?.name} · owner {principalLabel(it.takeover ?? it.owner)} <Badge it={it} /></span></div></div>
    {it.type === 'SemanticModel' && <div className="svc-toolbar">
      <button className="btn sm" onClick={() => { if (err(can('refresh', it))) return; let r: any; svc.change(() => { r = refreshNow(it); }); store.toast(r.status === 'Completed' ? `Refresh completed. ${r.msg ?? ''}` : `Refresh failed: ${r.msg}`, r.status === 'Completed' ? 'info' : 'error'); }}><span className="ib"><I n="refresh" s={14} />Refresh now</span></button>
      <button className="btn sm" onClick={() => { if (err(can('analyzeExcel', it))) return; nav.go({ page: 'excel', id: it.id }); }}><span className="ib"><I n="excel" s={14} />Analyze in Excel</span></button>
      <button className="btn sm" onClick={() => { if (err(can('share', it))) return; store.openDialog({ type: 'svcShare', id: it.id }); }}><span className="ib"><I n="share" s={14} />Share</span></button>
      <button className="btn sm" onClick={() => store.openDialog({ type: 'svcPerms', id: it.id })}>Manage permissions</button>
      <button className="btn sm" onClick={() => nav.go({ page: 'ws', id: it.wsId, view: 'lineage' })}><span className="ib"><I n="lineage" s={14} />Lineage</span></button>
      {reports[0] && <button className="btn sm" onClick={() => nav.go({ page: 'item', id: reports[0].id })}>Open report</button>}
    </div>}
    <div className="svc-tabs">{tabs.map(x => <button key={x} className={t === x ? 'on' : ''} onClick={() => setT(x)}>{({ about: 'About', gateway: 'Gateway and cloud connections', refresh: 'Refresh', security: 'Security (RLS)', governance: 'Endorsement and label' } as any)[x]}</button>)}</div>
    {t === 'about' && <About it={it} />}
    {t === 'gateway' && <GatewaySettings it={it} />}
    {t === 'refresh' && <RefreshSettings it={it} />}
    {t === 'security' && <Security it={it} />}
    {t === 'governance' && <Governance it={it} />}
  </div>;
}

function About({ it }: { it: Item }) {
  const s = useSvc();
  const owner = it.takeover ?? it.owner;
  return <div className="svc-form">
    <div className="field"><label>Description</label><textarea className="tx" rows={2} defaultValue={it.description ?? ''} onBlur={e => !err(can('editItem', it)) && svc.change(() => { it.description = e.target.value; })} /></div>
    <p>Owner: <b>{principalLabel(owner)}</b> {owner !== s.me && it.type === 'SemanticModel' && <button className="btn sm" onClick={() => { if (err(can('editItem', it))) return; svc.change(() => { it.takeover = s.me; log(`Took over ${it.name}`); }); store.toast('You took over the semantic model. Refresh now uses your credentials and gateway access, so re-enter cloud credentials.'); }}>Take over</button>}</p>
    {it.type === 'SemanticModel' && it.project && <>
      <p>Storage mode: <b>{[...new Set(it.project.model.tables.filter(t => !t.expression && !t.calculationGroup).map(t => t.storageMode ?? 'Import'))].join(', ') || 'Import'}</b> · Tables: {it.project.model.tables.length} · Measures: {it.project.model.measures.length} · RLS roles: {it.project.model.roles.length}</p>
      <p>Last refresh: {fmtTime(it.lastRefresh)}. Reports on this model: {s.items.filter(x => x.modelId === it.id).map(x => x.name).join(', ') || 'none'}.</p>
      <label className="row"><input type="checkbox" disabled={!['Premium', 'PPU', 'Fabric F64', 'Fabric F2'].includes(ws(it.wsId)!.license)} defaultChecked={['Premium', 'Fabric F64'].includes(ws(it.wsId)!.license)} />Large semantic model storage format <span className="tiny">(Premium / PPU / Fabric only; lets models grow beyond 10 GB and is needed for large incremental refresh models)</span></label>
    </>}
    {it.type === 'Report' && <>
      <p>Semantic model: <button className="linkbtn" onClick={() => nav.go({ page: 'settings', id: it.modelId! })}>{item(it.modelId!)?.name}</button> {item(it.modelId!)?.wsId !== it.wsId && <span className="tiny">(in another workspace)</span>}</p>
      <label className="row"><input type="checkbox" checked={!!it.settings?.personalize} onChange={e => !err(can('editItem', it)) && svc.change(() => { it.settings = { ...(it.settings ?? {}), personalize: e.target.checked }; })} />Personalize visuals — let readers change visual types and fields for themselves</label>
      <label className="row"><input type="checkbox" checked={it.settings?.persistentFilters !== false} onChange={e => !err(can('editItem', it)) && svc.change(() => { it.settings = { ...(it.settings ?? {}), persistentFilters: e.target.checked }; })} />Persistent filters — remember each reader's filters and slicers</label>
      <div className="field"><label>Export data</label><select className="tx" style={{ maxWidth: 520 }} value={it.settings?.exportData ?? 'underlying'} onChange={e => !err(can('editItem', it)) && svc.change(() => { it.settings = { ...(it.settings ?? {}), exportData: e.target.value as any }; })}>
        <option value="underlying">Summarized data, data with current layout and underlying data</option><option value="summarized">Summarized data and data with current layout</option><option value="none">No export allowed</option></select></div>
      {!s.tenant.exportData && <div className="warnbox tiny">The Fabric admin turned off export to Excel/CSV for the tenant, which overrides this setting.</div>}
    </>}
  </div>;
}

function GatewaySettings({ it }: { it: Item }) {
  const s = useSvc();
  const st = sourceStatus(it);
  const owner = it.takeover ?? it.owner;
  const personal = s.gateways.find(g => g.mode === 'Personal' && g.owner === owner);
  return <div className="svc-form">
    <p className="tiny">Cloud sources (Azure SQL Database, SharePoint Online, OneDrive, Fabric lakehouses, web APIs) connect directly with saved credentials. On-premises sources — SQL Server in your datacenter, file shares, local files — need an <b>on-premises data gateway</b>. Standard mode serves many users and supports Import, DirectQuery and live connections; personal mode is for one user and Import only.</p>
    <table className="grid-table svc-table"><thead><tr><th>Data source</th><th>Type</th><th>Connection</th><th>Status</th></tr></thead><tbody>
      {st.map(x => { const opts = matchingConnections(x.src); return <tr key={x.src.key}>
        <td>{x.src.label}</td><td>{x.cloud ? 'Cloud' : 'On-premises'} · {x.src.kind}</td>
        <td>{x.cloud ? <button className="btn sm" onClick={() => { if (err(can('refresh', it))) return; svc.change(() => { it.cloudCreds = { ...(it.cloudCreds ?? {}), [x.src.key]: true }; }); store.toast('Signed in with OAuth2. Credentials saved for this data source.'); }}>Edit credentials</button>
          : <select className="tx" value={it.gatewayMap?.[x.src.key] ?? ''} onChange={e => !err(can('refresh', it)) && svc.change(() => { it.gatewayMap = { ...(it.gatewayMap ?? {}), [x.src.key]: e.target.value || null }; })}>
            <option value="">(not mapped{personal ? ' · uses personal gateway' : ''})</option>
            {opts.map(o => <option key={o.c.id} value={o.c.id}>{o.g.name} › {o.c.name}</option>)}
          </select>}
          {!x.cloud && !opts.length && <div className="tiny">No gateway connection matches this source. A gateway admin can add one under Connections and gateways.</div>}</td>
        <td style={{ color: x.ok ? '#107c10' : '#a4262c' }}>{x.ok ? '✓ ' : '✗ '}{x.how}{x.fix && !x.ok ? <div className="tiny">{x.fix}</div> : null}</td>
      </tr>; })}
      {!st.length && <tr><td colSpan={4} className="subtle">No external data sources (entered data or calculated tables only).</td></tr>}
    </tbody></table>
    <h3>Personal gateway</h3>
    <p className="tiny">{personal ? `${principalLabel(owner)} has a personal gateway (${personal.name}, ${personal.online ? 'online' : 'offline'}). It refreshes Import models for its owner only.` : `${principalLabel(owner)} has no personal gateway.`}</p>
    {!personal && <button className="btn sm" onClick={() => svc.change(st2 => { st2.gateways.push({ id: sid('gw'), name: `${principalLabel(owner)} (personal mode)`, mode: 'Personal', owner, admins: [owner], online: true, conns: [] }); })}>Install a personal gateway for the owner</button>}
  </div>;
}

function RefreshSettings({ it }: { it: Item }) {
  const s = useSvc();
  const w = ws(it.wsId)!;
  const r = it.refresh ?? { enabled: false, frequency: 'Daily' as const, days: [], times: [], notifyOwner: true, contacts: [], failures: 0 };
  const set = (patch: Partial<typeof r>) => { if (err(can('refresh', it))) return; svc.change(() => { it.refresh = { ...r, ...patch }; }); };
  const max = maxRefreshes(w);
  const dq = it.project?.model.tables.some(t => t.storageMode === 'DirectQuery' || t.storageMode === 'DirectLake');
  const [newTime, setNewTime] = useState('07:00');
  const inc = it.project?.model.tables.find(t => (t as any).incremental);
  return <div className="svc-form">
    {dq && <div className="info tiny">This model uses {it.project!.model.tables.some(t => t.storageMode === 'DirectLake') ? 'Direct Lake (refresh reframes it to the latest Delta version)' : 'DirectQuery: visuals query the source directly, so there is no data to schedule. Scheduled refresh here only refreshes the query cache and dashboard tiles'}.</div>}
    <label className="row"><Toggle on={r.enabled} onChange={b => set({ enabled: b, failures: b ? 0 : r.failures })} /><b>Configure a refresh schedule</b></label>
    <div className="row"><label className="tiny">Refresh frequency</label><select className="tx" style={{ width: 140 }} value={r.frequency} onChange={e => set({ frequency: e.target.value as any })}><option>Daily</option><option>Weekly</option></select><span className="tiny">Time zone: (UTC) sandbox clock</span></div>
    {r.frequency === 'Weekly' && <div className="row">{DAYS.map(d => <label key={d} className="tiny"><input type="checkbox" checked={r.days.includes(d)} onChange={e => set({ days: e.target.checked ? [...r.days, d] : r.days.filter(x => x !== d) })} />{d.slice(0, 3)}</label>)}</div>}
    <div><b className="tiny">Time</b> {r.times.map(t => <span key={t} className="pill" style={{ display: 'inline-flex', margin: 2 }}>{t}<button className="iconbtn" style={{ height: 16 }} onClick={() => set({ times: r.times.filter(x => x !== t) })}><I n="close" s={10} /></button></span>)}</div>
    <div className="row"><input className="tx" type="time" step={1800} style={{ width: 120 }} value={newTime} onChange={e => setNewTime(e.target.value)} />
      <button className="btn sm" onClick={() => { if (r.times.length >= max) { store.toast(`You can schedule up to ${max} refreshes a day in this workspace (${w.license}${max === 8 ? ': shared capacity' : ''}). ${max === 8 ? 'Premium, PPU and Fabric capacity allow 48.' : ''}`, 'error'); return; } if (!r.times.includes(newTime)) set({ times: [...r.times, newTime].sort() }); }}>Add another time</button>
      <span className="tiny">{r.times.length} of {max} a day</span></div>
    <h3>Failure notifications</h3>
    <label className="row"><input type="checkbox" checked={r.notifyOwner} onChange={e => set({ notifyOwner: e.target.checked })} />Send refresh failure notifications to the semantic model owner ({principalLabel(it.takeover ?? it.owner)})</label>
    <div className="field"><label>These contacts</label><input className="tx" style={{ maxWidth: 420 }} defaultValue={r.contacts.join('; ')} placeholder="name@contoso.com; Group name" onBlur={e => set({ contacts: e.target.value.split(/[;,]/).map(x => x.trim()).filter(Boolean) })} /></div>
    {inc && <><h3>Incremental refresh</h3><p className="tiny">Policy on <b>{inc.name}</b> (defined in Power BI Desktop): store rows from the last {(inc as any).incremental.store} {(inc as any).incremental.storeUnit}, refresh the last {(inc as any).incremental.refresh} {(inc as any).incremental.refreshUnit}. The service creates partitions on the first refresh and then refreshes only the recent ones. Because the model was published with an incremental refresh policy, it can't be downloaded as a .pbix.</p></>}
    <h3>Refresh history</h3>
    <table className="grid-table svc-table"><thead><tr><th>Type</th><th>Start</th><th>Status</th><th>Message</th></tr></thead><tbody>
      {[...(it.history ?? [])].reverse().map((h, i) => <tr key={i}><td>{h.kind}</td><td>{fmtTime(h.at)}</td><td style={{ color: h.status === 'Completed' ? '#107c10' : '#a4262c' }}>{h.status}</td><td className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{h.msg ?? ''}</td></tr>)}
    </tbody></table>
    <p className="tiny">Use the clock in the top bar (+1 h, +1 day) to let scheduled refreshes run. After four consecutive failures, Power BI turns the schedule off and emails the owner. Schedules on models nobody has used for two months are paused.</p>
    <span hidden>{s.clock}</span>
  </div>;
}

function Security({ it }: { it: Item }) {
  const s = useSvc();
  const roles = it.project?.model.roles ?? [];
  const [add, setAdd] = useState<Record<string, string>>({});
  const principals = [...s.users.map(u => u.upn), ...s.groups.map(g => g.name)];
  const testAs = (role: string, upn?: string) => {
    const rep = s.items.find(x => x.modelId === it.id && x.type === 'Report');
    if (!rep) { store.toast('Publish a report on this model to test roles.', 'error'); return; }
    nav.go({ page: 'item', id: rep.id });
    setTimeout(() => openReport(rep, { viewAs: { roles: [role], user: upn ?? s.me } }), 50);
  };
  if (!roles.length) return <div className="svc-form"><p>This semantic model has no row-level security roles. Create roles in Power BI Desktop (Modeling › Manage roles), test them with View as, and publish. Then assign members here.</p></div>;
  return <div className="svc-form">
    <p className="tiny">Members you add here get only the rows their role allows. RLS applies to people with the <b>Viewer</b> role or <b>Read</b> permission (sharing, apps). Workspace Admins, Members and Contributors can edit the model, so RLS doesn't filter their data. Add security groups rather than individuals where you can.</p>
    {roles.map(r => <div key={r.name} className="rls-role">
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{r.name}</b><span className="row"><button className="btn sm" onClick={() => testAs(r.name)}>Test as role</button></span></div>
      <div className="tiny">{Object.entries(r.filters).map(([t, e]) => `${t}: ${e}`).join(' · ')}</div>
      <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>{(it.rls?.[r.name] ?? []).map(m => <span key={m} className="pill" style={{ display: 'inline-flex' }}>{principalLabel(m)}<button className="iconbtn" style={{ height: 16 }} onClick={() => !err(can('editItem', it)) && svc.change(() => { it.rls![r.name] = it.rls![r.name].filter(x => x !== m); })}><I n="close" s={10} /></button></span>)}</div>
      <div className="row"><select className="tx" style={{ width: 260 }} value={add[r.name] ?? ''} onChange={e => setAdd({ ...add, [r.name]: e.target.value })}><option value="">Add people or groups…</option>{principals.filter(p => !(it.rls?.[r.name] ?? []).includes(p)).map(p => <option key={p} value={p}>{principalLabel(p)}{p.includes('@') ? ` (${p})` : ' (group)'}</option>)}</select>
        <button className="btn sm" disabled={!add[r.name]} onClick={() => { if (err(can('editItem', it))) return; svc.change(() => { it.rls ??= {}; (it.rls[r.name] ??= []).push(add[r.name]); log(`Added ${add[r.name]} to RLS role ${r.name}`); }); setAdd({ ...add, [r.name]: '' }); }}>Add</button>
        {r.filters && Object.values(r.filters).some(e => /USERPRINCIPALNAME|USERNAME/.test(e)) && <select className="tx" style={{ width: 200 }} defaultValue="" onChange={e => e.target.value && testAs(r.name, e.target.value)}><option value="">Test as role + user…</option>{s.users.map(u => <option key={u.upn} value={u.upn}>{u.name}</option>)}</select>}
      </div>
    </div>)}
  </div>;
}

// ---------------------------------------------------------------- lineage + impact analysis
export function LineageView({ wsId }: { wsId: string }) {
  const s = useSvc();
  const w = ws(wsId)!;
  const items = s.items.filter(i => i.wsId === wsId);
  const models = s.items.filter(i => i.type === 'SemanticModel' && (i.wsId === wsId || items.some(r => r.modelId === i.id)));
  const [sel, setSel] = useState<string | null>(null);
  const srcs = [...new Map(models.flatMap(m => sourceStatus(m).map(x => [x.src.key, x] as const))).values()];
  const reports = s.items.filter(i => i.type === 'Report' && (i.wsId === wsId || models.some(m => m.id === i.modelId)));
  const dashes = s.items.filter(i => i.type === 'Dashboard' && (i.wsId === wsId || i.tiles?.some(t => reports.some(r => r.id === t.reportId))));
  const apps = s.apps.filter(a => a.wsId === wsId && a.published);
  const impact = sel ? (() => {
    const m = item(sel);
    if (m?.type !== 'SemanticModel') return null;
    const reps = s.items.filter(r => r.modelId === m.id);
    const ds = s.items.filter(d => d.tiles?.some(t => reps.some(r => r.id === t.reportId)));
    const viewers = new Set(reps.flatMap(r => r.views.map(v => v.upn)));
    return { m, reps, ds, wss: new Set([...reps, ...ds].map(x => x.wsId)), viewers };
  })() : null;
  const col = (title: string, nodes: React.ReactNode[]) => <div className="lin-col"><div className="tiny" style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>{nodes}</div>;
  const node = (it: Item) => <button key={it.id} className={`lin-node ${sel === it.id ? 'on' : ''}`} onClick={() => setSel(it.id)}><I n={TYPE_ICON[it.type]} s={16} /><span>{it.name}</span>{it.wsId !== wsId && <span className="tiny">{ws(it.wsId)?.name}</span>}<Badge it={it} /></button>;
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}><h1>{w.name} · Lineage view</h1><button className="btn sm" onClick={() => nav.go({ page: 'ws', id: wsId })}>List view</button></div>
    <div className="lineage">
      {col('Data sources', srcs.map(x => <div key={x.src.key} className="lin-node"><I n={x.src.kind === 'SQL' ? 'sql' : 'csv'} s={16} /><span>{x.src.label}</span><span className="tiny">{x.cloud ? 'cloud' : 'gateway'}</span></div>))}
      {col('Semantic models', models.map(node))}
      {col('Reports', reports.map(node))}
      {col('Dashboards', dashes.map(node))}
      {col('Apps', apps.map(a => <div key={a.id} className="lin-node"><I n="app" s={16} /><span>{a.name}</span></div>))}
    </div>
    {impact && <div className="impact"><h3>Impact analysis: {impact.m.name}</h3>
      <p>Changing or deleting this semantic model affects <b>{impact.reps.length}</b> report(s) and <b>{impact.ds.length}</b> dashboard(s) in <b>{impact.wss.size}</b> workspace(s), viewed by <b>{impact.viewers.size}</b> people recently.</p>
      <ul>{impact.reps.map(r => <li key={r.id}>{r.name} <span className="tiny">({ws(r.wsId)?.name})</span></li>)}{impact.ds.map(d => <li key={d.id}>{d.name} <span className="tiny">(dashboard, {ws(d.wsId)?.name})</span></li>)}</ul>
      <button className="btn sm" onClick={() => { svc.change(() => { for (const u of impact.viewers) mail(u, `Upcoming change to ${impact.m.name}`, `${me().name} is about to change the semantic model "${impact.m.name}", which content you use depends on.`); }); store.toast(`Notified ${impact.viewers.size} people.`); }}>Notify contacts</button>
    </div>}
    <p className="tiny">Select a semantic model to see its impact analysis: the downstream reports and dashboards, including ones in other workspaces.</p>
  </div>;
}

// ---------------------------------------------------------------- usage metrics
export function UsageMetrics({ id }: { id: string }) {
  const s = useSvc(); const it = item(id)!;
  const views = it.views;
  const byUser = [...views.reduce((m, v) => m.set(v.upn, (m.get(v.upn) ?? 0) + 1), new Map<string, number>())];
  const byDay = [...views.reduce((m, v) => { const k = new Date(v.at).toLocaleDateString(); return m.set(k, (m.get(k) ?? 0) + 1); }, new Map<string, number>())];
  const byPage = [...views.reduce((m, v) => { const n = it.report?.pages.find(p => p.id === v.page)?.name ?? '(unknown)'; return m.set(n, (m.get(n) ?? 0) + 1); }, new Map<string, number>())];
  if (!s.tenant.usageMetrics) return <Empty title="Usage metrics are off" text="The Fabric admin turned off usage metrics for content creators." />;
  return <div className="svc-page">
    <h1>Usage metrics: {it.name}</h1>
    <div className="row" style={{ gap: 12 }}>{[['Views', views.length], ['Viewers', byUser.length], ['Days with views', byDay.length]].map(([l, v]) => <div key={l as string} className="kpi-box"><div className="v">{v}</div><div className="tiny">{l}</div></div>)}</div>
    <div className="row" style={{ alignItems: 'stretch', gap: 12, marginTop: 12 }}>
      <div style={{ flex: 1, height: 240, position: 'relative', border: '1px solid var(--line)', borderRadius: 6 }}><EChart option={{ animation: false, title: { text: 'Views per day', textStyle: { fontSize: 12 } }, grid: { left: 40, right: 10, top: 30, bottom: 30 }, xAxis: { type: 'category', data: byDay.map(x => x[0]) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: byDay.map(x => x[1]) }] }} /></div>
      <div style={{ width: 280 }}><table className="grid-table svc-table"><thead><tr><th>Viewer</th><th>Views</th></tr></thead><tbody>{byUser.map(([u, n]) => <tr key={u}><td>{principalLabel(u)}</td><td>{n}</td></tr>)}</tbody></table>
        <table className="grid-table svc-table" style={{ marginTop: 8 }}><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>{byPage.map(([p, n]) => <tr key={p}><td>{p}</td><td>{n}</td></tr>)}</tbody></table></div>
    </div>
    <p className="tiny">The usage metrics report covers the last 30 days for reports and dashboards in the workspace. Admins see tenant-wide activity in the activity log and the Admin monitoring workspace.</p>
  </div>;
}

// ---------------------------------------------------------------- admin portal
export function AdminPortal() {
  const s = useSvc();
  const isAdmin = s.me === 'pat@contoso.com';
  const t = s.tenant;
  const set = (patch: Partial<typeof t>) => { if (!isAdmin) { store.toast('Only Fabric administrators can change tenant settings.', 'error'); return; } svc.change(() => Object.assign(t, patch)); };
  return <div className="svc-page">
    <h1>Admin portal</h1>
    {!isAdmin && <div className="warnbox">{me().name} isn't a Fabric administrator, so the settings are read-only.</div>}
    <h3>Tenant settings</h3>
    <div className="svc-form">
      <label className="row"><Toggle on={t.publishToWeb} onChange={b => set({ publishToWeb: b })} /><div><b>Publish to web</b><div className="tiny">Lets people create public embed codes. Anyone on the internet can view those reports with no sign-in; never use it for confidential data.</div></div></label>
      <label className="row"><Toggle on={t.exportData} onChange={b => set({ exportData: b })} /><div><b>Export to Excel / CSV</b><div className="tiny">Turning this off blocks export of visual data for the whole tenant, whatever each report allows.</div></div></label>
      <label className="row"><Toggle on={t.copilot} onChange={b => set({ copilot: b })} /><div><b>Users can use Copilot and other features powered by Azure OpenAI</b><div className="tiny">Copilot also needs the workspace on paid Fabric (F2 or larger) or Premium capacity.</div></div></label>
      <label className="row"><Toggle on={t.labelsMandatory} onChange={b => set({ labelsMandatory: b })} /><div><b>Require users to apply sensitivity labels (mandatory labeling)</b></div></label>
      <label className="row"><Toggle on={t.usageMetrics} onChange={b => set({ usageMetrics: b })} /><div><b>Usage metrics for content creators</b></div></label>
      <label className="row"><Toggle on={t.shareExternal} onChange={b => set({ shareExternal: b })} /><div><b>Guest users can access Microsoft Fabric (B2B)</b></div></label>
      <div className="field"><label><b>Certification</b>: people or groups who can certify content</label><input className="tx" style={{ maxWidth: 360 }} defaultValue={t.certifiers.join('; ')} onBlur={e => set({ certifiers: e.target.value.split(/[;,]/).map(x => x.trim()).filter(Boolean) })} /></div>
      <div className="field"><label><b>Automatic page refresh</b>: minimum refresh interval (seconds)</label><input className="tx" type="number" style={{ width: 120 }} value={t.aprMinSeconds} onChange={e => set({ aprMinSeconds: Math.max(1, +e.target.value) })} /></div>
    </div>
    <h3>Users (sandbox directory)</h3>
    <table className="grid-table svc-table"><thead><tr><th>Name</th><th>User principal name</th><th>License</th><th>Groups</th></tr></thead><tbody>
      {s.users.map(u => <tr key={u.upn}><td>{u.name}</td><td>{u.upn}</td><td><select className="tx" value={u.license} onChange={e => { if (!isAdmin) { store.toast('Only Fabric administrators (or license admins) can assign licenses.', 'error'); return; } svc.change(() => { u.license = e.target.value as any; }); }}><option>Free</option><option>Pro</option><option>PPU</option></select></td><td>{groupsOf(u.upn).join(', ')}</td></tr>)}
    </tbody></table>
    <h3>Audit log (sandbox)</h3>
    <div style={{ maxHeight: 240, overflow: 'auto' }}><table className="grid-table svc-table"><tbody>{s.log.slice(0, 80).map((l, i) => <tr key={i}><td className="tiny">{fmtTime(l.at)}</td><td>{principalLabel(l.who)}</td><td>{l.what}</td></tr>)}</tbody></table></div>
  </div>;
}

// ---------------------------------------------------------------- gateways
export function Gateways() {
  const s = useSvc();
  const [g, setG] = useState(s.gateways[0]?.id);
  const gw = s.gateways.find(x => x.id === g);
  const isAdmin = gw && gw.admins.some(a => isMember(s.me, a));
  const [nc, setNc] = useState<Partial<GwConn>>({ kind: 'SQL', auth: 'Windows', privacy: 'Organizational' });
  return <div className="svc-page">
    <h1>Manage connections and gateways</h1>
    <div className="row" style={{ alignItems: 'stretch', gap: 12 }}>
      <div style={{ width: 260 }}>{s.gateways.map(x => <button key={x.id} className={`lin-node ${x.id === g ? 'on' : ''}`} onClick={() => setG(x.id)}><I n="gateway" s={16} /><span>{x.name}</span><span className="tiny">{x.mode} · {x.online ? 'online' : 'offline'}</span></button>)}</div>
      {gw && <div style={{ flex: 1 }}>
        <h3>{gw.name} <span className="tiny">{gw.mode} mode · admins: {gw.admins.map(principalLabel).join(', ')}</span></h3>
        <label className="row"><Toggle on={gw.online} onChange={b => isAdmin ? svc.change(() => { gw.online = b; }) : store.toast('Only gateway admins can change this.', 'error')} />Gateway machine is {gw.online ? 'online' : 'offline'} (simulate an outage)</label>
        {gw.mode === 'Personal' ? <p className="tiny">A personal gateway has no shared connections: it uses the owner's credentials for their own Import semantic models only, and can't be used for DirectQuery or by other people.</p> : <>
          <table className="grid-table svc-table"><thead><tr><th>Connection</th><th>Type</th><th>Server / path</th><th>Authentication</th><th>Privacy</th><th>Users</th></tr></thead><tbody>
            {gw.conns.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.kind}</td><td>{c.path}{c.db ? `; ${c.db}` : ''}</td><td>{c.auth}</td><td>{c.privacy}</td>
              <td>{c.users.map(principalLabel).join(', ')} {isAdmin && <button className="btn sm" onClick={() => { const p = prompt('Add a user or group (UPN or group name)'); if (p) svc.change(() => { c.users.push(p.trim()); }); }}>Manage users</button>}</td></tr>)}
          </tbody></table>
          {isAdmin ? <div className="svc-form" style={{ marginTop: 10 }}><b>New connection</b>
            <div className="row"><select className="tx" style={{ width: 120 }} value={nc.kind} onChange={e => setNc({ ...nc, kind: e.target.value as any })}><option>SQL</option><option>File</option><option>Folder</option></select>
              <input className="tx" style={{ width: 160 }} placeholder="Connection name" value={nc.name ?? ''} onChange={e => setNc({ ...nc, name: e.target.value })} />
              <input className="tx" style={{ width: 240 }} placeholder={nc.kind === 'SQL' ? 'Server (e.g. localhost)' : 'Path (e.g. C:\\Sandbox\\Files\\Sales.csv)'} value={nc.path ?? ''} onChange={e => setNc({ ...nc, path: e.target.value })} />
              {nc.kind === 'SQL' && <input className="tx" style={{ width: 140 }} placeholder="Database" value={nc.db ?? ''} onChange={e => setNc({ ...nc, db: e.target.value })} />}
              <select className="tx" style={{ width: 110 }} value={nc.auth} onChange={e => setNc({ ...nc, auth: e.target.value as any })}><option>Windows</option><option>Basic</option></select>
              <button className="btn sm primary" disabled={!nc.name || !nc.path} onClick={() => { svc.change(() => { gw.conns.push({ id: sid('gc'), name: nc.name!, kind: nc.kind!, path: nc.path!, db: nc.db, auth: nc.auth!, users: [s.me], privacy: nc.privacy ?? 'Organizational' }); }); setNc({ kind: 'SQL', auth: 'Windows', privacy: 'Organizational' }); }}>Create</button></div>
            <div className="tiny">The path or server and database must match the semantic model's source exactly for the connection to be offered in its settings.</div></div>
            : <p className="tiny">{me().name} isn't an admin of this gateway, so they can't add connections. Ask a gateway admin to add the data source and grant you access as a user.</p>}
        </>}
      </div>}
    </div>
  </div>;
}

// ---------------------------------------------------------------- deployment pipelines
export function Pipelines({ id }: { id?: string }) {
  const s = useSvc();
  const p = s.pipelines.find(x => x.id === id) ?? (id ? undefined : s.pipelines[0]);
  const myWs = s.workspaces.filter(w => !w.personal && atLeast(roleIn(w, s.me), 'Admin'));
  const create = () => { const name = prompt('Pipeline name', 'Sales pipeline'); if (!name) return; let nid = ''; svc.change(st => { nid = sid('pl'); st.pipelines.push({ id: nid, name, stages: [{ name: 'Development' }, { name: 'Test' }, { name: 'Production' }], rules: [], history: [] }); }); nav.go({ page: 'pipelines', id: nid }); };
  const deploy = (from: number) => {
    const src = ws(p!.stages[from].wsId ?? ''), dst = ws(p!.stages[from + 1].wsId ?? '');
    if (!src || !dst) { store.toast('Assign a workspace to both stages first.', 'error'); return; }
    const msg = can('createPipeline', dst) ?? can('createPipeline', src); if (msg) { store.toast(msg, 'error'); return; }
    if (!atLeast(roleIn(dst, s.me), 'Contributor')) { store.toast(`Deploying needs at least Contributor on ${dst.name}.`, 'error'); return; }
    svc.change(st => {
      const moved: string[] = [];
      const idMap = new Map<string, string>();
      for (const it of st.items.filter(x => x.wsId === src.id && x.type !== 'Lakehouse').sort((a, b) => (a.type === 'SemanticModel' ? -1 : 1) - (b.type === 'SemanticModel' ? -1 : 1))) {
        let target = st.items.find(x => x.wsId === dst.id && x.name === it.name && x.type === it.type);
        const copy: Item = JSON.parse(JSON.stringify(it));
        copy.wsId = dst.id; copy.perms = []; copy.views = target?.views ?? []; copy.modified = now();
        if (copy.modelId) copy.modelId = idMap.get(copy.modelId) ?? copy.modelId;
        // deployment rules change data sources or parameters in the target stage
        for (const r of p!.rules.filter(x => x.stage === from + 1 && x.item === it.name)) {
          if (!copy.project) continue;
          for (const q of copy.project.queries) {
            if (r.kind === 'dataSource' && r.from) q.code = q.code.split(`"${r.from}"`).join(`"${r.to}"`);
            if (r.kind === 'parameter' && r.param && q.name === r.param) q.code = q.code.replace(/^\s*("(?:[^"]|"")*"|[^\s]+)(\s+meta)/, `"${r.to.replace(/"/g, '""')}"$2`);
          }
        }
        if (target) { copy.id = target.id; copy.rls = target.rls ?? copy.rls; copy.refresh = target.refresh ?? copy.refresh; copy.gatewayMap = target.gatewayMap ?? copy.gatewayMap; Object.assign(target, copy); }
        else { copy.id = sid(it.type === 'SemanticModel' ? 'sm' : 'rp'); st.items.push(copy); target = copy; }
        idMap.set(it.id, target.id); invalidateData(target.id); moved.push(it.name);
      }
      p!.history.unshift({ at: now(), from, to: from + 1, items: moved, by: st.me });
      log(`Deployed ${moved.length} items from ${src.name} to ${dst.name}`);
    });
    store.toast(`Deployed to ${p!.stages[from + 1].name}. Data isn't copied: refresh the semantic models in the target stage.`);
  };
  return <div className="svc-page">
    <div className="row" style={{ justifyContent: 'space-between' }}><h1>Deployment pipelines</h1><button className="btn primary" onClick={create}>+ New pipeline</button></div>
    <div className="row">{s.pipelines.map(x => <button key={x.id} className={`btn sm ${x.id === p?.id ? 'primary' : ''}`} onClick={() => nav.go({ page: 'pipelines', id: x.id })}>{x.name}</button>)}</div>
    {!p ? <p className="subtle">Deployment pipelines move content from Development to Test to Production workspaces, with rules that change data sources or parameter values per stage. Every workspace in a pipeline must be on Premium, PPU or Fabric capacity.</p> : <>
      <div className="pipeline">{p.stages.map((st, i) => {
        const w = ws(st.wsId ?? '');
        const items = s.items.filter(x => x.wsId === st.wsId);
        const prev = i > 0 ? s.items.filter(x => x.wsId === p.stages[i - 1].wsId) : [];
        const diff = i > 0 && w ? prev.filter(x => { const t = items.find(y => y.name === x.name && y.type === x.type); return !t || JSON.stringify(t.project?.model ?? t.report) !== JSON.stringify(x.project?.model ?? x.report); }).length : 0;
        return <div key={i} className="stage">
          <b>{st.name}</b>
          <select className="tx" value={st.wsId ?? ''} onChange={e => svc.change(() => { st.wsId = e.target.value || undefined; })}><option value="">Assign a workspace…</option>{myWs.map(x => <option key={x.id} value={x.id}>{x.name} ({x.license})</option>)}</select>
          {w && can('createPipeline', w) && <div className="warnbox tiny">{can('createPipeline', w)}</div>}
          <div className="tiny">{items.length} items{i > 0 && w ? ` · ${diff ? `${diff} different from ${p.stages[i - 1].name}` : 'same as previous stage'}` : ''}</div>
          {items.map(x => <div key={x.id} className="tiny"><I n={TYPE_ICON[x.type]} s={12} /> {x.name}</div>)}
          {i < p.stages.length - 1 && <button className="btn sm primary" onClick={() => deploy(i)}>Deploy to {p.stages[i + 1].name} →</button>}
          {i > 0 && <button className="btn sm" onClick={() => store.openDialog({ type: 'svcRule', pipelineId: p.id, stage: i })}>Deployment rules ({p.rules.filter(r => r.stage === i).length})</button>}
        </div>;
      })}</div>
      <h3>Deployment history</h3>
      <table className="grid-table svc-table"><tbody>{p.history.map((h, i) => <tr key={i}><td>{fmtTime(h.at)}</td><td>{p.stages[h.from].name} → {p.stages[h.to].name}</td><td>{h.items.join(', ')}</td><td>{principalLabel(h.by)}</td></tr>)}</tbody></table>
    </>}
  </div>;
}

// ---------------------------------------------------------------- app editor
export function AppEditor({ wsId }: { wsId: string }) {
  const s = useSvc();
  const w = ws(wsId)!;
  const existing = s.apps.find(a => a.wsId === wsId);
  const [app, setApp] = useState<App>(() => existing ? JSON.parse(JSON.stringify(existing)) : { id: sid('app'), wsId, name: w.name, description: '', color: '#118dff', audiences: [{ name: 'Entire organization', items: [], members: ['All Employees'] }], allowBuild: false, allowReshare: false, allowCopy: false, installAuto: false, installed: [] });
  const [tab, setTab] = useState<'setup' | 'content' | 'audience'>('setup');
  const [aud, setAud] = useState(0);
  const content = s.items.filter(i => i.wsId === wsId && ['Report', 'Dashboard', 'PaginatedReport'].includes(i.type));
  const publish = () => {
    const m = can('publishApp', w); if (m) { store.toast(m, 'error'); return; }
    svc.change(st => {
      const a: App = { ...app, published: now(), snapshot: Object.fromEntries(content.filter(c => app.audiences.some(au => au.items.includes(c.id))).map(c => [c.id, { name: c.name, type: c.type, report: c.report ? JSON.parse(JSON.stringify(c.report)) : undefined, modelId: c.modelId, tiles: c.tiles ? JSON.parse(JSON.stringify(c.tiles)) : undefined, rdl: c.rdl, modified: c.modified }])) };
      if (a.installAuto) a.installed = [...new Set([...a.installed, ...st.users.filter(u => a.audiences.some(au => au.members.some(mm => isMember(u.upn, mm)))).map(u => u.upn)])];
      st.apps = [...st.apps.filter(x => x.wsId !== wsId), a];
      for (const u of st.users) if (a.audiences.some(au => au.members.some(mm => isMember(u.upn, mm)))) mail(u.upn, `${existing?.published ? 'Updated' : 'New'} app: ${a.name}`, `${me().name} ${existing?.published ? 'updated' : 'published'} the app "${a.name}". ${a.installAuto ? 'It was installed for you automatically.' : 'Get it from Apps › Get apps.'}`);
      log(`${existing?.published ? 'Updated' : 'Published'} app ${a.name}`);
    });
    store.toast(existing?.published ? 'App updated. People now see the current version of the content.' : 'App published.');
    nav.go({ page: 'ws', id: wsId });
  };
  const A = app.audiences[aud];
  const principals = [...s.users.map(u => u.upn), ...s.groups.map(g => g.name)];
  return <div className="svc-page">
    <h1>{existing?.published ? 'Update app' : 'Create app'} · {w.name}</h1>
    <div className="svc-tabs">{(['setup', 'content', 'audience'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'setup' ? 'Setup' : t === 'content' ? 'Content' : 'Audience'}</button>)}</div>
    {tab === 'setup' && <div className="svc-form">
      <div className="field"><label>App name</label><input className="tx" style={{ maxWidth: 360 }} value={app.name} onChange={e => setApp({ ...app, name: e.target.value })} /></div>
      <div className="field"><label>Description</label><textarea className="tx" rows={2} style={{ maxWidth: 520 }} value={app.description} onChange={e => setApp({ ...app, description: e.target.value })} /></div>
      <div className="field"><label>Theme color</label><input type="color" className="color-swatch" value={app.color} onChange={e => setApp({ ...app, color: e.target.value })} /></div>
      <p className="tiny">A workspace can publish one app. Use audiences to show different content to different groups.</p>
    </div>}
    {tab === 'content' && <div className="svc-form"><p className="tiny">Choose what goes into the app. Each audience then shows all of it or a subset.</p>
      {content.map(c => <label key={c.id} className="row"><input type="checkbox" checked={app.audiences.some(au => au.items.includes(c.id))} onChange={e => setApp({ ...app, audiences: app.audiences.map((au, i) => (i === 0 || !e.target.checked ? { ...au, items: e.target.checked ? [...new Set([...au.items, c.id])] : au.items.filter(x => x !== c.id) } : au)) })} /><I n={TYPE_ICON[c.type]} s={16} />{c.name} <span className="tiny">{TYPE_NAME[c.type]}</span></label>)}
      {!content.length && <p className="subtle">No reports or dashboards in this workspace yet.</p>}
    </div>}
    {tab === 'audience' && <div className="svc-form">
      <div className="row">{app.audiences.map((au, i) => <button key={i} className={`btn sm ${i === aud ? 'primary' : ''}`} onClick={() => setAud(i)}>{au.name}</button>)}<button className="btn sm" onClick={() => { setApp({ ...app, audiences: [...app.audiences, { name: `New audience ${app.audiences.length}`, items: [], members: [] }] }); setAud(app.audiences.length); }}>+ New audience</button></div>
      {A && <>
        <div className="field"><label>Audience name</label><input className="tx" style={{ maxWidth: 300 }} value={A.name} onChange={e => setApp({ ...app, audiences: app.audiences.map((au, i) => (i === aud ? { ...au, name: e.target.value } : au)) })} /></div>
        <b className="tiny">Content this audience sees</b>
        {content.filter(c => app.audiences.some(au => au.items.includes(c.id)) || A.items.includes(c.id)).map(c => <label key={c.id} className="row"><input type="checkbox" checked={A.items.includes(c.id)} onChange={e => setApp({ ...app, audiences: app.audiences.map((au, i) => (i === aud ? { ...au, items: e.target.checked ? [...au.items, c.id] : au.items.filter(x => x !== c.id) } : au)) })} />{c.name}</label>)}
        <b className="tiny">Who has access</b>
        <div className="row" style={{ flexWrap: 'wrap' }}>{A.members.map(mm => <span key={mm} className="pill" style={{ display: 'inline-flex' }}>{principalLabel(mm)}<button className="iconbtn" style={{ height: 16 }} onClick={() => setApp({ ...app, audiences: app.audiences.map((au, i) => (i === aud ? { ...au, members: au.members.filter(x => x !== mm) } : au)) })}><I n="close" s={10} /></button></span>)}</div>
        <select className="tx" style={{ maxWidth: 300 }} value="" onChange={e => e.target.value && setApp({ ...app, audiences: app.audiences.map((au, i) => (i === aud ? { ...au, members: [...au.members, e.target.value] } : au)) })}><option value="">Add people or groups…</option>{principals.filter(p => !A.members.includes(p)).map(p => <option key={p} value={p}>{principalLabel(p)}</option>)}</select>
        {app.audiences.length > 1 && <button className="btn sm" onClick={() => { setApp({ ...app, audiences: app.audiences.filter((_x, i) => i !== aud) }); setAud(0); }}>Delete audience</button>}
      </>}
      <h3>Advanced</h3>
      <label className="row"><input type="checkbox" checked={app.allowBuild} onChange={e => setApp({ ...app, allowBuild: e.target.checked })} />Allow people to build content with the semantic models in this app (Build permission)</label>
      <label className="row"><input type="checkbox" checked={app.allowCopy} onChange={e => setApp({ ...app, allowCopy: e.target.checked })} />Allow people to make a copy of the reports in this app</label>
      <label className="row"><input type="checkbox" checked={app.allowReshare} onChange={e => setApp({ ...app, allowReshare: e.target.checked })} />Allow people to share the semantic models in this app (Reshare)</label>
      <label className="row"><input type="checkbox" checked={app.installAuto} onChange={e => setApp({ ...app, installAuto: e.target.checked })} />Install this app automatically (if the admin allows it)</label>
      <p className="tiny">App users get Read on the content. RLS on the semantic model still applies to them. Workspace members see the workspace itself, not just the app.</p>
    </div>}
    <div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={publish}>{existing?.published ? 'Update app' : 'Publish app'}</button><button className="btn" onClick={() => nav.go({ page: 'ws', id: wsId })}>Cancel</button></div>
  </div>;
}

// ---------------------------------------------------------------- paginated report builder (Power BI Report Builder, simplified)
export function PaginatedEditor({ id, wsId }: { id?: string; wsId: string }) {
  const s = useSvc();
  const existing = id ? item(id) : undefined;
  const models = s.items.filter(i => i.type === 'SemanticModel' && access(i, s.me).build);
  const [name, setName] = useState(existing?.name ?? 'Invoice list');
  const [def, setDef] = useState<PaginatedDef>(existing?.rdl ?? { modelId: models[0]?.id ?? '', title: 'Sales by store', columns: [], header: 'Contoso · [&ExecutionTime]', footer: 'Page [&PageNumber] of [&TotalPages]', orientation: 'Portrait', rowsPerPage: 25 });
  const model = item(def.modelId);
  const fields: { table: string; column?: string; measure?: string; label: string }[] = model?.project ? [...model.project.model.measures.map(m => ({ table: m.table, measure: m.name, label: m.name })), ...model.project.model.tables.filter(t => !t.hidden).flatMap(t => t.columns.filter(c => !c.hidden).map(c => ({ table: t.name, column: c.name, label: c.name })))] : [];
  const save = () => {
    if (!def.columns.length) { store.toast('Add at least one column to the table.', 'error'); return; }
    svc.change(st => { if (existing) { existing.rdl = def; existing.name = name; existing.modified = now(); } else st.items.push({ id: sid('pr'), wsId, type: 'PaginatedReport', name, owner: st.me, created: now(), modified: now(), perms: [], views: [], rdl: def, label: model?.label }); log(`Saved paginated report ${name}`); });
    nav.go({ page: 'ws', id: wsId });
  };
  return <div className="svc-page">
    <h1>Power BI Report Builder (sandbox) · {name}</h1>
    <p className="tiny">Paginated reports (.rdl) are pixel-perfect, printable layouts that render every row across as many pages as needed, with page headers and footers. Use them for invoices, statements and operational lists. Build them in Power BI Report Builder and publish to a workspace (available with Pro or capacity).</p>
    <div className="svc-form">
      <div className="row"><div className="field"><label>Report name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label>Data source (semantic model you have Build on)</label><select className="tx" value={def.modelId} onChange={e => setDef({ ...def, modelId: e.target.value, columns: [] })}>{models.map(m => <option key={m.id} value={m.id}>{m.name} ({ws(m.wsId)?.name})</option>)}</select></div></div>
      <div className="field"><label>Title</label><input className="tx" style={{ maxWidth: 360 }} value={def.title} onChange={e => setDef({ ...def, title: e.target.value })} /></div>
      <b className="tiny">Table (tablix) columns</b>
      <div className="row" style={{ flexWrap: 'wrap' }}>{def.columns.map((c, i) => <span key={i} className="pill" style={{ display: 'inline-flex' }}>{c.label}<button className="iconbtn" style={{ height: 16 }} onClick={() => setDef({ ...def, columns: def.columns.filter((_x, j) => j !== i) })}><I n="close" s={10} /></button></span>)}</div>
      <select className="tx" style={{ maxWidth: 360 }} value="" onChange={e => { const f = fields.find(x => `${x.table}|${x.label}` === e.target.value); if (f) setDef({ ...def, columns: [...def.columns, f] }); }}><option value="">Add a field…</option>{fields.map(f => <option key={`${f.table}|${f.label}`} value={`${f.table}|${f.label}`}>{f.measure ? `[${f.measure}]` : `${f.table}[${f.column}]`}</option>)}</select>
      <div className="row"><label className="tiny">Parameter (filter)</label><select className="tx" style={{ width: 260 }} value={def.param ? `${def.param.table}|${def.param.column}` : ''} onChange={e => { const [t, c] = e.target.value.split('|'); setDef({ ...def, param: e.target.value ? { table: t, column: c, label: c } : undefined }); }}><option value="">(none)</option>{fields.filter(f => f.column).map(f => <option key={`${f.table}|${f.column}`} value={`${f.table}|${f.column}`}>{f.table}[{f.column}]</option>)}</select></div>
      <div className="field"><label>Page header</label><input className="tx" style={{ maxWidth: 480 }} value={def.header} onChange={e => setDef({ ...def, header: e.target.value })} /></div>
      <div className="field"><label>Page footer (use [&PageNumber], [&TotalPages], [&ExecutionTime], [&UserID])</label><input className="tx" style={{ maxWidth: 480 }} value={def.footer} onChange={e => setDef({ ...def, footer: e.target.value })} /></div>
      <div className="row"><select className="tx" style={{ width: 140 }} value={def.orientation} onChange={e => setDef({ ...def, orientation: e.target.value as any })}><option>Portrait</option><option>Landscape</option></select><label className="tiny">Rows per page <input className="tx" type="number" style={{ width: 70 }} value={def.rowsPerPage} onChange={e => setDef({ ...def, rowsPerPage: Math.max(5, +e.target.value) })} /></label></div>
      <div className="row"><button className="btn primary" onClick={save}>Publish</button><button className="btn" onClick={() => nav.go({ page: 'ws', id: wsId })}>Cancel</button></div>
    </div>
  </div>;
}

// ---------------------------------------------------------------- Analyze in Excel (a PivotTable over a live connection)
export function ExcelPivot({ id }: { id: string }) {
  const s = useSvc();
  const it = item(id)!;
  const [rows, setRows] = useState<FieldRef[]>([]);
  const [vals, setVals] = useState<FieldRef[]>([]);
  const data = useMemo(() => {
    if (!vals.length) return null;
    try {
      return withProject({ ...modelData(it) }, rlsFor(it, s.me), () => {
        const page: Page = { id: 'x', name: 'x', visuals: [], filters: [] }; const v: Visual = { id: 'x', type: 'table', x: 0, y: 0, w: 0, h: 0, wells: {}, filters: [], format: {} };
        const r = summarize(store, rows, vals, visualContext(store, page, v));
        return { cols: r.cols.map(c => c.label), rows: sortRows(store, r.rows, rows).slice(0, 500).map(row => row.map((x, i) => fmt(x, formatFor(store.project.model, r.cols[i].field), r.cols[i].field))) };
      });
    } catch (e) { return { cols: [], rows: [], error: (e as Error).message }; }
  }, [rows, vals]);
  const m = it.project?.model;
  return <div className="svc-page excel">
    <h1><I n="excel" s={22} /> {it.name}.xlsx · PivotTable (live connection)</h1>
    <p className="tiny">Analyze in Excel creates a workbook with a live connection to the semantic model. It needs Build permission; measures appear in Values and RLS applies to the person using Excel. Column fields can't be summarized: only measures go in Values.</p>
    <div className="row" style={{ alignItems: 'stretch', gap: 12 }}>
      <div className="xl-grid">{data?.cols.length ? <table className="grid-table"><thead><tr>{data.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{data.rows.map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table> : <div className="subtle" style={{ padding: 20 }}>{(data as any)?.error ?? 'Choose fields in the PivotTable Fields pane.'}</div>}</div>
      <div className="pane" style={{ width: 260 }}><div className="pane-h"><span>PivotTable Fields</span></div><div className="pane-body">
        {m?.measures.filter(x => !x.hidden).map(x => <label key={x.name} className="row tiny"><input type="checkbox" checked={vals.some(v => v.measure === x.name)} onChange={e => setVals(e.target.checked ? [...vals, { table: x.table, measure: x.name }] : vals.filter(v => v.measure !== x.name))} />Σ {x.name}</label>)}
        {m?.tables.filter(t => !t.hidden && !t.calculationGroup).map(t => <details key={t.name}><summary className="tiny">{t.name}</summary>{t.columns.filter(c => !c.hidden).map(c => <label key={c.name} className="row tiny" style={{ paddingLeft: 12 }}><input type="checkbox" checked={rows.some(r => r.table === t.name && r.column === c.name)} onChange={e => setRows(e.target.checked ? [...rows, { table: t.name, column: c.name }] : rows.filter(r => !(r.table === t.name && r.column === c.name)))} />{c.name}</label>)}</details>)}
      </div></div>
    </div>
  </div>;
}

// ---------------------------------------------------------------- Publish to web
export function PublicWeb({ id }: { id: string }) {
  const it = item(id);
  if (!it?.webCode) return <Empty title="Embed code not found" text="The embed code was deleted, so the public link no longer works." />;
  return <div className="svc-page">
    <div className="warnbox">Public view: anyone with this link can see the report without signing in. It isn't filtered by RLS and the content is cached publicly. Publish to web is only for public data.</div>
    <p>https://app.powerbi.com/view?r={it.webCode}</p>
    <button className="btn" onClick={() => nav.go({ page: 'item', id: it.id })}>Open the report</button>
  </div>;
}

export type { Gateway, Pipeline, Audience, WsLicense };
export { autoUnits, LICENSE_MODES };
