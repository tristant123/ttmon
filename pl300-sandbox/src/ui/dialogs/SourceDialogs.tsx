// Data source settings (Change Source, Edit Permissions, Clear Permissions), credentials, privacy levels.
import React, { useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { I } from '../icons';
import { directSources, paramValues, Privacy, SourceRef, SourceSettings, Credential } from '../../m/privacy';
import { findFile } from '../../m/sources';
import { contosoDW } from '../../data/sample';
import { refreshAll } from '../actions';
import { clearQueryCache } from '../report/vhelpers';

const close = () => store.closeDialog();
const queriesNow = () => (store.ui.pq ? store.ui.pq.queries : store.project.queries);

/** Every data source used by the current file, with the queries that use it. */
export function fileSources(): (SourceRef & { queries: string[] })[] {
  const qs = queriesNow(); const params = paramValues(qs);
  const out: (SourceRef & { queries: string[] })[] = [];
  for (const q of qs) for (const src of directSources(q.code, params)) {
    const ex = out.find(x => x.key === src.key);
    if (ex) { if (!ex.queries.includes(q.name)) ex.queries.push(q.name); } else out.push({ ...src, queries: [q.name] });
  }
  return out;
}

export function sourceSettings(key: string): SourceSettings { return store.project.dataSources?.[key] ?? {}; }
export function setSourceSettings(key: string, patch: Partial<SourceSettings>) {
  store.change(p => { p.dataSources ??= {}; p.dataSources[key] = { ...(p.dataSources[key] ?? {}), ...patch }; }, { noUndo: true });
  clearQueryCache();
}

const icon = (s: SourceRef) => (s.kind === 'SQL' ? 'sql' : s.kind === 'Folder' ? 'folder' : s.kind === 'Web' ? 'globe' : /\.xls/i.test(s.label) ? 'excel' : /\.json$/i.test(s.label) ? 'json' : /\.xml$/i.test(s.label) ? 'xml' : /\.parquet$/i.test(s.label) ? 'parquet' : 'csv');
function available(s: SourceRef): boolean {
  if (s.kind === 'File') return !!findFile(s.label);
  if (s.kind === 'SQL') return !!contosoDW(s.args[0], s.args[1] ?? 'ContosoDW');
  if (s.kind === 'Folder') return store.files.some(f => f.folder.toLowerCase().startsWith(s.label.toLowerCase().replace(/\\$/, '')));
  return false;
}

export function DataSources({ d }: { d: DialogT }) {
  const s = store;
  const [scope, setScope] = useState<'file' | 'global'>(d.scope ?? 'file');
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const list = (scope === 'file' ? fileSources() : Object.keys(s.project.dataSources ?? {}).map(k => fileSources().find(x => x.key === k) ?? { key: k, label: k.replace(/^\w+:/, ''), kind: k.startsWith('sql:') ? 'SQL' as const : 'File' as const, fn: '', args: [], foldable: false, queries: [] }))
    .filter(x => !q || x.label.toLowerCase().includes(q.toLowerCase()));
  const cur = list.find(x => x.key === sel) ?? null;
  return <Dialog title="Data source settings" sub="Manage settings for data sources that you have connected to using Power BI Desktop." width="min(780px, 95vw)" footer={<button className="btn primary" onClick={close}>Close</button>}>
    <div className="radio-row"><label><input type="radio" checked={scope === 'file'} onChange={() => setScope('file')} />Data sources in current file</label><label><input type="radio" checked={scope === 'global'} onChange={() => setScope('global')} />Global permissions</label></div>
    <div className="pane-search" style={{ margin: 0 }}><I n="search" s={13} /><input placeholder="Search data source settings" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="list" style={{ minHeight: 160, maxHeight: 280 }}>
      {list.map(x => { const st = sourceSettings(x.key); return <div key={x.key} className={`it ${sel === x.key ? 'sel' : ''}`} onClick={() => setSel(x.key)} style={{ background: sel === x.key ? '#e5f1fb' : undefined }}>
        <I n={icon(x)} s={18} />
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</div>
          <div className="tiny">{x.queries.length ? `Used by ${x.queries.join(', ')} · ` : ''}Privacy: {st.privacy ?? 'None'}{x.kind === 'SQL' ? ` · Credentials: ${st.credential === null ? 'cleared' : st.credential?.kind ?? 'Windows (current user)'}` : ''} · <span style={{ color: available(x) ? '#107c10' : '#a4262c' }}>{available(x) ? 'Available' : 'Not found'}</span></div></div>
      </div>; })}
      {!list.length && <div className="subtle" style={{ padding: 10 }}>{scope === 'file' ? 'This file has no data sources yet.' : 'No permissions have been saved yet.'}</div>}
    </div>
    <div className="row">
      <button className="btn" disabled={!cur || scope !== 'file'} onClick={() => s.openDialog({ type: 'changeSource', key: cur!.key })}>Change Source…</button>
      <button className="btn" disabled={!cur} onClick={() => s.openDialog({ type: 'editPermissions', key: cur!.key, label: cur!.label, kind: cur!.kind })}>Edit Permissions…</button>
      <button className="btn" disabled={!cur} onClick={() => { setSourceSettings(cur!.key, { credential: null, privacy: undefined }); s.toast(`Cleared permissions for ${cur!.label}. You'll be asked for credentials and privacy levels the next time it's used.`); }}>Clear Permissions</button>
      <button className="btn" onClick={() => { s.change(p => { p.dataSources = {}; }, { noUndo: true }); clearQueryCache(); s.toast('Cleared all permissions.'); }}>Clear All Permissions</button>
    </div>
    <div className="tiny">Change Source updates every query that uses the source. If a query builds its path from a parameter, edit the parameter instead (Home › Transform data › Edit parameters).</div>
    <div className="section-h">Files stored in the sandbox</div>
    <div className="list" style={{ maxHeight: 140 }}>{s.files.map(f => <div key={f.folder + f.name} className="it"><span style={{ flex: 1 }}>{f.folder}\{f.name}</span><span className="tiny">{(f.bytes.length / 1024).toFixed(1)} KB</span><button className="btn sm" onClick={() => { s.files = s.files.filter(x => x !== f); void s.persistFiles(); s.emit(); }}>Remove</button></div>)}</div>
  </Dialog>;
}

export function ChangeSource({ d }: { d: DialogT }) {
  const s = store;
  const src = fileSources().find(x => x.key === d.key);
  const [a, setA] = useState(src?.args[0] ?? '');
  const [b, setB] = useState(src?.args[1] ?? '');
  if (!src) return null;
  const literalUsed = queriesNow().some(q => q.code.includes(`"${src.args[0].replace(/"/g, '""')}"`));
  const ok = () => {
    const rep = (code: string) => {
      let c = code.split(`"${src.args[0].replace(/"/g, '""')}"`).join(`"${a.replace(/"/g, '""')}"`);
      if (src.kind === 'SQL' && src.args[1] !== undefined) c = c.split(`"${src.args[1].replace(/"/g, '""')}"`).join(`"${b.replace(/"/g, '""')}"`);
      return c;
    };
    if (s.ui.pq) s.setUI({ pq: { ...s.ui.pq, queries: s.ui.pq.queries.map(q => (src.queries.includes(q.name) ? { ...q, code: rep(q.code) } : q)), dirty: true } });
    else { s.change(p => { for (const q of p.queries) if (src.queries.includes(q.name)) q.code = rep(q.code); }); }
    // carry the permissions over to the new source key
    const nk = src.kind === 'SQL' ? `sql:${a.toLowerCase()};${b.toLowerCase()}` : `${src.kind.toLowerCase()}:${a.toLowerCase()}`;
    if (s.project.dataSources?.[src.key]) setSourceSettings(nk, s.project.dataSources[src.key]);
    close();
    if (!s.ui.pq) refreshAll(); else s.toast(`Updated ${src.queries.length} quer${src.queries.length === 1 ? 'y' : 'ies'}. Close & Apply to load from the new source.`);
  };
  return <Dialog title={src.kind === 'SQL' ? 'SQL Server database' : src.kind === 'Folder' ? 'Folder' : 'Change Source'} width={560} footer={<><button className="btn primary" disabled={!literalUsed} onClick={ok}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    {!literalUsed && <div className="warnbox">This source's path is built from a parameter, so it can't be changed here. Edit the parameter value instead (Home › Transform data › Edit parameters).</div>}
    {src.kind === 'SQL' ? <>
      <div className="field"><label>Server</label><input className="tx" value={a} onChange={e => setA(e.target.value)} /></div>
      <div className="field"><label>Database (optional)</label><input className="tx" value={b} onChange={e => setB(e.target.value)} /></div>
    </> : <>
      <div className="field"><label>{src.kind === 'Folder' ? 'Folder path' : 'File path'}</label><input className="tx" value={a} onChange={e => setA(e.target.value)} /></div>
      {src.kind === 'File' && <div className="list" style={{ maxHeight: 180 }}>{s.files.map(f => { const p = `${f.folder}\\${f.name}`; return <div key={p} className="it" onClick={() => setA(p)} style={{ background: a === p ? '#e5f1fb' : undefined }}><span>{p}</span></div>; })}</div>}
    </>}
    <div className="tiny">Used by: {src.queries.join(', ')}</div>
  </Dialog>;
}

export function EditPermissions({ d }: { d: DialogT }) {
  const st = sourceSettings(d.key);
  const [privacy, setPrivacy] = useState<Privacy>(st.privacy ?? 'None');
  const [encrypt, setEncrypt] = useState(st.encrypt ?? true);
  return <Dialog title="Edit Permissions" sub={d.label} width={520} footer={<><button className="btn primary" onClick={() => { setSourceSettings(d.key, { privacy, encrypt }); close(); }}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="section-h">Credentials</div>
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <span>Type: {d.kind === 'SQL' ? (st.credential === null ? <i>none (cleared)</i> : st.credential?.kind ?? 'Windows') : 'Windows'}{st.credential?.user ? ` (${st.credential.user})` : ''}</span>
      <span><button className="btn sm" disabled={d.kind !== 'SQL'} onClick={() => store.openDialog({ type: 'credentials', key: d.key, label: d.label })}>Edit…</button> <button className="btn sm" disabled={d.kind !== 'SQL'} onClick={() => setSourceSettings(d.key, { credential: null })}>Delete</button></span>
    </div>
    {d.kind === 'SQL' && <label className="row"><input type="checkbox" checked={encrypt} onChange={e => setEncrypt(e.target.checked)} />Encrypt connections</label>}
    <div className="section-h">Privacy Level</div>
    <select className="tx" value={privacy} onChange={e => setPrivacy(e.target.value as Privacy)}>{['None', 'Public', 'Organizational', 'Private'].map(x => <option key={x}>{x}</option>)}</select>
    <div className="tiny" style={{ lineHeight: 1.5 }}>
      <b>Private</b>: sensitive or confidential data, isolated from every other source (for example HR or salary data).<br />
      <b>Organizational</b>: can be combined with other Organizational sources but not sent to Public ones (for example an intranet site or company database).<br />
      <b>Public</b>: anyone can see it, so it can be combined with any source (for example open data on the web).<br />
      <b>None</b>: not set yet. Power Query asks for a level when the source is combined with another one.
    </div>
  </Dialog>;
}

export function Credentials({ d }: { d: DialogT }) {
  const [kind, setKind] = useState<Credential['kind']>(sourceSettings(d.key).credential?.kind ?? 'Windows');
  const [user, setUser] = useState(sourceSettings(d.key).credential?.user ?? '');
  const [pw, setPw] = useState('');
  const save = () => { setSourceSettings(d.key, { credential: { kind, user: kind === 'Database' ? user : kind === 'Microsoft account' ? 'student@contoso.com' : undefined } }); close(); d.then?.(); };
  return <Dialog title="SQL Server database" sub={d.label} width={620} footer={<><button className="btn primary" disabled={kind === 'Database' && (!user || !pw)} onClick={save}>Connect</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 170 }}>{(['Windows', 'Database', 'Microsoft account'] as const).map(k => <button key={k} className={`btn sm ${kind === k ? 'primary' : ''}`} style={{ textAlign: 'left' }} onClick={() => setKind(k)}>{k}</button>)}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kind === 'Windows' && <><label className="row"><input type="radio" defaultChecked name="win" />Use my current credentials</label><label className="row"><input type="radio" name="win" />Use alternate credentials</label></>}
        {kind === 'Database' && <><div className="field"><label>User name</label><input className="tx" value={user} onChange={e => setUser(e.target.value)} /></div><div className="field"><label>Password</label><input className="tx" type="password" value={pw} onChange={e => setPw(e.target.value)} /></div><div className="tiny">Sandbox only: any user name and password is accepted, and the password isn't stored.</div></>}
        {kind === 'Microsoft account' && <><div>You are signed in as student@contoso.com (sandbox).</div><div className="tiny">Microsoft Entra ID (OAuth) sign-in is typical for Azure SQL Database and Fabric SQL endpoints.</div></>}
        <div className="tiny">Select which level to apply these settings to: {d.label}</div>
      </div>
    </div>
  </Dialog>;
}

/** "Information is required about data privacy" → Continue. */
export function PrivacyLevels({ d }: { d: DialogT }) {
  const s = store;
  const srcs = fileSources().filter(x => !d.keys || d.keys.includes(x.key) || fileSources().length <= 4);
  const [lv, setLv] = useState<Record<string, Privacy>>(() => Object.fromEntries(srcs.map(x => [x.key, sourceSettings(x.key).privacy ?? 'None'])));
  const [ignore, setIgnore] = useState(!!s.project.settings.ignorePrivacy);
  return <Dialog title="Privacy levels" width={640} footer={<><button className="btn primary" disabled={!ignore && Object.values(lv).some(v => v === 'None')} onClick={() => {
    s.change(p => { p.settings.ignorePrivacy = ignore; p.dataSources ??= {}; for (const [k, v] of Object.entries(lv)) p.dataSources[k] = { ...(p.dataSources[k] ?? {}), privacy: v }; }, { noUndo: true });
    clearQueryCache(); close();
  }}>Save</button><button className="btn" onClick={close}>Cancel</button></>}>
    <label className="row"><input type="checkbox" checked={ignore} onChange={e => setIgnore(e.target.checked)} />Ignore Privacy Levels checks for this file. Ignoring Privacy Levels could expose sensitive or confidential data to an unauthorized person.</label>
    <table className="grid-table"><tbody>{srcs.map(x => <tr key={x.key}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n={icon(x)} s={16} />{x.label}</span></td><td style={{ width: 170 }}>
      <select className="tx" disabled={ignore} value={lv[x.key]} onChange={e => setLv({ ...lv, [x.key]: e.target.value as Privacy })}>{['None', 'Public', 'Organizational', 'Private'].map(o => <option key={o}>{o}</option>)}</select></td></tr>)}</tbody></table>
    <div className="tiny">Power Query uses these levels to decide whether data from one source may be sent to another when combining them (for example, when a merge or filter is folded into a SQL query).</div>
  </Dialog>;
}

export const SOURCE_DIALOGS = { dataSources: DataSources, changeSource: ChangeSource, editPermissions: EditPermissions, credentials: Credentials, privacyLevels: PrivacyLevels };
