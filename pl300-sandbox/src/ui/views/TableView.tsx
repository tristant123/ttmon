// Table view (formerly Data view): browse loaded tables, add calculated columns, set column properties.
import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { DataPane } from '../panes/DataPane';
import { FormulaBar } from '../FormulaBar';
import { Grid } from './Grid';
import { I } from '../icons';
import { menuAt } from '../common';
import { compareValues, isNumericType } from '../../core/values';
import { formatValue } from '../../core/format';
import { startNewColumn, editColumn, deleteField } from '../actions';

export function TableView() {
  const s = useStore();
  const tables = s.project.model.tables;
  const tn = s.ui.tableViewTable && tables.some(t => t.name === s.ui.tableViewTable) ? s.ui.tableViewTable : tables[0]?.name;
  const t = tables.find(x => x.name === tn);
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const [filter, setFilter] = useState<{ col: string; value: any } | null>(null);
  const rows = useMemo(() => {
    if (!t) return [];
    let r = t.rows;
    if (filter) { const i = t.columns.findIndex(c => c.name === filter.col); if (i >= 0) r = r.filter(x => compareValues(x[i], filter.value) === 0); }
    if (sort) { const i = t.columns.findIndex(c => c.name === sort.col); if (i >= 0) r = [...r].sort((a, b) => compareValues(a[i], b[i]) * (sort.desc ? -1 : 1)); }
    return r;
  }, [t, t?.rows, sort, filter, s.engineVersion]);
  return <>
    <div className="center">
      <div className="tv">
        <FormulaBar />
        {!t ? <div className="empty-canvas"><h2>No tables yet</h2><div>Load data with <b>Get data</b> or create a table with <b>New table</b>.</div></div> : <>
          {(t.storageMode === 'DirectQuery' || t.storageMode === 'DirectLake') ? <div className="empty-canvas"><h2>This table uses {t.storageMode === 'DirectLake' ? 'Direct Lake' : 'DirectQuery'} and cannot be shown</h2><div>Its data stays in the {t.storageMode === 'DirectLake' ? 'lakehouse' : 'source'}, so Table view has nothing to display. Build a table visual in Report view, or run <code>EVALUATE TOPN(100, '{t.name}')</code> in DAX query view.</div></div> : <>
          {(t as any).error && <div className="errbox" style={{ margin: 8 }}>Calculated table error: {(t as any).error}</div>}
          {t.loadErrors ? <div className="warnbox" style={{ margin: 8 }}>{t.loadErrors} cell errors were loaded as blanks. Fix them in Power Query (Remove Errors / Replace Errors) to keep your numbers honest.</div> : null}
          <Grid rows={rows} cols={t.columns.map(c => ({
            name: c.name,
            num: isNumericType(c.dataType),
            selected: s.ui.field?.table === t.name && s.ui.field.column === c.name,
            render: (v: any) => (v === null || v === undefined ? '' : formatValue(v, c.formatString ? c.formatString.replace(/\\\$/g, '$') : c.dataType === 'date' ? 'm/d/yyyy' : undefined)),
            onHeader: (e: React.MouseEvent) => { s.setUI({ field: { table: t.name, column: c.name } }); if (c.expression) editColumn(t.name, c.name); else if (s.ui.formula?.kind === 'column') s.setUI({ formula: null }); void e; },
            header: <div className="colh" onContextMenu={e => menuAt(e, [
              { label: 'Sort ascending', icon: 'sortAsc', onClick: () => setSort({ col: c.name, desc: false }) },
              { label: 'Sort descending', icon: 'sortDesc', onClick: () => setSort({ col: c.name, desc: true }) },
              { label: 'Clear sort', disabled: !sort, onClick: () => setSort(null) },
              { label: 'Clear filter', disabled: !filter, onClick: () => setFilter(null) },
              { sep: true },
              { label: 'New column', icon: 'newcolumn', onClick: () => startNewColumn(t.name) },
              ...(c.expression ? [{ label: 'Edit formula', icon: 'edit', onClick: () => editColumn(t.name, c.name) }, { label: 'Delete', icon: 'trash', onClick: () => deleteField({ table: t.name, column: c.name }) }] : []),
              { label: c.hidden ? 'Unhide in report view' : 'Hide in report view', onClick: () => s.change(p => { const cc = p.model.tables.find(x => x.name === t.name)!.columns.find(x => x.name === c.name)!; cc.hidden = !cc.hidden; }) },
            ])}>
              {c.expression && <I n="fieldCalcCol" s={13} />}
              <span className="nm" style={{ color: c.hidden ? '#8a8886' : undefined }}>{c.name}</span>
              {(c as any).error && <span title={(c as any).error}><I n="error" s={13} /></span>}
              <span className="dd" onClick={e => { e.stopPropagation(); menuAt(e, [
                { label: 'Sort ascending', icon: 'sortAsc', onClick: () => setSort({ col: c.name, desc: false }) },
                { label: 'Sort descending', icon: 'sortDesc', onClick: () => setSort({ col: c.name, desc: true }) },
                { label: 'Clear sort', disabled: !sort, onClick: () => setSort(null) },
                { sep: true },
                { header: 'Filter to a value (first 50)' },
                ...[...new Set(t.rows.map(r => r[t.columns.indexOf(c)]))].sort(compareValues).slice(0, 50).map(v => ({ label: v === null ? '(Blank)' : formatValue(v), checked: filter?.col === c.name && compareValues(filter.value, v) === 0, onClick: () => setFilter({ col: c.name, value: v }) })),
                { label: 'Clear filter', disabled: !filter, onClick: () => setFilter(null) },
              ]); }}><I n="chevronDown" s={11} /></span>
            </div>,
          }))} />
        </>}</>}
      </div>
    </div>
    <DataPane mode="table" />
  </>;
}
