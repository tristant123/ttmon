// The simulated Power BI service: tenant, users and groups, workspaces and roles, items (semantic models, reports,
// dashboards, paginated reports), sharing and permissions, apps, gateways, refresh, alerts, subscriptions,
// endorsement, sensitivity labels, deployment pipelines, usage. State lives in its own localStorage key.
// The rules follow Microsoft's documentation for the Power BI service; see the comments on each rule.
import { Project, Report, Bookmark, ModelTable } from '../model/types';
import { MEngine } from '../m/engine';
import { refreshModel, recalc } from '../model/refresh';
import { directSources, paramValues, SourceRef } from '../m/privacy';
import { stripRows, replacer, reviver } from '../store';

export type License = 'Free' | 'Pro' | 'PPU';
export type Role = 'Admin' | 'Member' | 'Contributor' | 'Viewer';
export type WsLicense = 'Pro' | 'PPU' | 'Premium' | 'Fabric F2' | 'Fabric F64' | 'Embedded';
export type ItemType = 'SemanticModel' | 'Report' | 'Dashboard' | 'PaginatedReport' | 'Lakehouse' | 'Dataflow';

export interface SUser { upn: string; name: string; license: License; title: string }
export interface Group { name: string; members: string[] }
export interface Access { principal: string; role: Role }
export interface Workspace { id: string; name: string; license: WsLicense; access: Access[]; contributorsCanUpdateApp?: boolean; description?: string; personal?: string; created: number }
export interface ItemPerm { principal: string; read: boolean; build: boolean; reshare: boolean; write?: boolean; via: 'share' | 'link' | 'app' }
export interface RefreshPlan { enabled: boolean; frequency: 'Daily' | 'Weekly'; days: string[]; times: string[]; notifyOwner: boolean; contacts: string[]; failures: number }
export interface RefreshRun { at: number; kind: 'Scheduled' | 'On demand' | 'Via API'; status: 'Completed' | 'Failed' | 'Disabled'; msg?: string; ms?: number }
export interface Tile { id: string; title: string; reportId: string; pageId: string; visualId?: string; kind: 'visual' | 'page'; visualType?: string; w: number; h: number; alerts: Alert[]; cache?: { at: number; value?: any; series?: any } }
export interface Alert { id: string; owner: string; title: string; condition: 'above' | 'below'; threshold: number; frequency: 'hour' | 'day'; email: boolean; active: boolean; last?: number }
export interface Sub { id: string; owner: string; name: string; itemId: string; pages?: string[]; recipients: string[]; frequency: 'Daily' | 'Weekly' | 'After data refresh' | 'Hourly' | 'Monthly'; time: string; enabled: boolean; format?: 'PDF' | 'PowerPoint' | 'Link' }
export interface Item {
  id: string; wsId: string; type: ItemType; name: string; owner: string; modified: number; created: number;
  endorsement?: 'Promoted' | 'Certified' | 'Master data'; label?: string; description?: string;
  perms: ItemPerm[];
  views: { upn: string; at: number; page?: string }[];
  // semantic model
  project?: Project;               // model + queries (rows not stored)
  refresh?: RefreshPlan; history?: RefreshRun[]; lastRefresh?: number;
  gatewayMap?: Record<string, string | null>;   // source key → gateway connection id
  cloudCreds?: Record<string, boolean>;
  rls?: Record<string, string[]>;               // role → members (users or groups)
  takeover?: string;
  liveSource?: string;                          // a report bound to another workspace's model
  // report
  modelId?: string; report?: Report; personal?: Record<string, { visuals: Record<string, any> }>; personalBookmarks?: Record<string, Bookmark[]>;
  webCode?: string;                             // Publish to web embed code
  settings?: { personalize?: boolean; exportData?: 'none' | 'summarized' | 'underlying'; persistentFilters?: boolean };
  // dashboard
  tiles?: Tile[];
  // paginated report
  rdl?: PaginatedDef;
  subs?: Sub[];
}
export interface PaginatedDef { modelId: string; title: string; columns: { table: string; column?: string; measure?: string; label: string }[]; groupBy?: number; param?: { table: string; column: string; label: string }; header: string; footer: string; orientation: 'Portrait' | 'Landscape'; rowsPerPage: number }
export interface Audience { name: string; items: string[]; members: string[] }
export interface App { id: string; wsId: string; name: string; description: string; color: string; audiences: Audience[]; published?: number; snapshot?: Record<string, { name: string; type: ItemType; report?: Report; modelId?: string; tiles?: Tile[]; rdl?: PaginatedDef; modified: number }>; allowBuild: boolean; allowReshare: boolean; allowCopy: boolean; installAuto: boolean; installed: string[] }
export interface GwConn { id: string; name: string; kind: 'SQL' | 'File' | 'Folder'; path: string; db?: string; auth: 'Windows' | 'Basic' | 'OAuth2'; users: string[]; privacy: 'None' | 'Public' | 'Organizational' | 'Private' }
export interface Gateway { id: string; name: string; mode: 'Standard' | 'Personal'; owner: string; admins: string[]; online: boolean; conns: GwConn[] }
export interface Pipeline { id: string; name: string; stages: { name: string; wsId?: string }[]; rules: { stage: number; item: string; kind: 'dataSource' | 'parameter'; from?: string; to: string; param?: string }[]; history: { at: number; from: number; to: number; items: string[]; by: string }[] }
export interface Mail { id: string; to: string; at: number; subject: string; body: string; from: string; read?: boolean }
export interface Tenant { publishToWeb: boolean; exportData: boolean; certifiers: string[]; copilot: boolean; aprMinSeconds: number; labelsMandatory: boolean; shareExternal: boolean; usageMetrics: boolean; createWorkspaces: string }
export interface SvcState {
  version: 1; me: string; clock: number;
  users: SUser[]; groups: Group[]; tenant: Tenant;
  workspaces: Workspace[]; items: Item[]; apps: App[]; gateways: Gateway[]; pipelines: Pipeline[]; inbox: Mail[];
  log: { at: number; who: string; what: string }[];
}

const KEY = 'pl300-sandbox-service';
export const sid = (p = 'i') => p + Math.random().toString(36).slice(2, 10);
const HOUR = 3600_000, DAY = 24 * HOUR;

// ---------------------------------------------------------------- state
let state: SvcState | null = null;
const listeners = new Set<() => void>();
let ver = 0;
export const svc = {
  get: (): SvcState => { if (!state) state = load(); return state; },
  version: () => ver,
  subscribe: (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; },
  change(f: (s: SvcState) => void) { f(svc.get()); ver++; save(); listeners.forEach(l => l()); },
  reset() { state = seed(); ver++; save(); dataCache.clear(); listeners.forEach(l => l()); },
};
function load(): SvcState {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw, reviver); } catch { /* storage unavailable */ }
  return seed();
}
let saveTimer: any = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state, replacer)); } catch { /* full or unavailable */ } }, 300); }

export const me = () => svc.get().users.find(u => u.upn === svc.get().me)!;
export const user = (upn: string) => svc.get().users.find(u => u.upn === upn);
export const ws = (id: string) => svc.get().workspaces.find(w => w.id === id);
export const item = (id: string) => svc.get().items.find(i => i.id === id);
export const now = () => svc.get().clock;
export function log(what: string) { svc.get().log.unshift({ at: now(), who: svc.get().me, what }); svc.get().log.length = Math.min(svc.get().log.length, 300); }
export function mail(to: string, subject: string, body: string, from = 'Microsoft Power BI <no-reply@powerbi.com>') { svc.get().inbox.unshift({ id: sid('m'), to, at: now(), subject, body, from }); }
export function mailbox(upn: string) { const gs = groupsOf(upn); return svc.get().inbox.filter(m => m.to === upn || gs.includes(m.to)); }

// ---------------------------------------------------------------- seed
export const PEOPLE: SUser[] = [
  { upn: 'pat@contoso.com', name: 'Pat Morgan', license: 'Pro', title: 'BI developer · Fabric administrator' },
  { upn: 'alex@contoso.com', name: 'Alex Rivera', license: 'Pro', title: 'Sales manager, North America' },
  { upn: 'brooke@contoso.com', name: 'Brooke Lee', license: 'Free', title: 'Sales manager, Europe' },
  { upn: 'chris@contoso.com', name: 'Chris Ng', license: 'PPU', title: 'Finance analyst' },
  { upn: 'dana@contoso.com', name: 'Dana Ortiz', license: 'Pro', title: 'Report author, Online store' },
];
function seed(): SvcState {
  const t0 = new Date(2025, 5, 2, 8, 0).getTime();
  const sales: Workspace = { id: 'ws-sales', name: 'Sales Analytics', license: 'Fabric F64', created: t0 - 90 * DAY, description: 'Certified sales reporting for the sales organization.',
    access: [{ principal: 'pat@contoso.com', role: 'Admin' }, { principal: 'Report Authors', role: 'Member' }, { principal: 'Sales Managers', role: 'Viewer' }] };
  const fin: Workspace = { id: 'ws-fin', name: 'Finance', license: 'Pro', created: t0 - 60 * DAY, access: [{ principal: 'pat@contoso.com', role: 'Admin' }, { principal: 'Finance Analysts', role: 'Contributor' }] };
  const personal = PEOPLE.map(p => ({ id: `ws-my-${p.upn.split('@')[0]}`, name: 'My workspace', license: 'Pro' as WsLicense, personal: p.upn, created: t0 - 200 * DAY, access: [{ principal: p.upn, role: 'Admin' as Role }] }));
  const lake: Item = { id: 'it-lake', wsId: 'ws-sales', type: 'Lakehouse', name: 'ContosoLakehouse', owner: 'pat@contoso.com', created: t0 - 80 * DAY, modified: t0 - 2 * DAY, endorsement: 'Certified', label: 'General', perms: [], views: [] };
  return {
    version: 1, me: 'pat@contoso.com', clock: t0,
    users: PEOPLE,
    groups: [
      { name: 'Sales Managers', members: ['alex@contoso.com', 'brooke@contoso.com', 'dana@contoso.com'] },
      { name: 'Finance Analysts', members: ['chris@contoso.com'] },
      { name: 'Report Authors', members: ['dana@contoso.com'] },
      { name: 'BI Certifiers', members: ['pat@contoso.com'] },
      { name: 'All Employees', members: PEOPLE.map(p => p.upn) },
    ],
    tenant: { publishToWeb: false, exportData: true, certifiers: ['BI Certifiers'], copilot: true, aprMinSeconds: 1800, labelsMandatory: false, shareExternal: false, usageMetrics: true, createWorkspaces: 'All Employees' },
    workspaces: [sales, fin, ...personal],
    items: [lake],
    apps: [], pipelines: [], log: [],
    gateways: [
      { id: 'gw-1', name: 'CONTOSO-GW01', mode: 'Standard', owner: 'pat@contoso.com', admins: ['pat@contoso.com'], online: true, conns: [
        { id: 'gc-sql', name: 'ContosoDW', kind: 'SQL', path: 'localhost', db: 'ContosoDW', auth: 'Windows', users: ['pat@contoso.com', 'Report Authors'], privacy: 'Organizational' },
        ...['Sales.csv', 'Products.xlsx', 'Customers.json', 'Stores.xml', 'Budget 2025.csv'].map(f => ({ id: `gc-${f.split('.')[0].toLowerCase().replace(/ /g, '-')}`, name: f, kind: 'File' as const, path: `C:\\Sandbox\\Files\\${f}`, auth: 'Windows' as const, users: ['pat@contoso.com', 'Report Authors'], privacy: 'Organizational' as const })),
      ] },
    ],
    inbox: [{ id: 'm0', to: 'pat@contoso.com', at: t0, from: 'Power BI sandbox', subject: 'Welcome to the Power BI service (sandbox)', body: 'This is a simulated tenant for PL-300 practice. Publish a report from Power BI Desktop (Home › Publish), then share it, build an app, schedule refresh, pin tiles to a dashboard, set alerts and subscriptions. Switch user (top right) to see what other people can do. Use the clock to move time forward and run scheduled refreshes.' }],
  };
}

// ---------------------------------------------------------------- people & permissions
export function groupsOf(upn: string) { return svc.get().groups.filter(g => g.members.includes(upn)).map(g => g.name); }
export const principalLabel = (p: string) => user(p)?.name ?? p;
export const isMember = (upn: string, principal: string) => principal === upn || groupsOf(upn).includes(principal);
const RANK: Record<Role, number> = { Viewer: 1, Contributor: 2, Member: 3, Admin: 4 };
/** The highest role a user has in a workspace, directly or through groups. */
export function roleIn(w: Workspace, upn: string): Role | null {
  let best: Role | null = null;
  for (const a of w.access) if (isMember(upn, a.principal) && (!best || RANK[a.role] > RANK[best])) best = a.role;
  return best;
}
export const atLeast = (r: Role | null, min: Role) => !!r && RANK[r] >= RANK[min];

/** Licensing: who can open content in a workspace. Free users only in Premium (P) or Fabric F64+ capacity. */
export function licenseBlock(w: Workspace, upn: string): string | null {
  const u = user(upn)!;
  if (w.personal) return w.personal === upn ? null : 'Content in someone else\'s My workspace can\'t be opened.';
  if (w.license === 'PPU') return u.license === 'PPU' ? null : `This workspace uses Premium Per User. ${u.name} needs a PPU license to open its content.`;
  if (w.license === 'Premium' || w.license === 'Fabric F64') return null;
  if (u.license === 'Free') return `${u.name} has a free license. Content in a ${w.license === 'Fabric F2' ? 'Fabric F2 (below F64) capacity' : 'shared-capacity (Pro)'} workspace needs a Pro or PPU license to view, or the workspace must be on Premium / Fabric F64 or larger capacity.`;
  return null;
}

export interface Access2 { read: boolean; build: boolean; reshare: boolean; write: boolean; role: Role | null; via: string[]; rls: boolean }
/** Effective permissions on an item: workspace role, direct sharing / links, and app audiences. */
export function access(it: Item, upn: string): Access2 {
  const w = ws(it.wsId)!;
  const role = roleIn(w, upn);
  const a: Access2 = { read: false, build: false, reshare: false, write: false, role, via: [], rls: true };
  if (role) {
    a.read = true; a.via.push(`${role} role in ${w.name}`);
    if (atLeast(role, 'Contributor')) { a.write = true; a.build = true; a.rls = false; }
    if (atLeast(role, 'Member')) a.reshare = true;
  }
  for (const p of it.perms) if (isMember(upn, p.principal)) { a.read = true; a.build ||= p.build; a.reshare ||= p.reshare; a.write ||= !!p.write; a.via.push(p.via === 'app' ? 'app audience' : p.via === 'link' ? 'sharing link' : 'shared directly'); }
  // a report's readers get Read on its semantic model (not Build)
  if (it.type === 'SemanticModel') {
    for (const r of svc.get().items.filter(x => x.type === 'Report' && x.modelId === it.id)) if (r.perms.some(p => isMember(upn, p.principal))) { if (!a.read) a.via.push(`reads report ${r.name}`); a.read = true; }
  }
  for (const app of svc.get().apps.filter(x => x.published && x.wsId === it.wsId)) {
    const aud = app.audiences.filter(au => au.members.some(m => isMember(upn, m) || m === 'All Employees'));
    const inApp = aud.some(au => au.items.includes(it.id)) || (it.type === 'SemanticModel' && aud.some(au => au.items.some(id => item(id)?.modelId === it.id)));
    if (inApp) { a.read = true; a.via.push(`app ${app.name}`); if (app.allowBuild) a.build = true; if (app.allowReshare) a.reshare = true; }
  }
  return a;
}

/** Explain why an action is or isn't allowed (message when blocked). */
export function can(action: 'publish' | 'share' | 'manageAccess' | 'editItem' | 'deleteWs' | 'wsSettings' | 'publishApp' | 'promote' | 'certify' | 'label' | 'refresh' | 'subscribe' | 'alert' | 'analyzeExcel' | 'createPipeline' | 'publishToWeb', target: Workspace | Item, upn = svc.get().me): string | null {
  const s = svc.get(); const u = user(upn)!;
  const w = 'wsId' in target ? ws(target.wsId)! : target as Workspace;
  const it = 'wsId' in target ? target as Item : null;
  const role = roleIn(w, upn);
  const needPro = () => (!w.personal && u.license === 'Free' && !(w.license === 'Premium' || w.license === 'Fabric F64') ? `${u.name} has a free license; publishing and sharing in this workspace needs Pro or PPU.` : null);
  switch (action) {
    case 'publish': return atLeast(role, 'Contributor') ? needPro() : `Publishing needs the Contributor, Member or Admin role in ${w.name}. ${u.name} is ${role ? 'a ' + role : 'not in the workspace'}.`;
    case 'share': {
      const a = it ? access(it, upn) : null;
      if (!(atLeast(role, 'Member') || a?.reshare)) return `Sharing needs the Member or Admin role, or Reshare permission on the item. ${role === 'Contributor' ? 'Contributors can\'t share unless they\'re given Reshare.' : ''}`;
      return needPro() ?? (u.license === 'Free' ? `${u.name} needs a Pro license to share.` : null);
    }
    case 'manageAccess': return atLeast(role, 'Member') ? null : 'Only Admins and Members can add people to a workspace (Members can add Members, Contributors and Viewers).';
    case 'deleteWs': case 'wsSettings': return role === 'Admin' ? null : 'Only workspace Admins can change workspace settings or delete the workspace.';
    case 'editItem': return atLeast(role, 'Contributor') || (it && access(it, upn).write) ? null : 'Editing needs the Contributor role or higher (or Write permission).';
    case 'publishApp': return atLeast(role, 'Member') || (role === 'Contributor' && w.contributorsCanUpdateApp) ? null : `Publishing or updating the app needs the Member or Admin role${role === 'Contributor' ? '. An Admin can allow Contributors to update the app in workspace settings.' : '.'}`;
    case 'promote': return atLeast(role, 'Contributor') || (it && access(it, upn).write) ? null : 'Promoting needs write permission on the item (Contributor or higher).';
    case 'certify': return s.tenant.certifiers.some(p => isMember(upn, p)) ? (atLeast(role, 'Contributor') || (it && access(it, upn).write) ? null : 'Certifying also needs write permission on the item.') : `Only people the Fabric administrator authorizes (Admin portal › Tenant settings › Certification: ${s.tenant.certifiers.join(', ') || 'nobody'}) can certify content.`;
    case 'label': return atLeast(role, 'Contributor') ? (u.license === 'Free' ? 'Applying labels needs a Pro or PPU license.' : null) : 'Applying a sensitivity label needs edit permission on the item.';
    case 'refresh': return atLeast(role, 'Contributor') ? null : 'Refreshing or changing refresh settings needs the Contributor role or higher.';
    case 'subscribe': return licenseBlock(w, upn) ?? (u.license === 'Free' && !(w.license === 'Premium' || w.license === 'Fabric F64') ? 'Subscriptions need a Pro or PPU license unless the content is in Premium / Fabric F64+ capacity.' : null);
    case 'alert': return u.license === 'Free' && !(w.license === 'Premium' || w.license === 'Fabric F64') ? 'Data alerts need a Pro or PPU license.' : null;
    case 'analyzeExcel': return it && (access(it, upn).build || (it.modelId && item(it.modelId) && access(item(it.modelId)!, upn).build)) ? null : 'Analyze in Excel needs Build permission on the semantic model.';
    case 'createPipeline': return (['Premium', 'PPU', 'Fabric F2', 'Fabric F64'] as WsLicense[]).includes(w.license) ? null : `Deployment pipelines need workspaces on Premium, PPU or Fabric capacity. ${w.name} uses the ${w.license} license mode.`;
    case 'publishToWeb': return !s.tenant.publishToWeb ? 'Publish to web is turned off in the Admin portal (Tenant settings › Publish to web).' : it?.modelId && item(it.modelId)?.project?.model.roles.length ? 'Publish to web isn\'t available for reports that use row-level security.' : atLeast(role, 'Contributor') ? null : 'Needs edit permission on the report.';
  }
}

// ---------------------------------------------------------------- data for semantic models (rows are computed in memory, not stored)
const dataCache = new Map<string, Project>();
export function modelData(it: Item, files = true): Project {
  const key = `${it.id}|${it.lastRefresh ?? 0}|${it.modified}`;
  let p = dataCache.get(key);
  if (p) return p;
  p = JSON.parse(JSON.stringify(it.project ?? emptyModelProject(it.name), replacer), reviver) as Project;
  for (const t of p.model.tables) t.rows = [];
  if (files) {
    // composite models built on another semantic model (DirectQuery for Power BI semantic models)
    for (const t of p.model.tables) { const rid = (t as any).remote; const ri = rid ? item(rid) : undefined; if (ri && ri.id !== it.id) { const rt = modelData(ri).model.tables.find(x => x.name === t.name); if (rt) t.rows = rt.rows.map(r => [...r]); } }
    const m = new MEngine(p.queries, { levels: p.dataSources ?? {}, ignore: true });
    try { refreshModel(p, m); } catch { /* reported by refresh history */ }
    recalc(p.model);
  }
  dataCache.set(key, p);
  return p;
}
function emptyModelProject(name: string): Project { return { version: 1, name, queries: [], model: { tables: [], measures: [], relationships: [], hierarchies: [], roles: [] }, report: { pages: [], reportFilters: [], bookmarks: [], theme: 'Default' }, settings: { autoDateTime: true, autodetectRelationships: false } }; }
export function invalidateData(id?: string) { if (!id) dataCache.clear(); else for (const k of [...dataCache.keys()]) if (k.startsWith(id + '|')) dataCache.delete(k); }

// ---------------------------------------------------------------- publish from Desktop
export function publish(project: Project, wsId: string, opts: { liveModelId?: string } = {}): { model?: Item; report: Item; replaced: boolean } {
  const s = svc.get(); const w = ws(wsId)!; const t = now();
  let replaced = false;
  let model: Item | undefined;
  if (!opts.liveModelId) {
    model = s.items.find(i => i.wsId === wsId && i.type === 'SemanticModel' && i.name === project.name);
    const proj = stripRows(JSON.parse(JSON.stringify(project, replacer), reviver)) as Project;
    proj.report = { pages: [], reportFilters: [], bookmarks: [], theme: project.report.theme };
    if (model) { replaced = true; model.project = proj; model.modified = t; model.label = project.report.sensitivity ?? model.label; invalidateData(model.id); }
    else {
      model = { id: sid('sm'), wsId, type: 'SemanticModel', name: project.name, owner: s.me, created: t, modified: t, perms: [], views: [], project: proj, label: project.report.sensitivity,
        refresh: { enabled: false, frequency: 'Daily', days: [], times: [], notifyOwner: true, contacts: [], failures: 0 }, history: [], gatewayMap: {}, cloudCreds: {}, rls: {} };
      s.items.push(model);
    }
    model.lastRefresh = t; model.history = [...(model.history ?? []), { at: t, kind: 'On demand', status: 'Completed', msg: 'Published from Power BI Desktop with its data.' }];
    // RLS roles keep their members; new roles start empty
    model.rls = Object.fromEntries(proj.model.roles.map(r => [r.name, model!.rls?.[r.name] ?? []]));
  }
  let report = s.items.find(i => i.wsId === wsId && i.type === 'Report' && i.name === project.name);
  const rep = JSON.parse(JSON.stringify(project.report, replacer), reviver) as Report;
  const settings = { personalize: project.report.settings?.personalize, exportData: project.report.settings?.exportData, persistentFilters: !project.report.settings?.persistentFilters };
  if (report) { replaced = true; report.report = rep; report.modified = t; report.modelId = opts.liveModelId ?? model!.id; report.settings = settings; report.label = project.report.sensitivity ?? report.label; }
  else { report = { id: sid('rp'), wsId, type: 'Report', name: project.name, owner: s.me, created: t, modified: t, perms: [], views: [], report: rep, modelId: opts.liveModelId ?? model!.id, settings, label: project.report.sensitivity ?? (opts.liveModelId ? item(opts.liveModelId)?.label : undefined) }; s.items.push(report); }
  // sensitivity labels flow downstream from the semantic model when the report has none (downstream inheritance)
  if (!report.label && model?.label) report.label = model.label;
  log(`Published ${project.name} to ${w.name}`);
  return { model, report, replaced };
}

// ---------------------------------------------------------------- refresh
export interface SourceStatus { src: SourceRef; cloud: boolean; ok: boolean; how: string; fix?: string }
/** Which sources need a gateway, and whether this semantic model can reach each one. */
export function sourceStatus(it: Item): SourceStatus[] {
  const p = it.project; if (!p) return [];
  const params = paramValues(p.queries);
  const srcs = p.queries.flatMap(q => directSources(q.code, params)).filter((x, i, a) => a.findIndex(y => y.key === x.key) === i);
  const s = svc.get();
  return srcs.map(src => {
    const cloud = src.kind === 'Web' || (src.kind === 'SQL' && /\.(database\.windows\.net|fabric\.microsoft\.com|datawarehouse\.)/i.test(src.args[0]));
    if (cloud) {
      const ok = !!it.cloudCreds?.[src.key];
      return { src, cloud, ok, how: ok ? 'Cloud source · OAuth2 credentials saved' : 'Cloud source · no gateway needed', fix: ok ? undefined : 'Edit credentials (Data source credentials) and sign in with OAuth2.' };
    }
    const connId = it.gatewayMap?.[src.key];
    const conn = s.gateways.flatMap(g => g.conns.map(c => ({ g, c }))).find(x => x.c.id === connId);
    if (!conn) {
      const personal = s.gateways.find(g => g.mode === 'Personal' && g.owner === (it.takeover ?? it.owner) && g.online);
      if (personal) {
        const dq = p.model.tables.some(t => t.storageMode === 'DirectQuery');
        return { src, cloud, ok: !dq, how: dq ? 'Personal gateway can\'t be used for DirectQuery' : `Personal gateway (${personal.name}) of ${principalLabel(personal.owner)}`, fix: dq ? 'Use a standard (enterprise) gateway for DirectQuery sources.' : undefined };
      }
      return { src, cloud, ok: false, how: 'On-premises source · needs a gateway', fix: 'Map it to a gateway connection (Gateway and cloud connections), or install a personal gateway.' };
    }
    const owner = it.takeover ?? it.owner;
    if (!conn.g.online) return { src, cloud, ok: false, how: `${conn.g.name} › ${conn.c.name}`, fix: 'The gateway is offline.' };
    if (!conn.c.users.some(u => isMember(owner, u))) return { src, cloud, ok: false, how: `${conn.g.name} › ${conn.c.name}`, fix: `${principalLabel(owner)} isn't a user of this gateway connection. A gateway admin must add them (Manage connections and gateways › Manage users).` };
    return { src, cloud, ok: true, how: `${conn.g.name} › ${conn.c.name} (${conn.c.auth})` };
  });
}
export function matchingConnections(src: SourceRef) {
  return svc.get().gateways.filter(g => g.mode === 'Standard').flatMap(g => g.conns.filter(c => (src.kind === 'SQL' ? c.kind === 'SQL' && c.path.toLowerCase() === src.args[0].toLowerCase() && (c.db ?? '').toLowerCase() === (src.args[1] ?? '').toLowerCase() : c.kind === src.kind && c.path.toLowerCase() === src.args[0].toLowerCase())).map(c => ({ g, c })));
}

export function refreshNow(it: Item, kind: RefreshRun['kind'] = 'On demand'): RefreshRun {
  const p = it.project;
  const t = now();
  let run: RefreshRun;
  if (p?.model.tables.every(x => x.storageMode === 'DirectQuery' || x.storageMode === 'DirectLake' || x.expression || x.calculationGroup) && p.model.tables.some(x => x.storageMode)) {
    run = { at: t, kind, status: 'Completed', msg: p.model.tables.some(x => x.storageMode === 'DirectLake') ? 'Direct Lake: reframed to the latest version of the Delta tables (no data was copied).' : 'DirectQuery: no data is imported; the visuals query the source directly. Only the cache was refreshed.' };
  } else {
    const bad = sourceStatus(it).filter(x => !x.ok);
    if (bad.length) run = { at: t, kind, status: 'Failed', msg: bad.map(b => `${b.src.label}: ${b.fix ?? b.how}`).join('\n') };
    else {
      const t0 = performance.now();
      invalidateData(it.id);
      const d = modelData({ ...it, lastRefresh: t + 1 });
      const errs = (d.model.tables as ModelTable[]).filter(x => !x.expression && !x.rows.length && !x.calculationGroup).map(x => x.name);
      run = errs.length && !d.model.tables.length ? { at: t, kind, status: 'Failed', msg: `No data was returned for ${errs.join(', ')}.` } : { at: t, kind, status: 'Completed', ms: Math.round(performance.now() - t0) + 800, msg: incrementalNote(it) };
    }
  }
  it.history = [...(it.history ?? []), run].slice(-40);
  if (run.status === 'Completed') { it.lastRefresh = t; if (it.refresh) it.refresh.failures = 0; invalidateData(it.id); afterRefresh(it); }
  else if (it.refresh) {
    it.refresh.failures++;
    const to = [...(it.refresh.notifyOwner ? [it.takeover ?? it.owner] : []), ...it.refresh.contacts];
    for (const u of to) mail(u, `Refresh failed: ${it.name}`, `The ${kind.toLowerCase()} refresh of the semantic model "${it.name}" in ${ws(it.wsId)!.name} failed.\n\n${run.msg}\n\nConsecutive failures: ${it.refresh.failures}.`);
    if (it.refresh.failures >= 4 && it.refresh.enabled) { it.refresh.enabled = false; for (const u of to) mail(u, `Scheduled refresh disabled: ${it.name}`, `Power BI turned off the refresh schedule for "${it.name}" after four consecutive failures. Fix the problem, then turn the schedule back on.`); }
  }
  log(`${kind} refresh of ${it.name}: ${run.status}`);
  return run;
}
function incrementalNote(it: Item) {
  const pol = (it.project?.model.tables ?? []).find(t => (t as any).incremental);
  if (!pol) return undefined;
  const ir = (pol as any).incremental as { store: number; storeUnit: string; refresh: number; refreshUnit: string };
  return `Incremental refresh on ${pol.name}: ${(it.history?.filter(h => h.status === 'Completed').length ?? 0) <= 1 ? `first refresh created partitions for the last ${ir.store} ${ir.storeUnit}` : `only the last ${ir.refresh} ${ir.refreshUnit} were refreshed; older partitions were kept`}.`;
}

/** Scheduled refresh limits: 8 a day on shared capacity (Pro), 48 on Premium, PPU and Fabric. */
export function maxRefreshes(w: Workspace) { return w.license === 'Pro' || w.personal ? 8 : 48; }

// ---------------------------------------------------------------- after refresh: tiles, alerts, subscriptions
let tileEval: ((t: Tile, upn: string) => { value?: any; series?: any }) | null = null;
export function setTileEvaluator(f: typeof tileEval) { tileEval = f; }
function afterRefresh(model: Item) {
  const s = svc.get();
  for (const d of s.items.filter(x => x.type === 'Dashboard')) {
    for (const tile of d.tiles ?? []) {
      if (item(tile.reportId)?.modelId !== model.id) continue;
      for (const al of tile.alerts.filter(a => a.active)) checkAlert(d, tile, al);
    }
  }
  for (const it of s.items) for (const sub of it.subs ?? []) if (sub.enabled && sub.frequency === 'After data refresh' && (it.modelId === model.id || it.tiles?.some(t => item(t.reportId)?.modelId === model.id))) sendSub(it, sub);
}
export function checkAlert(d: Item, tile: Tile, al: Alert) {
  if (!tileEval) return;
  const v = tileEval(tile, al.owner).value;
  if (typeof v !== 'number') return;
  const hit = al.condition === 'above' ? v > al.threshold : v < al.threshold;
  const due = !al.last || now() - al.last >= (al.frequency === 'hour' ? HOUR : DAY);
  if (hit && due) {
    al.last = now();
    mail(al.owner, `Alert: ${al.title}`, `${tile.title} is ${v.toLocaleString()} (${al.condition} your threshold of ${al.threshold.toLocaleString()}) on the dashboard "${d.name}".\n\nAlerts are personal: only you receive this one. Manage it from the tile's More options › Manage alerts.`);
  }
}
export function sendSub(it: Item, sub: Sub) {
  const body = `Here's your subscription to "${it.name}"${sub.pages?.length ? ` (${sub.pages.length} page${sub.pages.length > 1 ? 's' : ''})` : ''}. Open it in Power BI to see the latest data.${sub.format && sub.format !== 'Link' ? `\nAttachment: ${it.name}.${sub.format === 'PDF' ? 'pdf' : 'pptx'}${it.label ? ` (labeled ${it.label})` : ''}` : ''}\n\nRow-level security is applied for each recipient.`;
  for (const r of sub.recipients) mail(r, `Subscription: ${sub.name}`, body, `${principalLabel(sub.owner)} via Power BI`);
}

/** Move the simulated clock forward and run whatever is due: scheduled refreshes, subscriptions, alerts. */
export function advance(ms: number) {
  svc.change(s => {
    const start = s.clock, end = s.clock + ms;
    for (let t = start + HOUR; t <= end; t += HOUR) {
      s.clock = t;
      const d = new Date(t); const hh = `${String(d.getHours()).padStart(2, '0')}:00`; const day = d.toLocaleString('en-US', { weekday: 'long' });
      for (const it of s.items.filter(x => x.type === 'SemanticModel' && x.refresh?.enabled)) {
        const r = it.refresh!;
        if (r.times.some(x => x.slice(0, 2) === hh.slice(0, 2)) && (r.frequency === 'Daily' || r.days.includes(day))) refreshNow(it, 'Scheduled');
      }
      for (const it of s.items) for (const sub of it.subs ?? []) {
        if (!sub.enabled || sub.frequency === 'After data refresh') continue;
        const due = sub.frequency === 'Hourly' || (sub.time.slice(0, 2) === hh.slice(0, 2) && (sub.frequency === 'Daily' || (sub.frequency === 'Weekly' && day === 'Monday') || (sub.frequency === 'Monthly' && d.getDate() === 1)));
        if (due) sendSub(it, sub);
      }
    }
    s.clock = end;
  });
}

// reachable from the console for debugging and tests
(globalThis as any).__svc = { svc, item, ws, access, can, refreshNow, advance, publish, sourceStatus, roleIn };
