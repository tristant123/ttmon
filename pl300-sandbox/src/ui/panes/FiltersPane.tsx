// Filters pane: visual / page / all-pages filters with Basic, Advanced, Top N and Relative date filtering.
import React, { useState } from 'react';
import { useStore, store, uid } from '../../store';
import { I } from '../icons';
import { FilterSpec, FieldRef, Visual } from '../../model/types';
import { fieldLabel, allValues, fmt, formatFor, colMeta, isValueField } from '../../report/query';
import { keyOf, isNumericType } from '../../core/values';

type Scope = { kind: 'visual'; id: string } | { kind: 'page'; id: string } | { kind: 'report' };

function getList(scope: Scope): FilterSpec[] {
  const p = store.project;
  if (scope.kind === 'report') return p.report.reportFilters;
  if (scope.kind === 'page') return p.report.pages.find(x => x.id === scope.id)!.filters;
  return store.findVisual(scope.id)!.filters;
}
function setList(scope: Scope, f: (l: FilterSpec[]) => FilterSpec[]) {
  store.change(p => {
    if (scope.kind === 'report') p.report.reportFilters = f(p.report.reportFilters);
    else if (scope.kind === 'page') { const pg = p.report.pages.find(x => x.id === scope.id)!; pg.filters = f(pg.filters); }
    else for (const pg of p.report.pages) { const v = pg.visuals.find(x => x.id === scope.id); if (v) v.filters = f(v.filters); }
  });
}

const OPS_TEXT = [['contains', 'contains'], ['notContains', 'does not contain'], ['startsWith', 'starts with'], ['notStartsWith', 'does not start with'], ['is', 'is'], ['isNot', 'is not'], ['isBlank', 'is blank'], ['isNotBlank', 'is not blank'], ['isEmpty', 'is empty'], ['isNotEmpty', 'is not empty']];
const OPS_NUM = [['lt', 'is less than'], ['lte', 'is less than or equal to'], ['gt', 'is greater than'], ['gte', 'is greater than or equal to'], ['is', 'is'], ['isNot', 'is not'], ['isBlank', 'is blank'], ['isNotBlank', 'is not blank']];

function FilterCard({ spec, scope, auto }: { spec: FilterSpec; scope: Scope; auto?: boolean }) {
  const s = store; const m = s.project.model;
  const [open, setOpen] = useState(spec.type !== 'none' || !auto);
  const [search, setSearch] = useState('');
  const [byOver, setByOver] = useState(false);
  const f = spec.field;
  const c = colMeta(m, f);
  const isMeasure = !!f.measure || (isValueField(m, f) && scope.kind === 'visual');
  const numeric = isMeasure || isNumericType(c?.dataType ?? 'text');
  const isDate = !f.datePart && (c?.dataType === 'date' || c?.dataType === 'datetime');
  const update = (patch: Partial<FilterSpec> | ((x: FilterSpec) => FilterSpec)) => {
    if (auto && scope.kind === 'visual') {
      // first edit of an implicit visual filter makes it explicit
      setList(scope, l => { const ex = l.find(x => x.id === spec.id); const base = ex ?? spec; const nx = typeof patch === 'function' ? patch(base) : ({ ...base, ...patch } as FilterSpec); return ex ? l.map(x => (x.id === spec.id ? nx : x)) : [...l, nx]; });
    } else setList(scope, l => l.map(x => (x.id === spec.id ? (typeof patch === 'function' ? patch(x) : ({ ...x, ...patch } as FilterSpec)) : x)));
  };
  const summary = (() => {
    switch (spec.type) {
      case 'basic': return spec.values.length ? `${spec.invert ? 'is not' : 'is'} ${spec.values.slice(0, 3).map(x => fmt(x, formatFor(m, f), f) || '(Blank)').join(', ')}${spec.values.length > 3 ? '…' : ''}` : 'is (All)';
      case 'advanced': return spec.conds.filter(x => x.op).length ? spec.conds.filter(x => x.op).map(x => `${x.op} ${x.value ?? ''}`).join(` ${spec.logic} `) : 'is (All)';
      case 'topn': return `Top ${spec.n}`;
      case 'relative': return `is in the ${spec.mode} ${spec.n} ${spec.unit}`;
      default: return 'is (All)';
    }
  })();
  const vals = open && !isMeasure && (spec.type === 'basic' || spec.type === 'none') ? allValues(s.dax, f) : [];
  const selKeys = new Set(spec.type === 'basic' ? spec.values.map(keyOf) : []);
  return <div style={{ border: '1px solid #e1dfdd', borderRadius: 4, marginBottom: 6, background: spec.type !== 'none' && summary !== 'is (All)' ? '#f3f9fd' : '#fff' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 6px 4px 8px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fieldLabel(f)}</div>
        <div className="tiny" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
      </div>
      {summary !== 'is (All)' && <button className="iconbtn" title="Clear filter" onClick={e => { e.stopPropagation(); update(x => ({ ...x, type: isMeasure ? 'advanced' : 'basic', values: [], conds: [{ op: '', value: '' }, { op: '', value: '' }], logic: 'and' } as any)); }}><I n="eyeOff" s={13} /></button>}
      <button className="iconbtn" title={spec.locked ? 'Unlock filter' : 'Lock filter'} onClick={e => { e.stopPropagation(); update({ locked: !spec.locked } as any); }}><I n={spec.locked ? 'lock' : 'unlock'} s={13} /></button>
      <button className="iconbtn" title={spec.hidden ? 'Show filter in reading view' : 'Hide filter in reading view'} onClick={e => { e.stopPropagation(); update({ hidden: !spec.hidden } as any); }}><I n={spec.hidden ? 'eyeOff' : 'eye'} s={13} /></button>
      {!auto && <button className="iconbtn" title="Remove filter" onClick={e => { e.stopPropagation(); setList(scope, l => l.filter(x => x.id !== spec.id)); }}><I n="close" s={12} /></button>}
      <I n={open ? 'chevronUp' : 'chevronDown'} s={12} />
    </div>
    {open && <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="frow"><label>Filter type</label>
        <select className="tx" value={spec.type === 'none' ? (isMeasure ? 'advanced' : 'basic') : spec.type} disabled={spec.locked} onChange={e => {
          const t = e.target.value;
          if (t === 'basic') update({ type: 'basic', values: [] } as any);
          if (t === 'advanced') update({ type: 'advanced', logic: 'and', conds: [{ op: '', value: '' }, { op: '', value: '' }] } as any);
          if (t === 'topn') update({ type: 'topn', dir: 'top', n: 5, by: undefined } as any);
          if (t === 'relative') update({ type: 'relative', mode: 'last', n: 1, unit: 'months' } as any);
        }}>
          {!isMeasure && <option value="basic">Basic filtering</option>}
          <option value="advanced">Advanced filtering</option>
          {!isMeasure && scope.kind !== 'report' && <option value="topn">Top N</option>}
          {isDate && <option value="relative">Relative date</option>}
        </select>
      </div>
      {(spec.type === 'basic' || spec.type === 'none') && !isMeasure && <>
        {vals.length > 8 && <div className="pane-search" style={{ margin: 0 }}><I n="search" s={13} /><input placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></div>}
        <div style={{ maxHeight: 200, overflow: 'auto' }}>
          {!spec.type || spec.type === 'none' || !(spec as any).requireSingle ? <div className="slicer-item" onClick={() => !spec.locked && update({ type: 'basic', values: [], invert: false } as any)}><span className={`chk ${!selKeys.size ? 'on' : ''}`} />Select all</div> : null}
          {vals.filter(x => !search || String(fmt(x, formatFor(m, f), f)).toLowerCase().includes(search.toLowerCase())).slice(0, 500).map(x => {
            const on = selKeys.has(keyOf(x));
            return <div key={keyOf(x)} className="slicer-item" onClick={() => { if (spec.locked) return; const cur = spec.type === 'basic' ? spec.values : []; const single = (spec as any).requireSingle; update({ type: 'basic', values: single ? [x] : on ? cur.filter(y => keyOf(y) !== keyOf(x)) : [...cur, x] } as any); }}>
              <span className={`chk ${on ? 'on' : ''}`} />{fmt(x, formatFor(m, f), f) || '(Blank)'}
            </div>;
          })}
        </div>
        <label className="row tiny" style={{ gap: 6 }}><input type="checkbox" checked={!!(spec as any).requireSingle} onChange={e => update({ type: 'basic', values: spec.type === 'basic' ? spec.values.slice(0, 1) : [], requireSingle: e.target.checked } as any)} />Require single selection</label>
        {spec.type === 'basic' && <label className="row tiny" style={{ gap: 6 }}><input type="checkbox" checked={!!spec.invert} onChange={e => update({ invert: e.target.checked } as any)} />Invert (is not)</label>}
      </>}
      {spec.type === 'advanced' && <>
        <div className="tiny">Show items when the value</div>
        {spec.conds.map((cd, i) => <React.Fragment key={i}>
          {i > 0 && <div className="radio-row"><label><input type="radio" checked={spec.logic === 'and'} onChange={() => update({ logic: 'and' } as any)} />And</label><label><input type="radio" checked={spec.logic === 'or'} onChange={() => update({ logic: 'or' } as any)} />Or</label></div>}
          <select className="tx" value={cd.op} disabled={spec.locked} onChange={e => update(x => ({ ...x, conds: (x as any).conds.map((y: any, j: number) => (j === i ? { ...y, op: e.target.value } : y)) } as any))}>
            <option value="">{i === 0 ? 'Choose…' : '(none)'}</option>
            {(numeric || isDate ? OPS_NUM : OPS_TEXT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {cd.op && !/Blank|Empty/.test(cd.op) && <input className="tx" type={isDate ? 'date' : numeric ? 'number' : 'text'} disabled={spec.locked} value={cd.value instanceof Date ? cd.value.toISOString().slice(0, 10) : cd.value ?? ''}
            onChange={e => { const raw = e.target.value; const val = isDate ? (raw ? new Date(+raw.slice(0, 4), +raw.slice(5, 7) - 1, +raw.slice(8, 10)) : '') : raw; update(x => ({ ...x, conds: (x as any).conds.map((y: any, j: number) => (j === i ? { ...y, value: val } : y)) } as any)); }} />}
        </React.Fragment>)}
      </>}
      {spec.type === 'topn' && <>
        <div className="frow"><label>Show items</label><div className="row" style={{ flexWrap: 'nowrap' }}>
          <select className="tx" value={spec.dir} onChange={e => update({ dir: e.target.value } as any)}><option value="top">Top</option><option value="bottom">Bottom</option></select>
          <input className="tx" type="number" min={1} value={spec.n} onChange={e => update({ n: +e.target.value } as any)} style={{ width: 70 }} />
        </div></div>
        <div className="frow"><label>By value</label>
          <div className={`well-drop ${byOver ? 'over' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field')) { e.preventDefault(); setByOver(true); } }} onDragLeave={() => setByOver(false)}
            onDrop={e => { setByOver(false); const raw = e.dataTransfer.getData('application/x-field'); if (!raw) return; const by = JSON.parse(raw) as FieldRef; update({ by: by.measure ? by : { ...by, agg: 'Sum' } } as any); }}>
            {spec.by ? <div className="pill"><span className="nm">{fieldLabel(spec.by)}</span></div> : <div className="ph">Add data fields here</div>}
          </div></div>
      </>}
      {spec.type === 'relative' && <>
        <div className="tiny">Show items when the value</div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <select className="tx" value={spec.mode} onChange={e => update({ mode: e.target.value } as any)}><option value="last">is in the last</option><option value="this">is in this</option><option value="next">is in the next</option></select>
          {spec.mode !== 'this' && <input className="tx" type="number" min={1} style={{ width: 60 }} value={spec.n} onChange={e => update({ n: +e.target.value } as any)} />}
          <select className="tx" value={spec.unit} onChange={e => update({ unit: e.target.value } as any)}><option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option><option value="years">years</option></select>
        </div>
      </>}
    </div>}
  </div>;
}

function Section({ title, scope, specs, auto }: { title: string; scope: Scope; specs: FilterSpec[]; auto?: FilterSpec[] }) {
  const [over, setOver] = useState(false);
  return <div style={{ marginBottom: 14 }}>
    <div className="section-h">{title}</div>
    {auto?.map(a => <FilterCard key={a.id} spec={a} scope={scope} auto />)}
    {specs.map(sp => <FilterCard key={sp.id} spec={sp} scope={scope} />)}
    <div className={`well-drop ${over ? 'over' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={e => {
        setOver(false); const raw = e.dataTransfer.getData('application/x-field'); if (!raw) return; e.preventDefault();
        const f = JSON.parse(raw) as FieldRef;
        if (f.hierarchy) { store.toast('Drop a column, not a hierarchy, on the Filters pane.', 'error'); return; }
        if (f.measure && scope.kind !== 'visual') { store.toast('Measures can only be used in visual-level filters.', 'error'); return; }
        setList(scope, l => [...l, f.measure ? { id: uid('f'), field: f, type: 'advanced', logic: 'and', conds: [{ op: '', value: '' }, { op: '', value: '' }] } : { id: uid('f'), field: { ...f, agg: undefined }, type: 'basic', values: [] }]);
      }}>
      <div className="ph">Add data fields here</div>
    </div>
  </div>;
}

export function FiltersPane({ width = 230 }: { width?: number }) {
  const s = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState('');
  if (collapsed) return <div className="pane collapsed" style={{ width: 32 }}><div className="pane-vert" onClick={() => setCollapsed(false)}><I n="chevronLeft" s={12} />Filters</div></div>;
  const v = s.selectedVisual();
  const page = s.page();
  const autoFor = (vv: Visual): FilterSpec[] => {
    const explicit = new Set(vv.filters.map(f => `${f.field.table}|${f.field.column}|${f.field.measure}|${f.field.datePart}|${f.field.agg}`));
    const out: FilterSpec[] = [];
    for (const [k, fs] of Object.entries(vv.wells)) {
      if (k === 'tooltips') continue;
      for (const f of fs) {
        if (f.hierarchy) continue;
        const key = `${f.table}|${f.column}|${f.measure}|${f.datePart}|${f.agg}`;
        if (explicit.has(key) || out.some(o => `${o.field.table}|${o.field.column}|${o.field.measure}|${o.field.datePart}|${o.field.agg}` === key)) continue;
        out.push({ id: 'auto-' + key, field: f, type: 'none' });
      }
    }
    return out;
  };
  const match = (sp: FilterSpec) => !q || fieldLabel(sp.field).toLowerCase().includes(q.toLowerCase());
  return <div className="pane" style={{ width }}>
    <div className="pane-h"><span>Filters</span><button className="iconbtn" title="Collapse" onClick={() => setCollapsed(true)}><I n="chevronRight" s={12} /></button></div>
    <div className="pane-body">
      <div className="pane-search"><I n="search" s={13} /><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search filters" /></div>
      {v && !['textbox', 'button', 'shape', 'image'].includes(v.type) && <Section title="Filters on this visual" scope={{ kind: 'visual', id: v.id }} specs={v.filters.filter(match)} auto={autoFor(v).filter(match)} />}
      <Section title="Filters on this page" scope={{ kind: 'page', id: page.id }} specs={page.filters.filter(match)} />
      <Section title="Filters on all pages" scope={{ kind: 'report' }} specs={s.project.report.reportFilters.filter(match)} />
    </div>
  </div>;
}

export { getList };
