// Dialogs for the simulated service, plus Desktop's Publish and "Power BI semantic models" (live connection).
import React, { useState } from 'react';
import { store, Dialog as DialogT, uid } from '../store';
import { Dialog } from '../ui/common';
import { I } from '../ui/icons';
import { svc, me, ws, item, access, can, roleIn, atLeast, isMember, principalLabel, sid, now, log, mail, publish, modelData, Item, Role, Tile, Sub, licenseBlock, WsLicense } from './model';
import { nav } from './nav';
import { wsOptions, LICENSE_MODES, TYPE_ICON, TYPE_NAME, fmtTime } from './Service';
import { clearQueryCache } from '../ui/report/vhelpers';
import { Project } from '../model/types';

const close = () => store.closeDialog();
const principals = () => [...svc.get().users.map(u => u.upn), ...svc.get().groups.map(g => g.name)];
const PrincipalPicker = ({ value, onChange, exclude = [] }: { value: string; onChange: (v: string) => void; exclude?: string[] }) =>
  <select className="tx" value={value} onChange={e => onChange(e.target.value)}><option value="">Enter a name or email…</option>{principals().filter(p => !exclude.includes(p)).map(p => <option key={p} value={p}>{principalLabel(p)}{p.includes('@') ? ` · ${p} · ${svc.get().users.find(u => u.upn === p)?.license}` : ' (security group)'}</option>)}</select>;

function NewWorkspace() {
  const [name, setName] = useState('');
  const [lic, setLic] = useState<WsLicense>('Pro');
  return <Dialog title="Create a workspace" width={480} footer={<><button className="btn primary" disabled={!name.trim()} onClick={() => { if (svc.get().workspaces.some(w => w.name.toLowerCase() === name.trim().toLowerCase())) { store.toast('A workspace with that name already exists.', 'error'); return; } let id = ''; svc.change(s => { id = sid('ws'); s.workspaces.push({ id, name: name.trim(), license: lic, created: now(), access: [{ principal: s.me, role: 'Admin' }] }); log(`Created workspace ${name}`); }); close(); nav.go({ page: 'ws', id }); }}>Apply</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>Name</label><input className="tx" autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label>License mode</label><select className="tx" value={lic} onChange={e => setLic(e.target.value as WsLicense)}>{LICENSE_MODES.map(l => <option key={l}>{l}</option>)}</select></div>
    <div className="tiny">Pro: shared capacity; everyone needs Pro (or PPU) to use the content. PPU: everyone needs Premium Per User. Premium / Fabric F64+: free users can view. Fabric F2–F32: Fabric features and Copilot, but viewers still need Pro.</div>
  </Dialog>;
}

function NewDashboard({ d }: { d: DialogT }) {
  const [name, setName] = useState('Sales KPIs');
  return <Dialog title="Create a dashboard" width={420} footer={<><button className="btn primary" disabled={!name.trim()} onClick={() => { const w = ws(d.wsId)!; const m = can('publish', w); if (m) { store.toast(m, 'error'); return; } let id = ''; svc.change(s => { id = sid('db'); s.items.push({ id, wsId: d.wsId, type: 'Dashboard', name: name.trim(), owner: s.me, created: now(), modified: now(), perms: [], views: [], tiles: [] }); }); close(); nav.go({ page: 'item', id }); }}>Create</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>Dashboard name</label><input className="tx" autoFocus value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="tiny">Dashboards are created in the service only (not in Desktop). Add tiles by pinning visuals or live pages from reports.</div>
  </Dialog>;
}

function WsAccess({ d }: { d: DialogT }) {
  const w = ws(d.wsId)!; const s = svc.get();
  const myRole = roleIn(w, s.me);
  const [who, setWho] = useState(''); const [role, setRole] = useState<Role>('Viewer');
  const add = () => {
    const m = can('manageAccess', w); if (m) { store.toast(m, 'error'); return; }
    if (myRole === 'Member' && role === 'Admin') { store.toast('Members can add people as Member, Contributor or Viewer, but not as Admin.', 'error'); return; }
    svc.change(() => { w.access = [...w.access.filter(a => a.principal !== who), { principal: who, role }]; mail(who, `You were added to ${w.name}`, `${me().name} gave you the ${role} role in the workspace "${w.name}".`); log(`Added ${who} to ${w.name} as ${role}`); });
    setWho('');
  };
  return <Dialog title="Manage access" sub={w.name} width={620} footer={<button className="btn primary" onClick={close}>Close</button>}>
    <div className="row"><div style={{ flex: 1 }}><PrincipalPicker value={who} onChange={setWho} /></div><select className="tx" style={{ width: 140 }} value={role} onChange={e => setRole(e.target.value as Role)}>{(['Admin', 'Member', 'Contributor', 'Viewer'] as Role[]).map(r => <option key={r}>{r}</option>)}</select><button className="btn primary" disabled={!who} onClick={add}>Add</button></div>
    <table className="grid-table"><thead><tr><th>Name</th><th>Role</th><th /></tr></thead><tbody>
      {w.access.map(a => <tr key={a.principal}><td>{principalLabel(a.principal)} <span className="tiny">{a.principal.includes('@') ? a.principal : 'group'}</span></td>
        <td><select className="tx" value={a.role} onChange={e => { const r = e.target.value as Role; if (myRole !== 'Admin' && (r === 'Admin' || a.role === 'Admin')) { store.toast('Only Admins can add or change Admins.', 'error'); return; } if (!atLeast(myRole, 'Member')) { store.toast('Only Admins and Members can change roles.', 'error'); return; } svc.change(() => { a.role = r; }); }}>{(['Admin', 'Member', 'Contributor', 'Viewer'] as Role[]).map(r => <option key={r}>{r}</option>)}</select></td>
        <td><button className="iconbtn" onClick={() => { if (myRole !== 'Admin' && a.role === 'Admin') { store.toast('Only Admins can remove Admins.', 'error'); return; } if (!atLeast(myRole, 'Member')) { store.toast('Only Admins and Members can remove people.', 'error'); return; } if (a.role === 'Admin' && w.access.filter(x => x.role === 'Admin').length === 1) { store.toast('A workspace needs at least one Admin.', 'error'); return; } svc.change(() => { w.access = w.access.filter(x => x !== a); }); }} aria-label="Remove"><I n="close" s={12} /></button></td></tr>)}
    </tbody></table>
    <div className="tiny" style={{ lineHeight: 1.5 }}><b>Admin</b>: everything, including deleting the workspace and adding Admins. <b>Member</b>: add Members/Contributors/Viewers, publish and update the app, share items. <b>Contributor</b>: create, edit and delete content, publish reports; can't share unless given Reshare (and can update the app only if allowed). <b>Viewer</b>: view and interact; RLS applies. Assigning security groups is easier to manage than individuals.</div>
  </Dialog>;
}

function WsSettings({ d }: { d: DialogT }) {
  const w = ws(d.wsId)!;
  const ok = !can('wsSettings', w);
  const [lic, setLic] = useState<WsLicense>(w.license);
  return <Dialog title="Workspace settings" sub={w.name} width={560} footer={<><button className="btn primary" disabled={!ok} onClick={() => { svc.change(() => { w.license = lic; log(`License mode of ${w.name}: ${lic}`); }); close(); }}>Save</button><button className="btn" onClick={close}>Cancel</button>{ok && <button className="btn" onClick={() => store.openDialog({ type: 'confirm', title: 'Delete workspace', text: `Delete ${w.name} and all its content?`, ok: 'Delete', onOk: () => { svc.change(s => { s.items = s.items.filter(i => i.wsId !== w.id); s.workspaces = s.workspaces.filter(x => x.id !== w.id); s.apps = s.apps.filter(a => a.wsId !== w.id); }); close(); nav.go({ page: 'workspaces' }); } })}>Remove this workspace</button>}</>}>
    {!ok && <div className="warnbox">{can('wsSettings', w)}</div>}
    <div className="field"><label>Description</label><textarea className="tx" rows={2} disabled={!ok} defaultValue={w.description ?? ''} onBlur={e => svc.change(() => { w.description = e.target.value; })} /></div>
    <div className="field"><label>License mode</label><select className="tx" disabled={!ok} value={lic} onChange={e => setLic(e.target.value as WsLicense)}>{LICENSE_MODES.map(l => <option key={l}>{l}</option>)}</select></div>
    <label className="row"><input type="checkbox" disabled={!ok} checked={!!w.contributorsCanUpdateApp} onChange={e => svc.change(() => { w.contributorsCanUpdateApp = e.target.checked; })} />Allow contributors to update the app for this workspace</label>
    <div className="tiny">Capacity matters for: free users viewing content (Premium / F64+), refresh limits (8/day shared vs 48/day), deployment pipelines, large models, automatic page refresh change detection, paginated report subscriptions and Copilot (F2+ / P1).</div>
  </Dialog>;
}

function Share({ d }: { d: DialogT }) {
  const it = item(d.id)!;
  const [scope, setScope] = useState<'org' | 'existing' | 'specific'>('specific');
  const [who, setWho] = useState<string[]>([]); const [pick, setPick] = useState('');
  const [reshare, setReshare] = useState(true); const [build, setBuild] = useState(false);
  const [msg, setMsg] = useState('');
  const send = () => {
    const targets = scope === 'org' ? ['All Employees'] : who;
    if (scope !== 'existing' && !targets.length) { store.toast('Add at least one person or group.', 'error'); return; }
    const w = ws(it.wsId)!;
    svc.change(() => {
      for (const p of targets) {
        it.perms = [...it.perms.filter(x => !(x.principal === p && x.via !== 'app')), { principal: p, read: true, reshare, build, via: scope === 'specific' ? 'share' : 'link' }];
        // sharing a report also grants Read (and Build if chosen) on its semantic model
        const model = it.modelId ? item(it.modelId) : undefined;
        if (model && build) model.perms = [...model.perms.filter(x => x.principal !== p), { principal: p, read: true, build: true, reshare: false, via: 'share' }];
        mail(p, `${me().name} shared "${it.name}" with you`, `${msg ? msg + '\n\n' : ''}Open it in Power BI. ${reshare ? 'You can share it with others. ' : ''}${build ? 'You can build new content with its data. ' : ''}${licenseBlock(w, p.includes('@') ? p : 'pat@contoso.com') && p.includes('@') ? `\nNote: ${licenseBlock(w, p)}` : ''}`);
      }
      log(`Shared ${it.name} (${scope}) with ${targets.join(', ') || 'existing access'}`);
    });
    close(); store.toast(scope === 'existing' ? 'Link copied. It only works for people who already have access.' : `Shared with ${targets.map(principalLabel).join(', ')}.`);
  };
  return <Dialog title={`Send link`} sub={`${it.name} · ${TYPE_NAME[it.type]}`} width={560} footer={<><button className="btn primary" onClick={send}>Send</button><button className="btn" onClick={() => { void navigator.clipboard?.writeText(`https://app.powerbi.com/links/${it.id}`).catch(() => {}); store.toast('Link copied'); }}>Copy link</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>Link settings: who can use the link</label>
      <div className="radio-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <label><input type="radio" checked={scope === 'org'} onChange={() => setScope('org')} />People in your organization</label>
        <label><input type="radio" checked={scope === 'existing'} onChange={() => setScope('existing')} />People with existing access</label>
        <label><input type="radio" checked={scope === 'specific'} onChange={() => setScope('specific')} />Specific people</label>
      </div></div>
    {scope !== 'existing' && <>
      <label className="row"><input type="checkbox" checked={reshare} onChange={e => setReshare(e.target.checked)} />Allow recipients to share this {it.type === 'Dashboard' ? 'dashboard' : 'report'} (Reshare)</label>
      {it.type !== 'Dashboard' && <label className="row"><input type="checkbox" checked={build} onChange={e => setBuild(e.target.checked)} />Allow recipients to build content with the data associated with this {it.type === 'SemanticModel' ? 'semantic model' : 'report'} (Build)</label>}
    </>}
    {scope === 'specific' && <><div className="row"><div style={{ flex: 1 }}><PrincipalPicker value={pick} onChange={setPick} exclude={who} /></div><button className="btn" disabled={!pick} onClick={() => { setWho([...who, pick]); setPick(''); }}>Add</button></div>
      <div className="row" style={{ flexWrap: 'wrap' }}>{who.map(w => <span key={w} className="pill" style={{ display: 'inline-flex' }}>{principalLabel(w)}<button className="iconbtn" style={{ height: 16 }} onClick={() => setWho(who.filter(x => x !== w))}><I n="close" s={10} /></button></span>)}</div></>}
    <div className="field"><label>Message (optional)</label><input className="tx" value={msg} onChange={e => setMsg(e.target.value)} /></div>
    <div className="tiny">Sharing gives Read permission. Recipients need Pro (or PPU) unless the workspace is on Premium / Fabric F64+ capacity. RLS still applies to them. To share with many people, an app is usually better.</div>
  </Dialog>;
}

function Perms({ d }: { d: DialogT }) {
  const it = item(d.id)!; const w = ws(it.wsId)!;
  const s = svc.get();
  const rows = [
    ...w.access.map(a => ({ who: a.principal, perms: a.role === 'Viewer' ? 'Read' : a.role === 'Contributor' ? 'Read, Write, Build' : 'Read, Write, Build, Reshare', via: `Workspace ${a.role}`, remove: null as null | (() => void) })),
    ...it.perms.map(p => ({ who: p.principal, perms: ['Read', p.build && 'Build', p.reshare && 'Reshare', p.write && 'Write'].filter(Boolean).join(', '), via: p.via === 'app' ? 'App' : p.via === 'link' ? 'Sharing link' : 'Direct access', remove: () => svc.change(() => { it.perms = it.perms.filter(x => x !== p); }) })),
  ];
  return <Dialog title="Manage permissions" sub={`${it.name} · ${TYPE_NAME[it.type]}`} width={640} footer={<><button className="btn" onClick={() => { const m = can('share', it); if (m) store.toast(m, 'error'); else { close(); store.openDialog({ type: 'svcShare', id: it.id }); } }}>Grant access</button><button className="btn primary" onClick={close}>Close</button></>}>
    <table className="grid-table"><thead><tr><th>Name</th><th>Permissions</th><th>Granted through</th><th /></tr></thead><tbody>
      {rows.map((r, i) => <tr key={i}><td>{principalLabel(r.who)}</td><td>{r.perms}</td><td>{r.via}</td><td>{r.remove && <button className="btn sm" onClick={() => { const m = can('share', it); if (m) store.toast(m, 'error'); else r.remove!(); }}>Remove access</button>}</td></tr>)}
    </tbody></table>
    {it.type === 'SemanticModel' && <div className="tiny">Semantic model permissions: <b>Read</b> (view reports on it), <b>Build</b> (create reports, Analyze in Excel, DAX queries, live connections from Desktop), <b>Reshare</b>, <b>Write</b> (edit, refresh). Build doesn't let people edit the model or the workspace.</div>}
    <span hidden>{s.clock}</span>
  </Dialog>;
}

function Download({ d }: { d: DialogT }) {
  const it = item(d.id)!;
  const model = it.modelId ? item(it.modelId) : undefined;
  const inc = model?.project?.model.tables.some(t => (t as any).incremental);
  const other = model && model.wsId !== it.wsId;
  const blocked = inc ? 'This report\'s semantic model uses incremental refresh, so it can\'t be downloaded as a .pbix (the service holds partitions Desktop can\'t represent).' : !access(it, svc.get().me).write && !svc.get().apps.find(a => a.allowCopy) ? 'Downloading needs edit permission (Contributor or higher) or a copy permission.' : null;
  return <Dialog title="Download this file" sub={it.name} width={520} footer={<>{!blocked && <button className="btn primary" onClick={() => {
    const p: Project = { ...modelData(model!), name: it.name, report: JSON.parse(JSON.stringify(it.report)) };
    p.report.sensitivity = it.label;
    store.loadProject(JSON.parse(JSON.stringify({ ...p, model: { ...p.model, tables: p.model.tables.map(t => ({ ...t, rows: [] })) } })));
    close(); nav.go({ page: 'home' }); store.setUI({ app: 'desktop', view: 'report' }); clearQueryCache();
    store.toast(`Opened ${it.name} in Power BI Desktop${it.label ? ` (label ${it.label} kept)` : ''}.`);
  }}>{other ? 'A copy of your report with a live connection' : 'A copy of your report and data (.pbix)'}</button>}<button className="btn" onClick={close}>Cancel</button></>}>
    {blocked ? <div className="warnbox">{blocked}</div> : <div>The file opens in Power BI Desktop (in the sandbox it replaces the current Desktop file). {other ? 'Because the semantic model is in another workspace, the download is a live-connected report.' : ''} Sensitivity labels stay on downloaded files.</div>}
  </Dialog>;
}

function GetApps() {
  const s = svc.get();
  const avail = s.apps.filter(a => a.published && a.audiences.some(au => au.members.some(m => isMember(s.me, m))));
  return <Dialog title="Power BI apps" sub="Apps you have access to" width={560} footer={<button className="btn primary" onClick={close}>Close</button>}>
    {avail.map(a => <div key={a.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="row"><span className="app-logo" style={{ background: a.color }}>{a.name[0]}</span><b>{a.name}</b><span className="tiny">{ws(a.wsId)?.name} · {fmtTime(a.published)}</span></span>
      <button className="btn sm" disabled={a.installed.includes(s.me)} onClick={() => { svc.change(() => { a.installed.push(s.me); }); close(); nav.go({ page: 'app', id: a.id }); }}>{a.installed.includes(s.me) ? 'Installed' : 'Get it now'}</button></div>)}
    {!avail.length && <div className="subtle">No apps are available to {me().name}. They need to be in an app audience.</div>}
  </Dialog>;
}

function Pin({ d }: { d: DialogT }) {
  const s = svc.get();
  const rep = item(d.reportId)!;
  const v = d.visualId ? rep.report!.pages.flatMap(p => p.visuals).find(x => x.id === d.visualId) ?? store.findVisual(d.visualId) : undefined;
  const dashes = s.items.filter(i => i.type === 'Dashboard' && access(i, s.me).write);
  const [where, setWhere] = useState<'existing' | 'new'>(dashes.length ? 'existing' : 'new');
  const [dash, setDash] = useState(dashes[0]?.id ?? '');
  const [name, setName] = useState('Sales KPIs');
  const pin = () => {
    let target: Item | undefined;
    svc.change(st => {
      if (where === 'new') { target = { id: sid('db'), wsId: rep.wsId, type: 'Dashboard', name, owner: st.me, created: now(), modified: now(), perms: [], views: [], tiles: [], label: rep.label }; st.items.push(target); }
      else target = item(dash);
      const big = v && ['card', 'cardNew', 'kpi', 'gauge'].includes(v.type) ? { w: 1, h: 1 } : { w: 2, h: 2 };
      const tile: Tile = { id: sid('t'), title: v ? (v.format?.title || v.title || (v.wells.values?.[0]?.measure ?? v.type)) : `${rep.name} · ${store.page().name}`, reportId: rep.id, pageId: d.pageId, visualId: v?.id, kind: v ? 'visual' : 'page', visualType: v?.type, ...(v ? big : { w: 3, h: 2 }), alerts: [] };
      target!.tiles = [...(target!.tiles ?? []), tile];
      if (rep.label && (!target!.label)) target!.label = rep.label;
      log(`Pinned ${tile.title} to ${target!.name}`);
    });
    close(); store.toast(`Pinned to ${target!.name}.`);
  };
  return <Dialog title={v ? 'Pin to dashboard' : 'Pin to a dashboard (live page)'} width={480} footer={<><button className="btn primary" disabled={where === 'existing' && !dash} onClick={pin}>Pin</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="radio-row"><label><input type="radio" checked={where === 'existing'} disabled={!dashes.length} onChange={() => setWhere('existing')} />Existing dashboard</label><label><input type="radio" checked={where === 'new'} onChange={() => setWhere('new')} />New dashboard</label></div>
    {where === 'existing' ? <select className="tx" value={dash} onChange={e => setDash(e.target.value)}>{dashes.map(x => <option key={x.id} value={x.id}>{x.name} ({ws(x.wsId)?.name})</option>)}</select> : <input className="tx" value={name} onChange={e => setName(e.target.value)} />}
    <div className="tiny">{v ? 'Pinning a visual creates a tile that shows its current filters and updates with each data refresh. Alerts can be set on card, KPI and gauge tiles.' : 'A live page tile shows the whole page and stays interactive. Select a visual first to pin just that visual.'}</div>
  </Dialog>;
}

function AlertDlg({ d }: { d: DialogT }) {
  const s = svc.get(); const dash = item(d.dashId)!; const t = dash.tiles!.find(x => x.id === d.tileId)!;
  const mine = t.alerts.filter(a => a.owner === s.me);
  const [cond, setCond] = useState<'above' | 'below'>('above'); const [th, setTh] = useState(1000000); const [freq, setFreq] = useState<'hour' | 'day'>('day');
  return <Dialog title="Manage alerts" sub={t.title} width={520} footer={<><button className="btn primary" onClick={() => { svc.change(() => { t.alerts.push({ id: sid('al'), owner: s.me, title: `${t.title} ${cond} ${th}`, condition: cond, threshold: th, frequency: freq, email: true, active: true }); log(`Alert on ${t.title}`); }); close(); store.toast('Alert saved. It\'s checked whenever the data refreshes.'); }}>Save and close</button><button className="btn" onClick={close}>Cancel</button></>}>
    {mine.map(a => <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}><span>{a.title} · {a.frequency === 'hour' ? 'at most once an hour' : 'at most once a day'}</span><button className="btn sm" onClick={() => svc.change(() => { t.alerts = t.alerts.filter(x => x !== a); })}>Delete</button></div>)}
    <div className="row"><select className="tx" style={{ width: 120 }} value={cond} onChange={e => setCond(e.target.value as any)}><option value="above">Above</option><option value="below">Below</option></select><input className="tx" type="number" style={{ width: 160 }} value={th} onChange={e => setTh(+e.target.value)} /></div>
    <div className="field"><label>Maximum notification frequency</label><select className="tx" value={freq} onChange={e => setFreq(e.target.value as any)}><option value="day">At most once a day</option><option value="hour">At most once an hour</option></select></div>
    <label className="row"><input type="checkbox" defaultChecked disabled />Send me email, too</label>
    <div className="tiny">Alerts work on dashboard tiles of cards, KPIs and gauges (numeric values). They're private to you and run when the semantic model refreshes. Advance the clock to a scheduled refresh to see them fire.</div>
  </Dialog>;
}

function Subscribe({ d }: { d: DialogT }) {
  const s = svc.get(); const it = item(d.id)!;
  const pages = it.report?.pages.filter(p => !p.hidden && !p.isTooltip) ?? [];
  const [name, setName] = useState(it.name);
  const [rec, setRec] = useState<string[]>([s.me]); const [pick, setPick] = useState('');
  const [freq, setFreq] = useState<Sub['frequency']>('Daily'); const [time, setTime] = useState('08:00');
  const [pg, setPg] = useState<string[]>(pages.slice(0, 1).map(p => p.id));
  const [format, setFormat] = useState<Sub['format']>('Link');
  const save = () => {
    for (const r of rec) if (r !== s.me && !access(it, r.includes('@') ? r : s.me).read && r.includes('@')) { store.toast(`${principalLabel(r)} doesn't have access to "${it.name}". Share it with them first.`, 'error'); return; }
    svc.change(() => { it.subs = [...(it.subs ?? []), { id: sid('sub'), owner: s.me, name, itemId: it.id, pages: it.type === 'Report' ? pg : undefined, recipients: rec, frequency: freq, time, enabled: true, format }]; log(`Subscription ${name}`); });
    close(); store.toast('Subscription saved. Advance the clock to receive it.');
  };
  return <Dialog title="Subscribe to emails" sub={it.name} width={560} footer={<><button className="btn primary" disabled={!rec.length} onClick={save}>Save</button><button className="btn" onClick={close}>Cancel</button></>}>
    {(it.subs ?? []).filter(x => x.owner === s.me).map(x => <div key={x.id} className="row" style={{ justifyContent: 'space-between' }}><span>{x.name} · {x.frequency}{x.frequency !== 'After data refresh' ? ` at ${x.time}` : ''} · to {x.recipients.map(principalLabel).join(', ')}</span><span><button className="btn sm" onClick={() => svc.change(() => { x.enabled = !x.enabled; })}>{x.enabled ? 'Turn off' : 'Turn on'}</button> <button className="btn sm" onClick={() => svc.change(() => { it.subs = it.subs!.filter(y => y !== x); })}>Delete</button></span></div>)}
    <div className="field"><label>Subscription name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="field"><label>Recipients</label><div className="row"><div style={{ flex: 1 }}><PrincipalPicker value={pick} onChange={setPick} exclude={rec} /></div><button className="btn" disabled={!pick} onClick={() => { setRec([...rec, pick]); setPick(''); }}>Add</button></div>
      <div className="row" style={{ flexWrap: 'wrap' }}>{rec.map(r => <span key={r} className="pill" style={{ display: 'inline-flex' }}>{principalLabel(r)}<button className="iconbtn" style={{ height: 16 }} onClick={() => setRec(rec.filter(x => x !== r))}><I n="close" s={10} /></button></span>)}</div></div>
    {it.type === 'Report' && <div className="field"><label>Report pages</label>{pages.map(p => <label key={p.id} className="row tiny"><input type="checkbox" checked={pg.includes(p.id)} onChange={e => setPg(e.target.checked ? [...pg, p.id] : pg.filter(x => x !== p.id))} />{p.name}</label>)}</div>}
    <div className="row"><div className="field"><label>Repeat</label><select className="tx" value={freq} onChange={e => setFreq(e.target.value as any)}><option>Hourly</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>After data refresh</option></select></div>
      {freq !== 'After data refresh' && freq !== 'Hourly' && <div className="field"><label>Time</label><input className="tx" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>}
      <div className="field"><label>Attach</label><select className="tx" value={format} onChange={e => setFormat(e.target.value as any)}><option value="Link">Link and preview image</option><option value="PDF">Full report as PDF</option><option value="PowerPoint">Full report as PowerPoint</option></select></div></div>
    <div className="tiny">Subscribing others needs a Pro license (or Premium capacity) and the recipients must already have access. Each recipient sees the data their RLS allows. "After data refresh" sends once a day, after the first refresh.</div>
  </Dialog>;
}

function Embed({ d }: { d: DialogT }) {
  const it = item(d.id)!;
  const [code, setCode] = useState(it.webCode);
  if (d.kind === 'web') return <Dialog title="Embed in a public website" width={560} footer={<><button className="btn primary" onClick={close}>Close</button>{code && <button className="btn" onClick={() => { svc.change(() => { it.webCode = undefined; }); setCode(undefined); store.toast('Embed code deleted. The public link stops working.'); }}>Delete embed code</button>}</>}>
    <div className="warnbox">Publish to web makes the report available to <b>anyone on the internet</b> without signing in. It ignores RLS and permissions. Don't use it for confidential or internal data. Use secure embedding or SharePoint for internal sites.</div>
    {!code ? <button className="btn yellow" onClick={() => { const c = Math.random().toString(36).slice(2, 14); svc.change(() => { it.webCode = c; log(`Publish to web: ${it.name}`); }); setCode(c); }}>Create embed code</button> : <>
      <div className="field"><label>Link you can send in email</label><input className="tx" readOnly value={`https://app.powerbi.com/view?r=${code}`} /></div>
      <div className="field"><label>HTML you can paste into your website</label><textarea className="tx" rows={2} readOnly value={`<iframe title="${it.name}" width="1140" height="541.25" src="https://app.powerbi.com/view?r=${code}" frameborder="0" allowFullScreen="true"></iframe>`} /></div>
      <button className="btn sm" onClick={() => { close(); nav.go({ page: 'web', id: it.id }); }}>Open the public view</button></>}
    <div className="tiny">Admins manage all embed codes in the Admin portal. Publish to web isn't available for reports with RLS, live connections to Analysis Services, or shared-with-me content.</div>
  </Dialog>;
  return <Dialog title={d.kind === 'sharepoint' ? 'Embed link for SharePoint' : 'Secure embed code'} width={560} footer={<button className="btn primary" onClick={close}>Close</button>}>
    <div className="field"><label>{d.kind === 'sharepoint' ? 'Paste this link into the Power BI web part in SharePoint Online' : 'Embed this in a website or portal (users must sign in)'}</label><input className="tx" readOnly value={`https://app.powerbi.com/reportEmbed?reportId=${it.id}&autoAuth=true`} /></div>
    <div className="tiny">{d.kind === 'sharepoint' ? 'The SharePoint web part respects Power BI permissions and RLS: people need access to the report (and a license) to see data. Sharing the SharePoint page doesn\'t share the report.' : 'Secure embedding asks viewers to sign in; they need access to the report and a license. Use Power BI Embedded (an A or F SKU) for "app owns data" scenarios where users don\'t have Power BI accounts.'}</div>
  </Dialog>;
}

function Rule({ d }: { d: DialogT }) {
  const s = svc.get(); const p = s.pipelines.find(x => x.id === d.pipelineId)!;
  const models = s.items.filter(i => i.wsId === p.stages[d.stage].wsId && i.type === 'SemanticModel');
  const [itemName, setItem] = useState(models[0]?.name ?? ''); const [kind, setKind] = useState<'dataSource' | 'parameter'>('dataSource');
  const [from, setFrom] = useState('localhost'); const [to, setTo] = useState('prod-sql.contoso.com'); const [param, setParam] = useState('');
  return <Dialog title="Deployment rules" sub={`${p.name} · ${p.stages[d.stage].name}`} width={560} footer={<><button className="btn primary" disabled={!itemName} onClick={() => { svc.change(() => { p.rules.push({ stage: d.stage, item: itemName, kind, from: kind === 'dataSource' ? from : undefined, to, param: kind === 'parameter' ? param : undefined }); }); close(); }}>Save</button><button className="btn" onClick={close}>Cancel</button></>}>
    {p.rules.filter(r => r.stage === d.stage).map((r, i) => <div key={i} className="tiny">{r.item}: {r.kind === 'dataSource' ? `${r.from} → ${r.to}` : `parameter ${r.param} = ${r.to}`}</div>)}
    <div className="field"><label>Semantic model (in this stage)</label><select className="tx" value={itemName} onChange={e => setItem(e.target.value)}>{models.map(m => <option key={m.id}>{m.name}</option>)}{!models.length && <option value="">Deploy something to this stage first</option>}</select></div>
    <div className="radio-row"><label><input type="radio" checked={kind === 'dataSource'} onChange={() => setKind('dataSource')} />Data source rule</label><label><input type="radio" checked={kind === 'parameter'} onChange={() => setKind('parameter')} />Parameter rule</label></div>
    {kind === 'dataSource' ? <div className="row"><input className="tx" value={from} onChange={e => setFrom(e.target.value)} placeholder="From (server or path)" /><span>→</span><input className="tx" value={to} onChange={e => setTo(e.target.value)} placeholder="To" /></div>
      : <div className="row"><input className="tx" value={param} onChange={e => setParam(e.target.value)} placeholder="Parameter name" /><span>=</span><input className="tx" value={to} onChange={e => setTo(e.target.value)} placeholder="Value" /></div>}
    <div className="tiny">Rules apply when content is deployed into this stage, so Test and Production can point at their own databases without editing the .pbix.</div>
  </Dialog>;
}

// ---------------------------------------------------------------- Desktop: Publish
export function PublishDialog() {
  const s = svc.get();
  const p = store.project;
  const opts = wsOptions('Contributor');
  const [wsId, setWsId] = useState(opts.find(w => !w.personal)?.id ?? opts[0]?.id);
  const live = (p as any).liveConnection as { itemId: string; composite?: boolean } | undefined;
  const go = () => {
    const w = ws(wsId)!;
    const m = can('publish', w); if (m) { store.toast(m, 'error'); return; }
    if (s.tenant.labelsMandatory && !p.report.sensitivity) { store.toast('Your organization requires a sensitivity label before publishing (Home › Sensitivity).', 'error'); return; }
    const existing = s.items.find(i => i.wsId === wsId && i.type === 'Report' && i.name === p.name);
    const doIt = () => {
      let res: any;
      svc.change(() => { res = publish(p, wsId, { liveModelId: live && !live.composite ? live.itemId : undefined }); });
      close();
      store.openDialog({ type: 'message', title: 'Publishing to Power BI', text: `Success! "${p.name}" was published to ${w.personal ? 'My workspace' : w.name}.${res.model ? '\n\nThe semantic model was published with its data. Set up credentials, a gateway (for on-premises sources) and scheduled refresh in its settings.' : '\n\nOnly the report was published: it uses the shared semantic model through a live connection.'}${p.model.roles.length ? '\n\nRLS roles were published. Add members to them in the service (semantic model › Security).' : ''}\n\nOpen the service from the title bar (Power BI service).` });
    };
    if (existing) store.openDialog({ type: 'confirm', title: 'Replace this semantic model?', text: `"${p.name}" already exists in ${w.name}. Replace it? Reports, dashboards and apps that use it keep working; app users see report changes only after the app is updated.`, ok: 'Replace', onOk: doIt });
    else doIt();
  };
  return <Dialog title="Publish to Power BI" sub={`Signed in as ${me().name} (${me().license})`} width={520} footer={<><button className="btn primary" disabled={!wsId} onClick={go}>Select</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>Select a destination</label>
      <div className="list" style={{ maxHeight: 260 }}>{opts.map(w => <div key={w.id} className="it" onClick={() => setWsId(w.id)} style={{ background: w.id === wsId ? '#e5f1fb' : undefined }}><I n="workspace" s={16} /><span style={{ flex: 1 }}>{w.personal ? 'My workspace' : w.name}</span><span className="tiny">{w.license} · {w.personal ? 'Admin' : roleIn(w, s.me)}</span></div>)}</div></div>
    <div className="tiny">Only workspaces where you're a Contributor, Member or Admin are listed. {p.report.sensitivity ? `The ${p.report.sensitivity} label is published with the file.` : ''} Switch the signed-in user in the service (top right) to publish as someone else.</div>
  </Dialog>;
}

// ---------------------------------------------------------------- Desktop: Get data › Power BI semantic models (live connection)
export function LiveConnectDialog() {
  const s = svc.get();
  const models = s.items.filter(i => i.type === 'SemanticModel' && access(i, s.me).read);
  const [sel, setSel] = useState<string | null>(null);
  const connect = () => {
    const it = item(sel!)!;
    if (!access(it, s.me).build) { store.toast(`You need Build permission on "${it.name}" to connect to it. Ask the owner to grant Build (share with "Allow recipients to build content") or add you to the workspace as a Contributor.`, 'error'); return; }
    const data = modelData(it);
    const p: Project = JSON.parse(JSON.stringify({ ...data, model: { ...data.model, tables: data.model.tables.map(t => ({ ...t, rows: [] })) } }));
    p.name = `${it.name} report`; p.queries = [];
    p.report = { pages: [{ id: uid('pg'), name: 'Page 1', visuals: [], filters: [] }], reportFilters: [], bookmarks: [], theme: 'Default', sensitivity: it.label };
    (p as any).liveConnection = { itemId: it.id, name: it.name, ws: ws(it.wsId)!.name };
    store.loadProject(p);
    // rows come from the service model (the live connection queries it)
    store.project.model.tables.forEach((t, i) => { t.rows = data.model.tables[i].rows; (t as any).remote = it.id; });
    store.recalcModel(); store.emit(); clearQueryCache();
    close();
    store.toast(`Connected live to "${it.name}" in ${ws(it.wsId)!.name}. Power Query and calculated columns aren't available; you can add report measures, or choose Make changes to this model.`);
  };
  return <Dialog title="OneLake catalog · Semantic models" sub={`Signed in as ${me().name}`} width={720} footer={<><button className="btn primary" disabled={!sel} onClick={connect}>Connect</button><button className="btn" onClick={close}>Cancel</button></>}>
    <table className="grid-table"><thead><tr><th>Name</th><th>Workspace</th><th>Endorsement</th><th>Sensitivity</th><th>Your permission</th><th>Refreshed</th></tr></thead><tbody>
      {models.map(m => { const a = access(m, s.me); return <tr key={m.id} className="clickable" onClick={() => setSel(m.id)} style={{ background: sel === m.id ? '#e5f1fb' : undefined }}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n={TYPE_ICON[m.type]} s={15} /><b>{m.name}</b></span></td><td>{ws(m.wsId)?.personal ? 'My workspace' : ws(m.wsId)?.name}</td><td>{m.endorsement ?? '—'}</td><td>{m.label ?? '—'}</td><td style={{ color: a.build ? undefined : '#a4262c' }}>{a.build ? 'Build' : 'Read only (Build needed)'}</td><td>{fmtTime(m.lastRefresh)}</td></tr>; })}
      {!models.length && <tr><td colSpan={6} className="subtle">No semantic models yet. Publish one first (Home › Publish), or switch user in the service.</td></tr>}
    </tbody></table>
    <div className="tiny">A live connection builds a report on a shared semantic model, so many reports use one governed model ("thin reports"). Certified and promoted models are listed first in the real catalog.</div>
  </Dialog>;
}

export const SERVICE_DIALOGS = { svcNewWs: NewWorkspace, svcNewDashboard: NewDashboard, svcAccess: WsAccess, svcWsSettings: WsSettings, svcShare: Share, svcPerms: Perms, svcDownload: Download, svcGetApps: GetApps, svcPin: Pin, svcAlert: AlertDlg, svcSubscribe: Subscribe, svcEmbed: Embed, svcRule: Rule, publish: PublishDialog, liveConnect: LiveConnectDialog };
