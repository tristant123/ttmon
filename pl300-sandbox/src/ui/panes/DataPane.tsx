// The Data pane (formerly "Fields"): tables, columns, measures, hierarchies, display folders.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { I } from '../icons';
import { menuAt, MenuItem, typeIcon } from '../common';
import { FieldRef, ModelTable } from '../../model/types';
import { checkField, startNewMeasure, startNewColumn, editMeasure, editColumn, deleteField, renameField, openPowerQuery, refreshAll, removeFieldEverywhere, editTable, startCalcItem, editCalcItem, updateCalcGroup } from '../actions';
import { isNumericType } from '../../core/values';
import { clearQueryCache } from '../report/vhelpers';

function usedInSelected(f: FieldRef): boolean {
  const v = store.selectedVisual(); if (!v) return false;
  return Object.values(v.wells).some(fs => fs.some(x => x.table === f.table && x.column === f.column && x.measure === f.measure && (x.hierarchy ?? '') === (f.hierarchy ?? '') && (!f.datePart || x.datePart === f.datePart)));
}

const dragStart = (f: FieldRef) => (e: React.DragEvent) => { e.dataTransfer.setData('application/x-field', JSON.stringify(f)); e.dataTransfer.effectAllowed = 'copy'; };

export function DataPane({ width = 230, mode = 'report' }: { width?: number; mode?: 'report' | 'table' | 'model' | 'dax' }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(mode !== 'report');
  const [rename, setRename] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const m = s.project.model;
  if (collapsed) return <div className="pane collapsed" style={{ width: 32 }}><div className="pane-vert" onClick={() => setCollapsed(false)}><I n="chevronLeft" s={12} />Data</div></div>;
  const ql = q.toLowerCase();
  const match = (n: string) => !ql || n.toLowerCase().includes(ql);
  const tables = m.tables.filter(t => showHidden || !t.hidden);

  const fieldMenu = (e: React.MouseEvent, f: FieldRef, t: ModelTable) => {
    const items: MenuItem[] = [];
    const col = f.column ? t.columns.find(c => c.name === f.column) : undefined;
    const meas = f.measure ? m.measures.find(x => x.name === f.measure) : undefined;
    if (mode === 'report' && store.selectedVisual()) items.push({ label: usedInSelected(f) ? 'Remove from visual' : 'Add to visual', onClick: () => (usedInSelected(f) ? removeFieldEverywhere(f) : checkField(f)) });
    items.push({ label: 'New measure', icon: 'measure', onClick: () => startNewMeasure(t.name) });
    items.push({ label: 'New column', icon: 'newcolumn', onClick: () => startNewColumn(t.name) });
    items.push({ label: 'New quick measure', icon: 'quickmeasure', onClick: () => s.openDialog({ type: 'quickMeasure', table: t.name, field: f }) });
    if (col) {
      items.push({ sep: true });
      items.push({ label: 'Create hierarchy', icon: 'hierarchy', onClick: () => s.change(p => { const n = `${col.name} Hierarchy`; p.model.hierarchies.push({ name: n, table: t.name, levels: [col.name] }); }) });
      const hs = m.hierarchies.filter(h => h.table === t.name && !h.levels.includes(col.name));
      if (hs.length) items.push({ label: 'Add to hierarchy', items: hs.map(h => ({ label: h.name, onClick: () => s.change(p => { p.model.hierarchies.find(x => x.name === h.name && x.table === t.name)!.levels.push(col.name); }) })) });
      items.push({ label: 'New group', icon: 'group', onClick: () => s.openDialog({ type: 'groups', table: t.name, column: col.name }) });
      if (col.expression) items.push({ label: 'Edit formula', icon: 'edit', onClick: () => editColumn(t.name, col.name) });
    }
    if (meas) items.push({ sep: true }, { label: 'Edit formula', icon: 'edit', onClick: () => editMeasure(meas) });
    items.push({ sep: true });
    items.push({ label: 'Rename', icon: 'edit', onClick: () => setRename(JSON.stringify(f)) });
    if (col?.expression || meas) items.push({ label: 'Delete from model', icon: 'trash', onClick: () => deleteField(f) });
    const hidden = col ? col.hidden : meas?.hidden;
    items.push({ label: hidden ? 'Unhide' : 'Hide in report view', icon: hidden ? 'eye' : 'eyeOff', onClick: () => s.change(p => { const tt = p.model.tables.find(x => x.name === t.name)!; if (col) tt.columns.find(c => c.name === col.name)!.hidden = !hidden; if (meas) p.model.measures.find(x => x.name === meas.name)!.hidden = !hidden; }) });
    items.push({ label: 'View hidden', checked: showHidden, onClick: () => setShowHidden(!showHidden) });
    items.push({ label: 'Collapse all', onClick: () => setOpen({}) });
    menuAt(e, items);
  };
  const tableMenu = (e: React.MouseEvent, t: ModelTable) => {
    menuAt(e, [
      ...(t.calculationGroup ? [{ label: 'New calculation item', icon: 'calcgroup', onClick: () => startCalcItem(t.name) }, { sep: true } as MenuItem] : []),
      { label: 'New measure', icon: 'measure', onClick: () => startNewMeasure(t.name) },
      { label: 'New column', icon: 'newcolumn', onClick: () => startNewColumn(t.name) },
      { label: 'New quick measure', icon: 'quickmeasure', onClick: () => s.openDialog({ type: 'quickMeasure', table: t.name }) },
      { sep: true },
      { label: 'Refresh data', icon: 'refresh', onClick: () => { s.refresh({ only: [t.name], autodetect: false }); clearQueryCache(); s.toast(`Refreshed ${t.name}`); } },
      { label: 'Edit query', icon: 'transform', disabled: !!t.expression, onClick: () => openPowerQuery(t.name) },
      ...(t.expression ? [{ label: 'Edit DAX formula', icon: 'edit', onClick: () => editTable(t.name) }] : []),
      { label: 'Mark as date table', icon: 'calendar', onClick: () => s.openDialog({ type: 'markDate', table: t.name }) },
      { label: 'Manage relationships', icon: 'relationship', onClick: () => s.openDialog({ type: 'relationships' }) },
      { sep: true },
      { label: 'Rename', icon: 'edit', onClick: () => setRename(JSON.stringify({ table: t.name })) },
      { label: 'Delete from model', icon: 'trash', onClick: () => deleteField({ table: t.name }) },
      { label: t.hidden ? 'Unhide' : 'Hide in report view', icon: t.hidden ? 'eye' : 'eyeOff', onClick: () => s.change(p => { p.model.tables.find(x => x.name === t.name)!.hidden = !t.hidden; }) },
      { label: 'View hidden', checked: showHidden, onClick: () => setShowHidden(!showHidden) },
      { label: 'Expand all', onClick: () => setOpen(Object.fromEntries(m.tables.map(x => [x.name, true]))) },
      { label: 'Collapse all', onClick: () => setOpen({}) },
    ]);
  };

  const fieldRow = (f: FieldRef, label: string, icon: string, t: ModelTable, opts: { hidden?: boolean; indent?: number; checkable?: boolean } = {}) => {
    const key = JSON.stringify(f);
    const selected = s.ui.field && s.ui.field.table === f.table && s.ui.field.column === f.column && s.ui.field.measure === f.measure && !f.datePart && !f.hierarchy;
    if (rename === key) return <div key={key} className="tree-item" style={{ paddingLeft: 20 + (opts.indent ?? 0) }}><input className="tx" autoFocus defaultValue={label} onBlur={e => { setRename(null); if (e.target.value !== label) renameField(f, e.target.value.trim()); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRename(null); }} /></div>;
    return <div key={key} className={`tree-item ${selected ? 'selected' : ''} ${opts.hidden ? 'hiddenf' : ''}`} style={{ paddingLeft: 20 + (opts.indent ?? 0) }} draggable onDragStart={dragStart(f)}
      onClick={() => {
        s.setUI({ field: { table: f.table, column: f.column, measure: f.measure } });
        if (f.measure) { const mm = m.measures.find(x => x.name === f.measure); if (mm && mode !== 'model') editMeasure(mm); }
        else if (f.column && !f.datePart) { const c = t.columns.find(x => x.name === f.column); if (c?.expression && mode === 'table') editColumn(t.name, c.name); }
      }}
      onDoubleClick={() => setRename(key)}
      onContextMenu={e => fieldMenu(e, f, t)} title={f.measure ? m.measures.find(x => x.name === f.measure)?.description ?? '' : t.columns.find(c => c.name === f.column)?.description ?? ''}>
      {mode === 'report' && opts.checkable !== false && <input type="checkbox" checked={usedInSelected(f)} onChange={() => (usedInSelected(f) ? removeFieldEverywhere(f) : checkField(f))} onClick={e => e.stopPropagation()} aria-label={`Use ${label}`} />}
      <I n={icon} s={15} />
      <span className="nm">{label}</span>
      {opts.hidden && <I n="eyeOff" s={12} />}
    </div>;
  };

  return <div className="pane" style={{ width }}>
    <div className="pane-h"><span>Data</span><span style={{ display: 'flex', gap: 2 }}><button className="iconbtn" title="More options" onClick={e => menuAt(e, [{ label: 'View hidden', checked: showHidden, onClick: () => setShowHidden(!showHidden) }, { label: 'Expand all', onClick: () => setOpen(Object.fromEntries(m.tables.map(x => [x.name, true]))) }, { label: 'Collapse all', onClick: () => setOpen({}) }, { label: 'Refresh data', icon: 'refresh', onClick: refreshAll }])}><I n="more" s={14} /></button><button className="iconbtn" title="Collapse" onClick={() => setCollapsed(true)}><I n="chevronRight" s={12} /></button></span></div>
    <div className="pane-body">
      <div className="pane-search"><I n="search" s={13} /><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search fields" /></div>
      {!tables.length && <div className="subtle" style={{ padding: '8px 2px' }}>No data loaded yet. Select <b>Get data</b> on the Home ribbon, or open a <b>Tutorial</b>.</div>}
      {tables.map(t => {
        const isOpen = open[t.name] ?? (!!ql || tables.length <= 3);
        const measures = m.measures.filter(x => x.table === t.name && (showHidden || !x.hidden) && match(x.name));
        const cols = t.columns.filter(c => (showHidden || !c.hidden) && match(c.name));
        const hiers = m.hierarchies.filter(h => h.table === t.name && match(h.name));
        if (ql && !measures.length && !cols.length && !hiers.length && !match(t.name)) return null;
        const folders = new Map<string, React.ReactNode[]>();
        const loose: React.ReactNode[] = [];
        const push = (folder: string | undefined, node: React.ReactNode) => { if (folder) { if (!folders.has(folder)) folders.set(folder, []); folders.get(folder)!.push(node); } else loose.push(node); };
        for (const mm of measures) push(mm.displayFolder, fieldRow({ table: t.name, measure: mm.name }, mm.name, 'fieldCalc', t, { hidden: mm.hidden }));
        for (const c of cols) {
          const f: FieldRef = { table: t.name, column: c.name };
          const isDate = (c.dataType === 'date' || c.dataType === 'datetime') && s.project.settings.autoDateTime && t.dateColumn !== c.name && !t.expression;
          const icon = c.expression ? 'fieldCalcCol' : c.dataCategory && ['Country', 'City', 'State or Province', 'Continent', 'County', 'Postal code', 'Place', 'Address', 'Latitude', 'Longitude'].includes(c.dataCategory) ? 'fieldGeo' : isNumericType(c.dataType) && c.summarizeBy !== 'None' && !m.discourageImplicitMeasures ? 'fieldNum' : typeIcon(c.dataType);
          const node = <React.Fragment key={c.name}>{fieldRow(f, c.name, icon, t, { hidden: c.hidden })}
            {isDate && open[`${t.name}|${c.name}`] && <div>
              <div className="tree-item" style={{ paddingLeft: 40 }} draggable onDragStart={dragStart(f)}><I n="hierarchy" s={14} /><span className="nm">Date Hierarchy</span></div>
              {(['Year', 'Quarter', 'Month', 'Day'] as const).map(p => fieldRow({ ...f, datePart: p }, p, 'fieldDate', t, { indent: 36 }))}
            </div>}
          </React.Fragment>;
          push(c.displayFolder, isDate ? <div key={c.name} style={{ position: 'relative' }}>
            <button className="iconbtn" style={{ position: 'absolute', left: 2, top: 2, height: 18, minWidth: 16, zIndex: 1 }} onClick={() => setOpen({ ...open, [`${t.name}|${c.name}`]: !open[`${t.name}|${c.name}`] })} aria-label="Show date hierarchy"><I n={open[`${t.name}|${c.name}`] ? 'chevronDown' : 'chevronRight'} s={10} /></button>{node}</div> : node);
        }
        if (t.calculationGroup) {
          const items = [...t.calculationGroup.items].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
          const move = (name: string, d: number) => updateCalcGroup(t.name, g => {
            const arr = [...g.items].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)); const i = arr.findIndex(x => x.name === name); const j = i + d;
            if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; arr.forEach((x, k) => { x.ordinal = k; }); g.items = arr;
          });
          push(undefined, <FolderNode key="__items" name="Calculation items">
            {items.filter(it => match(it.name)).map(it => <div key={it.name} className={`tree-item ${s.ui.formula?.kind === 'calcitem' && s.ui.formula.editing === it.name && s.ui.formula.table === t.name ? 'selected' : ''}`} style={{ paddingLeft: 20 }}
              onClick={() => editCalcItem(t.name, it.name)}
              onContextMenu={e => menuAt(e, [
                { label: 'Edit formula', icon: 'edit', onClick: () => editCalcItem(t.name, it.name) },
                { label: 'New calculation item', icon: 'calcgroup', onClick: () => startCalcItem(t.name) },
                { label: 'Move up', onClick: () => move(it.name, -1) },
                { label: 'Move down', onClick: () => move(it.name, 1) },
                { sep: true },
                { label: 'Delete', icon: 'trash', disabled: items.length < 2, onClick: () => updateCalcGroup(t.name, g => { g.items = g.items.filter(x => x.name !== it.name); }) },
              ])} title={it.expression}>
              <I n="fieldCalc" s={15} /><span className="nm">{it.name}</span>
            </div>)}
          </FolderNode>);
        }
        for (const h of hiers) push(undefined, <div key={'h' + h.name}>
          {fieldRow({ table: t.name, hierarchy: h.name }, h.name, 'hierarchy', t)}
          {h.levels.map(l => fieldRow({ table: t.name, column: l }, l, 'fieldText', t, { indent: 18 }))}
        </div>);
        return <div key={t.name}>
          {rename === JSON.stringify({ table: t.name })
            ? <input className="tx" autoFocus defaultValue={t.name} onBlur={e => { setRename(null); if (e.target.value.trim() && e.target.value !== t.name) renameField({ table: t.name }, e.target.value.trim()); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            : <div className="tree-table" onClick={() => { setOpen({ ...open, [t.name]: !isOpen }); s.setUI({ field: { table: t.name }, tableViewTable: mode === 'table' ? t.name : s.ui.tableViewTable }); }} onContextMenu={e => tableMenu(e, t)} onDoubleClick={() => setRename(JSON.stringify({ table: t.name }))}>
              <I n={isOpen ? 'chevronDown' : 'chevronRight'} s={11} />
              <I n={t.calculationGroup ? 'calcgroup' : t.expression ? 'calcTable' : 'tableIcon'} s={15} />
              <span style={{ flex: 1, fontWeight: s.ui.field?.table === t.name && !s.ui.field.column && !s.ui.field.measure ? 600 : 400, fontStyle: t.hidden ? 'italic' : undefined, color: t.hidden ? '#8a8886' : undefined }}>{t.name}</span>
              {t.dateColumn && <span title="Marked as date table"><I n="calendar" s={13} /></span>}
              {t.loadErrors ? <span title={`${t.loadErrors} errors were replaced with blanks while loading`}><I n="warning" s={13} /></span> : null}
            </div>}
          {isOpen && <div>
            {[...folders.entries()].map(([fname, nodes]) => <FolderNode key={fname} name={fname}>{nodes}</FolderNode>)}
            {loose}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function FolderNode({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <div><div className="tree-folder" onClick={() => setOpen(!open)}><I n={open ? 'chevronDown' : 'chevronRight'} s={10} /><I n="folderSm" s={14} />{name}</div>{open && <div style={{ paddingLeft: 12 }}>{children}</div>}</div>;
}
