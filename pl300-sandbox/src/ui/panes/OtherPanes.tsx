// Bookmarks, Selection and Performance analyzer panes.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { I } from '../icons';
import { menuAt } from '../common';
import { captureBookmark, applyBookmark } from '../report/bookmarks';
import { vdef } from '../../report/visuals';
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

export function PerfPane() {
  const s = useStore();
  const page = s.page();
  return <PaneShell title="Performance analyzer" onClose={() => s.setUI({ panes: { ...s.ui.panes, perf: false } })} width={260}>
    <div className="row" style={{ marginBottom: 8 }}>
      <button className="btn sm" onClick={() => { clearQueryCache(); s.ui.perf = []; s.emit(); }}>Refresh visuals</button>
      <button className="btn sm" onClick={() => { s.ui.perf = []; s.emit(); }}>Clear</button>
    </div>
    <div className="tiny" style={{ marginBottom: 6 }}>Duration of the DAX query behind each visual on this page, in milliseconds.</div>
    <table className="grid-table vtable"><thead><tr><th>Name</th><th className="num">DAX query (ms)</th></tr></thead><tbody>
      {page.visuals.map(v => { const p = s.ui.perf.find(x => x.visual === v.id); return <tr key={v.id}><td>{v.format?.title || vdef(v.type).name}</td><td className="num">{p ? p.ms.toFixed(1) : '—'}</td></tr>; })}
    </tbody></table>
  </PaneShell>;
}

export { store };
