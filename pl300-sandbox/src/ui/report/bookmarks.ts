import { store, uid } from '../../store';
import { Bookmark } from '../../model/types';

export function captureBookmark(name: string): Bookmark {
  const s = store; const page = s.page();
  const visuals: Bookmark['state']['visuals'] = {};
  for (const v of page.visuals) visuals[v.id] = { hidden: v.hidden, slicer: v.slicer ? JSON.parse(JSON.stringify(v.slicer)) : undefined, filters: JSON.parse(JSON.stringify(v.filters)), drill: v.drill ? { ...v.drill } : undefined };
  return { id: uid('bm'), name, pageId: page.id, state: { pageFilters: JSON.parse(JSON.stringify(page.filters)), visuals }, data: true, display: true, currentPage: true };
}

export function applyBookmark(b: Bookmark) {
  const s = store;
  s.change(p => {
    const page = p.report.pages.find(x => x.id === b.pageId);
    if (!page) return;
    if (b.data) page.filters = JSON.parse(JSON.stringify(b.state.pageFilters));
    for (const v of page.visuals) {
      const st = b.state.visuals[v.id];
      if (!st) continue;
      if (b.display) v.hidden = st.hidden;
      if (b.data) { v.slicer = st.slicer ? JSON.parse(JSON.stringify(st.slicer)) : undefined; v.filters = JSON.parse(JSON.stringify(st.filters)); v.drill = st.drill ? { ...st.drill } : undefined; }
    }
  }, { noUndo: true });
  if (b.currentPage) s.setUI({ pageId: b.pageId, cross: null });
  s.toast(`Bookmark "${b.name}" applied`);
}
