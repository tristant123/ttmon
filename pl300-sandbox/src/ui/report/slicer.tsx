// Slicer visual: vertical list, dropdown, tile, between (range) and hierarchy styles.
import React, { useMemo, useState } from 'react';
import { store } from '../../store';
import { Visual, Page, FieldRef } from '../../model/types';
import { fmt, formatFor, colMeta, levelsOf, allValues } from '../../report/query';
import { useQuery } from './vhelpers';
import { VisError, NoData } from './charts';
import { keyOf, compareValues, isNumericType } from '../../core/values';
import { datePartValue } from '../../dax/engine';
import { I } from '../icons';

function setSlicer(v: Visual, patch: Partial<NonNullable<Visual['slicer']>>) {
  store.updateVisual(v.id, x => { x.slicer = { values: [], ...(x.slicer ?? {}), ...patch }; }, true);
  store.setUI({ cross: null });
}

export function Slicer({ v, page }: { v: Visual; page: Page }) {
  const s = store; const m = s.project.model;
  const fields = v.wells.field ?? [];
  const f = fields[0];
  const c = f ? colMeta(m, f) : undefined;
  const isRangeType = !!c && (isNumericType(c.dataType) || c.dataType === 'date' || c.dataType === 'datetime') && !f?.datePart;
  const style = v.format?.slicerStyle ?? (isRangeType && c && (c.dataType === 'date' || c.dataType === 'datetime') ? 'between' : 'list');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const levels = fields.length === 1 && f && !isRangeType ? levelsOf(m, f, false) : fields;
  const q = useQuery(v, page, vc => {
    if (!f) return null;
    // values available given the other slicers/filters
    const eng = s.dax;
    const sets = levels.map(l => {
      const tab = eng.table(l.table); const ci = eng.colIdx(l.table, l.column!);
      const seen = new Map<string, any>();
      for (const i of eng.visible(tab.name, vc.ctx)) { const raw = tab.rows[i][ci]; const val = l.datePart ? datePartValue(raw, l.datePart) : raw; const k = keyOf(val); if (!seen.has(k)) seen.set(k, val); }
      return [...seen.values()].sort(compareValues);
    });
    const all = allValues(eng, levels[0]);
    return { sets, all };
  });
  const sel = v.slicer?.values ?? [];
  const selKeys = useMemo(() => new Set(sel.map(x => (Array.isArray(x) ? x[0] + ':' + keyOf(x[1]) : '0:' + keyOf(x)))), [sel]);
  if (!f) return <NoData msg="Add a data field to Field." />;
  if (q.error) return <VisError msg={q.error} />;
  if (!q.data) return null;
  const single = !!v.format?.singleSelect;
  const toggle = (val: any, ev: React.MouseEvent, li = 0) => {
    const item = li ? [li, val] : val;
    const k = li + ':' + keyOf(val);
    let next: any[];
    if (single) next = selKeys.has(k) ? [] : [item];
    else if (v.format?.ctrlMulti && !ev.ctrlKey) next = selKeys.has(k) && sel.length === 1 ? [] : [item];
    else next = selKeys.has(k) ? sel.filter(x => (Array.isArray(x) ? x[0] + ':' + keyOf(x[1]) : '0:' + keyOf(x)) !== k) : [...sel, item];
    setSlicer(v, { values: next });
  };
  const header = v.format?.header !== false ? <div style={{ fontWeight: 600, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fields.map(x => x.alias ?? x.column).join(', ')}</span>
    {(sel.length > 0 || v.slicer?.range) && <button className="iconbtn" title="Clear selections" onClick={() => setSlicer(v, { values: [], range: undefined })}><I n="eyeOff" s={14} /></button>}
  </div> : null;
  const label = (x: any, l: FieldRef) => fmt(x, formatFor(m, l), l) || '(Blank)';

  if (style === 'between' && isRangeType) {
    const vals = q.data.all.filter(x => x !== null);
    const lo = vals[0], hi = vals[vals.length - 1];
    const [a, b] = v.slicer?.range ?? [lo, hi];
    const isDate = lo instanceof Date;
    const toIn = (d: any) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : d ?? '');
    const fromIn = (s0: string) => (isDate ? (s0 ? new Date(+s0.slice(0, 4), +s0.slice(5, 7) - 1, +s0.slice(8, 10)) : null) : s0 === '' ? null : Number(s0));
    const pos = (x: any) => (hi === lo ? 0 : ((Number(x instanceof Date ? x.getTime() : x) - Number(lo instanceof Date ? lo.getTime() : lo)) / (Number(hi instanceof Date ? hi.getTime() : hi) - Number(lo instanceof Date ? lo.getTime() : lo))) * 100);
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{header}
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="tx" type={isDate ? 'date' : 'number'} value={toIn(a)} onChange={e => setSlicer(v, { range: [fromIn(e.target.value), b] })} aria-label="Start" />
          <input className="tx" type={isDate ? 'date' : 'number'} value={toIn(b)} onChange={e => setSlicer(v, { range: [a, fromIn(e.target.value)] })} aria-label="End" />
        </div>
        <div style={{ position: 'relative', height: 4, background: '#c8c6c4', margin: '4px 6px' }}>
          <div style={{ position: 'absolute', left: pos(a) + '%', right: 100 - pos(b) + '%', top: 0, bottom: 0, background: '#252423' }} />
          <div style={{ position: 'absolute', left: `calc(${pos(a)}% - 6px)`, top: -5, width: 14, height: 14, borderRadius: 7, background: '#fff', border: '2px solid #252423' }} />
          <div style={{ position: 'absolute', left: `calc(${pos(b)}% - 6px)`, top: -5, width: 14, height: 14, borderRadius: 7, background: '#fff', border: '2px solid #252423' }} />
        </div>
      </div></div>;
  }
  const items = q.data.sets[0].filter(x => !search || String(label(x, levels[0])).toLowerCase().includes(search.toLowerCase()));
  const listBody = (
    <div className="slicer-list">
      {v.format?.search && <div className="pane-search" style={{ margin: '0 0 4px' }}><I n="search" s={13} /><input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></div>}
      {v.format?.selectAll && !single && <div className="slicer-item" onClick={() => setSlicer(v, { values: sel.length ? [] : q.data!.sets[0] })}><span className={`chk ${sel.length === q.data.sets[0].length ? 'on' : ''}`} />Select all</div>}
      {items.map(x => {
        const on = selKeys.has('0:' + keyOf(x));
        const children = levels.length > 1 && on ? q.data!.sets[1] : null;
        return <React.Fragment key={keyOf(x)}>
          <div className="slicer-item" onClick={e => toggle(x, e)}>
            {single ? <span style={{ width: 13, height: 13, borderRadius: 7, border: '1px solid #605e5c', display: 'inline-grid', placeItems: 'center' }}>{on && <span style={{ width: 7, height: 7, borderRadius: 4, background: '#252423' }} />}</span> : <span className={`chk ${on ? 'on' : ''}`} />}
            {label(x, levels[0])}
          </div>
          {children && children.map(y => <div key={keyOf(y)} className="slicer-item" style={{ paddingLeft: 18 }} onClick={e => toggle(y, e, 1)}><span className={`chk ${selKeys.has('1:' + keyOf(y)) ? 'on' : ''}`} />{label(y, levels[1])}</div>)}
        </React.Fragment>;
      })}
    </div>);
  if (style === 'dropdown') {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{header}
      <div style={{ padding: '0 8px', position: 'relative' }}>
        <button className="tx" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }} onClick={() => setOpen(!open)}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel.length === 0 ? 'All' : sel.length === 1 ? label(Array.isArray(sel[0]) ? sel[0][1] : sel[0], levels[0]) : 'Multiple selections'}</span><I n="chevronDown" s={12} />
        </button>
        {open && <div style={{ position: 'absolute', left: 8, right: 8, top: 28, background: '#fff', border: '1px solid #c8c6c4', zIndex: 40, maxHeight: Math.max(120, v.h * 2), overflow: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,.15)' }}>{listBody}</div>}
      </div></div>;
  }
  if (style === 'tile') {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{header}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, overflow: 'auto' }}>
        {items.map(x => { const on = selKeys.has('0:' + keyOf(x)); return <button key={keyOf(x)} onClick={e => toggle(x, e)} style={{ padding: '6px 12px', border: '1px solid #c8c6c4', background: on ? '#252423' : '#fff', color: on ? '#fff' : '#252423', borderRadius: 2 }}>{label(x, levels[0])}</button>; })}
      </div></div>;
  }
  return <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>{header}<div style={{ flex: 1, minHeight: 0 }}>{listBody}</div></div>;
}
