// Bookmarks, Selection and Performance analyzer panes.
import React, { useState } from 'react';
import { useStore, store, uid } from '../../store';
import { I } from '../icons';
import { menuAt } from '../common';
import { captureBookmark, applyBookmark } from '../report/bookmarks';
import { vdef } from '../../report/visuals';
import { isValueField, fieldLabel } from '../../report/query';
import { Visual } from '../../model/types';
import { clearQueryCache } from '../report/vhelpers';

function PaneShell({ title, onClose, children, width = 230 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return <div className="pane" style={{ width }}>
    <div className="pane-h"><span>{title}</span><button className="iconbtn" onClick={onClose} aria-label={`Close ${title}`}><I n="close" s={12} /></button></div>
    <div className="pane-body">{children}</div>
  </div>;
}

export function BookmarksPane() {
  const s = useStore();
  const [edit, setEdit] = useState<string | null>(null);
  const bms = s.project.report.bookmarks;
  return <PaneShell title="Bookmarks" onClose={() => s.setUI({ panes: { ...s.ui.panes, bookmarks: false } })}>
    <div className="row" style={{ marginBottom: 8 }}>
      <button className="btn sm" onClick={() => s.change(p => { p.report.bookmarks.push(captureBookmark(`Bookmark ${p.report.bookmarks.length + 1}`)); })}>Add</button>
      <button className="btn sm" disabled={!bms.length} onClick={() => s.setUI({ focus: 'reading' })}>View</button>
    </div>
    {!bms.length && <div className="tiny">A bookmark captures the current page, its filters and slicers, drill state and which visuals are visible. Select <b>Add</b> to capture it.</div>}
    {bms.map(b => edit === b.id
      ? <input key={b.id} className="tx" autoFocus defaultValue={b.name} onBlur={e => { setEdit(null); s.change(p => { p.report.bookmarks.find(x => x.id === b.id)!.name = e.target.value; }); }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      : <div key={b.id} className="tree-item" style={{ paddingLeft: 6 }} onClick={() => applyBookmark(b)} onDoubleClick={() => setEdit(b.id)}
        onContextMenu={e => menuAt(e, [
          { label: 'Update', onClick: () => s.change(p => { const nb = captureBookmark(b.name); const x = p.report.bookmarks.find(y => y.id === b.id)!; x.state = nb.state; x.pageId = nb.pageId; }) },
          { label: 'Rename', onClick: () => setEdit(b.id) },
          { label: 'Delete', onClick: () => s.change(p => { p.report.bookmarks = p.report.bookmarks.filter(x => x.id !== b.id); }) },
          { sep: true },
          { label: 'Data', checked: b.data, onClick: () => s.change(p => { const x = p.report.bookmarks.find(y => y.id === b.id)!; x.data = !x.data; }) },
          { label: 'Display', checked: b.display, onClick: () => s.change(p => { const x = p.report.bookmarks.find(y => y.id === b.id)!; x.display = !x.display; }) },
          { label: 'Current page', checked: b.currentPage, onClick: () => s.change(p => { const x = p.report.bookmarks.find(y => y.id === b.id)!; x.currentPage = !x.currentPage; }) },
        ])}>
        <I n="bookmark" s={14} /><span className="nm">{b.name}</span><span className="tiny">{s.project.report.pages.find(p => p.id === b.pageId)?.name}</span>
      </div>)}
    {bms.length > 0 && <div className="tiny" style={{ marginTop: 8 }}>Right-click a bookmark to update it or to choose whether it captures Data, Display and Current page.</div>}
  </PaneShell>;
}

export function SelectionPane() {
  const s = useStore();
  const page = s.page();
  const vs = [...page.visuals].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  return <PaneShell title="Selection" onClose={() => s.setUI({ panes: { ...s.ui.panes, selection: false } })}>
    <div className="row" style={{ marginBottom: 8 }}>
      <button className="btn sm" onClick={() => s.change(p => { p.report.pages.find(x => x.id === page.id)!.visuals.forEach(v => { v.hidden = false; }); })}>Show all</button>
      <button className="btn sm" onClick={() => s.change(p => { p.report.pages.find(x => x.id === page.id)!.visuals.forEach(v => { v.hidden = true; }); })}>Hide all</button>
    </div>
    <div className="tiny" style={{ marginBottom: 6 }}>Layer order (top first). Hidden visuals stay hidden in reading view and in bookmarks that capture Display.</div>
    {vs.map(v => <div key={v.id} className={`tree-item ${s.ui.selected.includes(v.id) ? 'selected' : ''}`} style={{ paddingLeft: 6 }} onClick={() => s.setUI({ selected: [v.id] })}>
      <I n={'v_' + v.type} s={14} /><span className="nm">{v.format?.title || v.title || vdef(v.type).name}</span>
      <button className="iconbtn" onClick={e => { e.stopPropagation(); s.updateVisual(v.id, x => { x.hidden = !x.hidden; }); }} aria-label={v.hidden ? 'Show' : 'Hide'}><I n={v.hidden ? 'eyeOff' : 'eye'} s={14} /></button>
    </div>)}
  </PaneShell>;
}

/** View › Sync slicers: per page, whether the selected slicer filters (Sync) and shows (Visible). */
export function SyncSlicersPane() {
  const s = useStore();
  const v = s.selectedVisual();
  const close = () => s.setUI({ panes: { ...s.ui.panes, sync: false } });
  if (!v || v.type !== 'slicer') return <PaneShell title="Sync slicers" onClose={close}><div className="tiny">Select a slicer to see the pages it's synced with and visible on.</div></PaneShell>;
  const group = v.syncGroup;
  const copyOn = (pid: string) => s.project.report.pages.find(p => p.id === pid)!.visuals.find(x => x.type === 'slicer' && (x.id === v.id || (group && x.syncGroup === group)));
  const ensureGroup = (p: any) => { const self = p.report.pages.flatMap((pg: any) => pg.visuals).find((x: any) => x.id === v.id); if (!self.syncGroup) self.syncGroup = (v.wells.field?.[0]?.column ?? 'Slicer') + ' ' + Math.random().toString(36).slice(2, 6); return self.syncGroup as string; };
  const setState = (pid: string, patch: { sync?: boolean; visible?: boolean }) => {
    s.change(p => {
      const g = ensureGroup(p);
      const pg = p.report.pages.find(x => x.id === pid)!;
      let c = pg.visuals.find(x => x.type === 'slicer' && (x.id === v.id || x.syncGroup === g));
      const cur = { sync: !!c && !c.syncOff, visible: !!c && !c.hidden };
      const want = { ...cur, ...patch };
      if (!want.sync && !want.visible) { if (c && c.id !== v.id) pg.visuals = pg.visuals.filter(x => x !== c); else if (c) { c.hidden = true; c.syncOff = true; } return; }
      if (!c) { c = { ...JSON.parse(JSON.stringify(v)), id: uid('v'), syncGroup: g }; pg.visuals.push(c!); }
      c!.hidden = !want.visible; c!.syncOff = !want.sync;
      if (want.sync) c!.slicer = JSON.parse(JSON.stringify(v.slicer ?? { values: [] }));
    });
    clearQueryCache();
  };
  return <PaneShell title="Sync slicers" onClose={close} width={250}>
    <div className="tiny" style={{ marginBottom: 6 }}>{v.wells.field?.[0]?.column ?? 'Slicer'}</div>
    <table className="grid-table" style={{ width: '100%' }}><thead><tr><th>Page</th><th title="The slicer's selection filters this page">Sync</th><th title="The slicer is shown on this page">Visible</th></tr></thead><tbody>
      {s.project.report.pages.map(pg => { const c = copyOn(pg.id); return <tr key={pg.id}><td>{pg.name}</td>
        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!c && !c.syncOff} onChange={e => setState(pg.id, { sync: e.target.checked })} aria-label={`Sync on ${pg.name}`} /></td>
        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!c && !c.hidden} onChange={e => setState(pg.id, { visible: e.target.checked })} aria-label={`Visible on ${pg.name}`} /></td></tr>; })}
    </tbody></table>
    <button className="btn sm" style={{ marginTop: 8 }} onClick={() => s.project.report.pages.forEach(pg => setState(pg.id, { sync: true, visible: true }))}>Add and sync with all pages</button>
    <div className="section-h" style={{ marginTop: 10 }}>Advanced options</div>
    <div className="frow"><label className="tiny">Group name (slicers with the same group name sync)</label><input className="tx" defaultValue={group ?? ''} key={v.id} placeholder="(not synced)" onBlur={e => { const g = e.target.value.trim(); s.change(p => { for (const pg of p.report.pages) for (const x of pg.visuals) if (x.id === v.id || (group && x.syncGroup === group)) x.syncGroup = g || undefined; }); }} /></div>
    <div className="tiny" style={{ marginTop: 6 }}>Sync on, Visible off: the slicer filters that page but isn't shown there. Visible on, Sync off: a separate copy with its own selection.</div>
  </PaneShell>;
}

/** The DAX query Power BI would send for a visual (Performance analyzer › Copy query). */
export function daxQueryFor(v: Visual): string {
  const m = store.project.model;
  const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
  const fields = Object.entries(v.wells).filter(([k]) => k !== 'tooltips').flatMap(([, fs]) => fs).filter(f => !f.visualCalc);
  const groups = fields.filter(f => !isValueField(m, f) && f.column).map(f => `${q(f.table)}[${f.column}]`);
  const vals = fields.filter(f => isValueField(m, f)).map(f => `"${fieldLabel(f).replace(/"/g, '""')}", ${f.measure ? `[${f.measure}]` : `${({ Sum: 'SUM', Average: 'AVERAGE', Min: 'MIN', Max: 'MAX', Count: 'COUNTA', DistinctCount: 'DISTINCTCOUNT' } as any)[f.agg ?? 'Sum'] ?? 'SUM'}(${q(f.table)}[${f.column}])`}`);
  const slicers = store.page().visuals.filter(x => x.type === 'slicer' && x.slicer?.values?.length && x.wells.field?.[0]?.column);
  const defs = slicers.map((x, i) => `    VAR __DS0FilterTable${i ? i + 1 : ''} = TREATAS({${x.slicer!.values.map(val => (typeof val === 'number' ? val : `"${String(val).replace(/"/g, '""')}"`)).join(', ')}}, ${q(x.wells.field![0].table)}[${x.wells.field![0].column}])`);
  const args = [...groups, ...slicers.map((_x, i) => `__DS0FilterTable${i ? i + 1 : ''}`), ...vals];
  return `// DAX Query\n${defs.length ? `DEFINE\n${defs.join('\n')}\n\n` : ''}EVALUATE\n    SUMMARIZECOLUMNS(\n        ${args.join(',\n        ')}\n    )${groups.length ? `\nORDER BY ${groups[0]}` : ''}`;
}

export function PerfPane() {
  const s = useStore();
  const page = s.page();
  const [open, setOpen] = useState<string | null>(null);
  const dq = s.project.model.tables.some(t => t.storageMode === 'DirectQuery' || t.storageMode === 'Dual');
  const lake = s.project.model.tables.some(t => t.storageMode === 'DirectLake');
  return <PaneShell title="Performance analyzer" onClose={() => s.setUI({ panes: { ...s.ui.panes, perf: false } })} width={290}>
    <div className="row" style={{ marginBottom: 8 }}>
      <button className="btn sm" onClick={() => { clearQueryCache(); s.ui.perf = []; s.emit(); }}>Refresh visuals</button>
      <button className="btn sm" onClick={() => { s.ui.perf = []; s.emit(); }}>Clear</button>
    </div>
    <div className="tiny" style={{ marginBottom: 6 }}>Expand a visual to see its timings. <b>DAX query</b> is the engine time{dq && <>; <b>Direct query</b> is the time the source took (DirectQuery tables)</>}{lake && <>; Direct Lake reads columns from OneLake on first use</>}. Copy the query to tune it in DAX query view.</div>
    {page.visuals.filter(v => !['shape', 'image', 'textbox'].includes(v.type)).map(v => {
      const p = s.ui.perf.find(x => x.visual === v.id);
      const name = v.format?.title || vdef(v.type).name;
      const ms = p?.ms ?? null;
      const uses = Object.values(v.wells).flat().map(f => f.measure ? s.project.model.measures.find(x => x.name === f.measure)?.table : f.table);
      const isDq = uses.some(t => ['DirectQuery', 'Dual'].includes(s.project.model.tables.find(x => x.name === t)?.storageMode ?? ''));
      return <div key={v.id} style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
        <div className="tree-item" style={{ paddingLeft: 2 }} onClick={() => setOpen(open === v.id ? null : v.id)}>
          <I n={open === v.id ? 'chevronDown' : 'chevronRight'} s={10} /><span className="nm">{name}</span><span className="tiny">{ms === null ? '—' : `${Math.round(ms + (isDq ? 40 + ms * 3 : 0) + 12)} ms`}</span>
        </div>
        {open === v.id && <div style={{ paddingLeft: 18 }}>
          <table className="grid-table" style={{ width: '100%' }}><tbody>
            <tr><td>DAX query</td><td className="num">{ms === null ? '—' : ms.toFixed(1)}</td></tr>
            {isDq && <tr><td>Direct query</td><td className="num">{ms === null ? '—' : (40 + ms * 3).toFixed(1)}</td></tr>}
            <tr><td>Visual display</td><td className="num">{ms === null ? '—' : '9.0'}</td></tr>
            <tr><td>Other</td><td className="num">{ms === null ? '—' : '3.0'}</td></tr>
          </tbody></table>
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(daxQueryFor(v)).catch(() => {}); s.toast('Query copied'); }}>Copy query</button>
            <button className="btn sm" onClick={() => { const id = 'q' + Math.random().toString(36).slice(2, 7); s.setUI({ daxQueries: [...s.ui.daxQueries, { id, name: name, text: daxQueryFor(v) }], daxActive: id, view: 'dax' }); }}>Run in DAX query view</button>
          </div>
        </div>}
      </div>;
    })}
  </PaneShell>;
}

export { store };
