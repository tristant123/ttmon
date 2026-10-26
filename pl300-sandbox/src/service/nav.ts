// Navigation inside the simulated Power BI service (its own tiny router).
import { useSyncExternalStore } from 'react';
import { store, UI } from '../store';
import { svc, item, access, me, modelData, isMember, ws, licenseBlock, Item } from './model';
import { Project, Report } from '../model/types';

export type Route =
  | { page: 'home' } | { page: 'workspaces' } | { page: 'ws'; id: string; view?: 'list' | 'lineage' }
  | { page: 'item'; id: string; pageId?: string; app?: string } | { page: 'settings'; id: string; tab?: string }
  | { page: 'apps' } | { page: 'app'; id: string; itemId?: string } | { page: 'appEdit'; wsId: string }
  | { page: 'pipelines'; id?: string } | { page: 'gateways' } | { page: 'admin' } | { page: 'inbox' } | { page: 'usage'; id: string }
  | { page: 'catalog' } | { page: 'paginatedEdit'; id?: string; wsId: string } | { page: 'excel'; id: string } | { page: 'web'; id: string };

let route: Route = { page: 'home' };
let rv = 0;
const ls = new Set<() => void>();
export const nav = {
  get: () => route,
  go(r: Route) {
    if (store.session && !(r.page === 'item' && route.page === 'item' && r.id === route.id)) leaveReport();
    route = r; rv++; ls.forEach(f => f());
  },
  subscribe: (f: () => void) => { ls.add(f); return () => { ls.delete(f); }; },
};
export function useRoute() { useSyncExternalStore(nav.subscribe, () => rv); return route; }
export function useSvc() { useSyncExternalStore(svc.subscribe, svc.version); return svc.get(); }

/** The viewer's RLS: roles they belong to, or no data if RLS applies and they're in none. */
export function rlsFor(model: Item, upn: string): UI['viewAs'] {
  const a = access(model, upn);
  const roles = model.project?.model.roles ?? [];
  if (!a.rls || !roles.length) return null;
  const mine = roles.filter(r => (model.rls?.[r.name] ?? []).some(p => isMember(upn, p))).map(r => r.name);
  return { roles: mine.length ? mine : ['__deny__'], user: upn };
}

/** Open a report (or an app's copy of it) in the service viewer, as the signed-in user. */
export function openReport(it: Item, opts: { report?: Report; pageId?: string; viewAs?: UI['viewAs']; app?: string } = {}) {
  const model = it.modelId ? item(it.modelId) : undefined;
  const upn = svc.get().me;
  if (!model) { store.toast('The semantic model behind this report no longer exists.', 'error'); return; }
  const data = modelData(model);
  const report: Report = JSON.parse(JSON.stringify(opts.report ?? it.report));
  // personalizations and persistent filters for this user
  const pers = it.personal?.[upn];
  if (pers?.visuals) for (const pg of report.pages) for (const v of pg.visuals) if (pers.visuals[v.id]) Object.assign(v, pers.visuals[v.id]);
  if ((pers as any)?.state && it.settings?.persistentFilters !== false) for (const pg of report.pages) { const st = (pers as any).state[pg.id]; if (st) { pg.filters = st.filters; for (const v of pg.visuals) if (st.slicers[v.id]) v.slicer = st.slicers[v.id]; } }
  const p: Project = { ...data, name: it.name, report };
  const viewAs = opts.viewAs !== undefined ? opts.viewAs : rlsFor(model, upn);
  store.enterSession(p, it.id, viewAs, opts.pageId);
  svc.change(s => { item(it.id)?.views.push({ upn: s.me, at: s.clock, page: store.ui.pageId }); });
}

/** Leaving a report: keep this user's slicer and filter state (persistent filters). */
export function leaveReport() {
  const ss = store.session; if (!ss) return;
  const it = item(ss.itemId);
  if (it && it.type === 'Report' && it.settings?.persistentFilters !== false) {
    const upn = svc.get().me;
    const state = Object.fromEntries(store.project.report.pages.map(pg => [pg.id, { filters: pg.filters, slicers: Object.fromEntries(pg.visuals.filter(v => v.type === 'slicer').map(v => [v.id, v.slicer])) }]));
    svc.change(() => { it.personal ??= {}; it.personal[upn] = { ...(it.personal[upn] ?? { visuals: {} }), state } as any; });
  }
  store.exitSession();
}

export function canOpen(it: Item, upn = svc.get().me): string | null {
  const w = ws(it.wsId)!;
  const lb = licenseBlock(w, upn);
  if (lb && !(w.personal === upn)) {
    // app users still need a license to view unless the app's workspace is on capacity
    return lb;
  }
  if (!access(it, upn).read) return `${me().name} doesn't have access to "${it.name}". Ask the owner to share it, add you to the workspace, or include you in an app audience.`;
  return null;
}
