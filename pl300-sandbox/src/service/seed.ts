// Seed content for the simulated service: the Contoso Sales semantic model and report in Sales Analytics.
import { store } from '../store';
import { sampleFiles } from '../data/sample';
import { scenarioProject, starScenario, OVERVIEW_PAGES } from '../tutorials/scenarios';
import { directSources, paramValues } from '../m/privacy';
import { svc, publish, matchingConnections, item, log } from './model';

export async function ensureSeedContent() {
  const s = svc.get();
  if (s.items.some(i => i.type === 'SemanticModel' && i.wsId === 'ws-sales') || (s as any).seeded) return;
  if (!store.files.some(f => f.name === 'Sales.csv')) await store.addFiles(sampleFiles());
  const p = scenarioProject('Contoso Sales', starScenario({
    pages: OVERVIEW_PAGES,
    roles: [
      { name: 'Store Managers', filters: { Store: '[ManagerEmail] = USERPRINCIPALNAME()' } },
      { name: 'Europe', filters: { Store: '[Region] = "Europe"' } },
    ],
  }));
  p.report.sensitivity = 'General';
  svc.change(st => {
    const me = st.me; st.me = 'pat@contoso.com';
    const { model, report } = publish(p, 'ws-sales');
    st.me = me;
    model!.endorsement = 'Certified'; model!.description = 'Certified Contoso sales model: star schema with Sales, Product, Customer, Store and Date.';
    model!.rls = { 'Store Managers': ['Sales Managers'], Europe: [] };
    const params = paramValues(p.queries);
    for (const src of p.queries.flatMap(q => directSources(q.code, params))) { const c = matchingConnections(src)[0]; if (c) model!.gatewayMap![src.key] = c.c.id; }
    model!.refresh = { enabled: true, frequency: 'Daily', days: [], times: ['06:00'], notifyOwner: true, contacts: [], failures: 0 };
    report.label = 'General';
    (st as any).seeded = true;
    log('Seeded Sales Analytics with Contoso Sales');
  });
  return item;
}
