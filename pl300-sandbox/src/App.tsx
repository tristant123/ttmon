import React, { useEffect, useState } from 'react';
import { switchToImport, makeChangesToModel } from './ui/actions';
import { pageRefreshTick } from './ui/report/vhelpers';
import { MobileLayoutEditor } from './ui/report/MobileLayout';
import { ServiceApp } from './service/Service';
import { me as svcMe } from './service/model';
import { CopilotPane } from './ui/Copilot';
import { useStore, store } from './store';
import { I } from './ui/icons';
import { MenuHost } from './ui/common';
import { Ribbon } from './ui/Ribbon';
import { Canvas, PageTabs, TooltipLayer } from './ui/report/Canvas';
import { DataPane } from './ui/panes/DataPane';
import { VizPane } from './ui/panes/VizPane';
import { FiltersPane } from './ui/panes/FiltersPane';
import { BookmarksPane, SelectionPane, PerfPane, SyncSlicersPane } from './ui/panes/OtherPanes';
import { FormulaBar } from './ui/FormulaBar';
import { TableView } from './ui/views/TableView';
import { ModelView } from './ui/views/ModelView';
import { DaxView } from './ui/views/DaxView';
import { PowerQueryEditor } from './ui/pq/PowerQuery';
import { DialogHost } from './ui/dialogs/DialogHost';
import { Backstage } from './ui/Backstage';
import { TutorialPanel, TutorialHome } from './tutorials/TutorialUI';
import { copyVisuals, pasteVisuals, deleteSelected } from './ui/actions';
import { saveProjectFile } from './io/project';

function TitleBar() {
  const s = useStore();
  return <div className="titlebar">
    <span className="logo"><I n="logo" s={18} /></span>
    <div className="qat">
      <button className="iconbtn" title="Save (Ctrl+S)" onClick={() => saveProjectFile()}><I n="save" s={15} /></button>
      <button className="iconbtn" title="Undo (Ctrl+Z)" disabled={!s.undoStack.length} onClick={() => s.undo()}><I n="undo" s={15} /></button>
      <button className="iconbtn" title="Redo (Ctrl+Y)" disabled={!s.redoStack.length} onClick={() => s.redo()}><I n="redo" s={15} /></button>
    </div>
    <div className="name">{s.project.name}{s.project.report.sensitivity && <span className="sens">{s.project.report.sensitivity}</span>} - Power BI Desktop <span className="tiny">· PL-300 Sandbox</span></div>
    <div className="search"><I n="search" s={13} /><input placeholder="Search" aria-label="Search commands" onKeyDown={e => {
      if (e.key !== 'Enter') return;
      const q = (e.target as HTMLInputElement).value.toLowerCase();
      const cmds: [string, () => void][] = [['measure', () => import('./ui/actions').then(a => a.startNewMeasure())], ['column', () => import('./ui/actions').then(a => a.startNewColumn())], ['relationship', () => s.openDialog({ type: 'relationships' })], ['role', () => s.openDialog({ type: 'roles' })], ['transform', () => import('./ui/actions').then(a => a.openPowerQuery())], ['power query', () => import('./ui/actions').then(a => a.openPowerQuery())], ['get data', () => s.openDialog({ type: 'getData' })], ['tutorial', () => s.setUI({ showTutorials: true })], ['dax', () => s.setUI({ view: 'dax' })], ['model', () => s.setUI({ view: 'model' })], ['table', () => s.setUI({ view: 'table' })], ['bookmark', () => s.setUI({ panes: { ...s.ui.panes, bookmarks: true } })]];
      const hit = cmds.find(([k]) => q.includes(k));
      if (hit) hit[1](); else s.toast('Try "new measure", "relationships", "transform data", "tutorials" or "DAX query".');
    }} /></div>
    <button className="iconbtn" title="PL-300 tutorials" onClick={() => s.setUI({ showTutorials: true })}><I n="grad" s={16} /><span className="qat-extra" style={{ fontSize: 12 }}>Tutorials</span></button>
    <button className="iconbtn svc-switch" title="Open the (simulated) Power BI service: workspaces, sharing, apps, refresh, gateways" onClick={() => s.setUI({ app: 'service' })}><I n="cloud" s={16} /><span className="qat-extra" style={{ fontSize: 12 }}>Power BI service</span></button>
    <div className="who" title={`Signed in as ${svcMe().name} (${svcMe().upn})`}>{svcMe().name.split(' ').map(x => x[0]).join('')}</div>
  </div>;
}

function Rail() {
  const s = useStore();
  const views: [typeof s.ui.view, string, string][] = [['report', 'report', 'Report view'], ['table', 'table', 'Table view'], ['model', 'model', 'Model view'], ['dax', 'dax', 'DAX query view']];
  return <div className="rail" role="tablist" aria-label="Views">
    {views.map(([v, icon, label]) => <button key={v} role="tab" aria-selected={s.ui.view === v} className={s.ui.view === v ? 'active' : ''} title={label} onClick={() => s.setUI({ view: v, ribbon: 'Home', selected: [] })}><I n={icon} s={22} /></button>)}
    <div className="sep" />
    <button title="PL-300 tutorials" onClick={() => s.setUI({ showTutorials: true })} style={{ marginBottom: 8 }}><I n="grad" s={22} /></button>
  </div>;
}

function StatusBar() {
  const s = useStore();
  const pages = s.project.report.pages; const i = pages.findIndex(p => p.id === s.ui.pageId);
  const t = s.project.model.tables.find(x => x.name === s.ui.tableViewTable) ?? s.project.model.tables[0];
  return <div className="statusbar">
    {s.ui.view === 'report' && <span>Page {i + 1} of {pages.length}</span>}
    {s.ui.view === 'table' && t && <span>Table: {t.name} ({t.rows.length.toLocaleString()} rows){s.ui.field?.column ? ` · Column: ${s.ui.field.column} (${new Set(t.rows.map(r => { const v = r[t.columns.findIndex(c => c.name === s.ui.field!.column)]; return v instanceof Date ? v.getTime() : v; })).size.toLocaleString()} distinct values)` : ''}</span>}
    {s.ui.viewAs && <span style={{ background: '#fff4ce', padding: '0 8px', borderRadius: 3, color: '#252423' }}>Now viewing as: {s.ui.viewAs.roles.join(', ')}{s.ui.viewAs.user ? ` (${s.ui.viewAs.user})` : ''} · <button className="iconbtn" style={{ height: 18 }} onClick={() => { s.ui.viewAs = null; s.rebuildDax(); s.emit(); }}>Stop viewing</button></span>}
    {s.refreshErrors.length > 0 && <button className="iconbtn" style={{ height: 20, color: '#a4262c' }} onClick={() => s.openDialog({ type: 'loadErrors', errors: s.refreshErrors })}><I n="warning" s={13} /> {s.refreshErrors.length} issue{s.refreshErrors.length > 1 ? 's' : ''}</button>}
    <span className="grow" />
    {(s.project as any).liveConnection && !(s.project as any).liveConnection.composite && <span>Connected live to the Power BI semantic model: {(s.project as any).liveConnection.name} in {(s.project as any).liveConnection.ws} · <button className="iconbtn" style={{ height: 20, textDecoration: 'underline' }} onClick={() => makeChangesToModel()}>Make changes to this model</button></span>}
    {(() => {
      if ((s.project as any).liveConnection && !(s.project as any).liveConnection.composite) return null;
      const modes = new Set(s.project.model.tables.filter(x => !x.expression && !x.calculationGroup).map(x => x.storageMode ?? 'Import'));
      const label = modes.size > 1 ? 'Mixed' : [...modes][0] === 'DirectLake' ? 'Direct Lake' : [...modes][0] ?? 'Import';
      const dq = modes.has('DirectQuery') || modes.has('Dual');
      return dq ? <button className="iconbtn" style={{ height: 20 }} title="Switch all tables to Import mode" onClick={() => switchToImport()}>Storage mode: {label} (click to change)</button> : <span>Storage mode: {label}</span>;
    })()}
    {s.ui.view === 'report' && <><button className="iconbtn" style={{ height: 20 }} onClick={() => s.setUI({ zoom: Math.max(20, (s.ui.zoom || 100) - 10) })}>−</button>
      <input type="range" min={20} max={200} value={s.ui.zoom || 100} onChange={e => s.setUI({ zoom: +e.target.value })} aria-label="Zoom" />
      <button className="iconbtn" style={{ height: 20 }} onClick={() => s.setUI({ zoom: Math.min(200, (s.ui.zoom || 100) + 10) })}>+</button>
      <span>{s.ui.zoom ? s.ui.zoom + '%' : 'Fit'}</span>
      <button className="iconbtn" style={{ height: 20 }} title="Fit to page" onClick={() => s.setUI({ zoom: 0 })}><I n="fitpage" s={14} /></button></>}
  </div>;
}

function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth < 860);
  useEffect(() => { const f = () => setN(window.innerWidth < 860); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return n;
}

function ReportView() {
  const s = useStore();
  if (s.ui.mobileLayout) return <MobileLayoutEditor />;
  return <DesktopReportView />;
}

function DesktopReportView() {
  const s = useStore();
  const page = s.page();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  useEffect(() => {
    if (!page.refresh?.on) return;
    const h = setInterval(() => { if (pageRefreshTick(store.page())) setLastRefresh(new Date()); }, Math.max(1, page.refresh.seconds) * 1000);
    return () => clearInterval(h);
  }, [page.id, page.refresh?.on, page.refresh?.seconds, page.refresh?.type, page.refresh?.measure]);
  const narrow = useNarrow();
  const [drawer, setDrawer] = useState<string | null>(null);
  const panes = <>
    {s.ui.panes.bookmarks && <BookmarksPane />}
    {s.ui.panes.selection && <SelectionPane />}
    {s.ui.panes.sync && <SyncSlicersPane />}
    {s.ui.copilot && <CopilotPane />}
    {s.ui.panes.perf && <PerfPane />}
    {s.ui.panes.filters && s.ui.focus !== 'reading' && (!narrow || drawer === 'filters') && <FiltersPane />}
    {s.ui.focus !== 'reading' && (!narrow || drawer === 'viz') && <VizPane />}
    {s.ui.focus !== 'reading' && (!narrow || drawer === 'data') && <DataPane />}
  </>;
  return <>
    <div className="center">
      <FormulaBar />
      {s.ui.focus === 'reading' && <div className="info" style={{ borderRadius: 0, display: 'flex', gap: 10, alignItems: 'center' }}>Reading view: click data points to cross-filter; buttons run on a plain click. <button className="btn sm" onClick={() => s.setUI({ focus: null })}>Back to editing</button></div>}
      {narrow && s.ui.focus !== 'reading' && <div style={{ display: 'flex', gap: 4, padding: 4, background: '#fff', borderBottom: '1px solid #e1dfdd' }}>
        {[['filters', 'Filters'], ['viz', 'Visualizations'], ['data', 'Data']].map(([k, l]) => <button key={k} className={`btn sm ${drawer === k ? 'primary' : ''}`} onClick={() => setDrawer(drawer === k ? null : k)}>{l}</button>)}
      </div>}
      <Canvas />
      <TooltipLayer />
      {page.refresh?.on && <div className="tiny" style={{ position: 'absolute', right: 12, bottom: 44, background: '#fff', border: '1px solid var(--line)', borderRadius: 3, padding: '2px 8px' }}>Page refresh every {page.refresh.seconds}s{page.refresh.type === 'change' ? ` (change detection on ${page.refresh.measure || '…'})` : ''}{lastRefresh ? ` · last ${lastRefresh.toLocaleTimeString()}` : ''}</div>}
      <PageTabs />
    </div>
    {narrow ? (drawer || s.ui.panes.bookmarks || s.ui.panes.selection || s.ui.panes.perf) && <div className="panes-narrow">{panes}</div> : panes}
  </>;
}

export function App() {
  const s = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    store.load().then(had => { setReady(true); if (!had) store.openDialog({ type: 'welcome' }); });
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      const typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProjectFile(); return; }
      if (typing || store.ui.pq || store.ui.dialogs.length || store.ui.app === 'service') return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); store.redo(); }
      else if (store.ui.view === 'report') {
        if (mod && e.key.toLowerCase() === 'c') copyVisuals();
        else if (mod && e.key.toLowerCase() === 'v') pasteVisuals();
        else if (e.key === 'Delete' || e.key === 'Backspace') { if (store.ui.selected.length) { e.preventDefault(); deleteSelected(); } }
        else if (e.key === 'Escape') store.setUI({ selected: [], cross: null, focus: store.ui.focus === 'reading' ? 'reading' : null });
        else if (store.ui.selected.length && e.key.startsWith('Arrow')) {
          e.preventDefault(); const d = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
          store.change(p => { for (const pg of p.report.pages) for (const v of pg.visuals) if (store.ui.selected.includes(v.id)) { v.x += dx; v.y += dy; } });
        }
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  if (ready && s.ui.app === 'service') return <div className="app svc-root">
    <ServiceApp />
    {s.ui.showTutorials && <TutorialHome />}
    {s.ui.tutorial && <TutorialPanel />}
    <DialogHost />
    <MenuHost />
    {s.ui.toast && <div className={`toast ${s.ui.toast.kind === 'error' ? 'error' : ''}`} role="status">{s.ui.toast.text}</div>}
  </div>;
  if (!ready) return <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#f3f2f1' }}><div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><I n="logo" s={28} /> Loading Power BI sandbox…</div></div>;
  return <div className="app">
    <TitleBar />
    <Ribbon />
    <div className="main">
      <Rail />
      <div className="workspace">
        {s.ui.view === 'report' && <ReportView />}
        {s.ui.view === 'table' && <TableView />}
        {s.ui.view === 'model' && <ModelView />}
        {s.ui.view === 'dax' && <DaxView />}
      </div>
    </div>
    <StatusBar />
    {s.ui.pq && <PowerQueryEditor />}
    {s.ui.backstage && <Backstage />}
    {s.ui.tutorial && <TutorialPanel />}
    {s.ui.showTutorials && <TutorialHome />}
    <DialogHost />
    <MenuHost />
    {s.ui.toast && <div className={`toast ${s.ui.toast.kind === 'error' ? 'error' : ''}`} role="status">{s.ui.toast.text}</div>}
  </div>;
}
