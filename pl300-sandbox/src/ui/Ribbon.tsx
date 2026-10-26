// The Power BI Desktop ribbon for Report, Table, Model and DAX query views.
import React from 'react';
import { useStore, store } from '../store';
import { I } from './icons';
import { menuBelow, MenuItem } from './common';
import { addVisual, startNewMeasure, startNewColumn, startNewTable, openPowerQuery, refreshAll, newPage, copyVisuals, pasteVisuals, deleteSelected, newCalculationGroup, startCalcItem } from './actions';
import { THEMES } from './report/themes';
import { startVisualCalc } from './report/VisualCalcEditor';
import { LABELS, labelRank } from '../model/labels';
import { VISUALS } from '../report/visuals';
import { drillLevels } from '../report/query';
import { clearQueryCache } from './report/vhelpers';
import { exportVisualData } from './report/Canvas';
import { DataType, isNumericType } from '../core/values';
import { convertValue } from '../m/convert';
import { Summarize, DataCategory } from '../model/types';

export function RBtn({ icon, label, onClick, disabled, on, title, menu }: { icon: string; label: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; on?: boolean; title?: string; menu?: boolean }) {
  return <button className={`rbtn ${on ? 'on' : ''}`} onClick={onClick} disabled={disabled} title={title ?? label}>
    <span className="ic"><I n={icon} s={30} /></span><span>{label}{menu && <> <I n="chevronDown" s={9} /></>}</span>
  </button>;
}
export function RSmall({ icon, label, onClick, disabled, on, title }: { icon: string; label: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; on?: boolean; title?: string }) {
  return <button className={`rsmall ${on ? 'on' : ''}`} onClick={onClick} disabled={disabled} title={title ?? label}><span className="ic"><I n={icon} s={16} /></span>{label}</button>;
}
export function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rgroup"><div className="rgroup-items">{children}</div><div className="rgroup-label">{label}</div></div>;
}

export function getDataMenu(el: HTMLElement) {
  const s = store;
  const items: MenuItem[] = [
    { header: 'Common data sources' },
    { label: 'Excel workbook', icon: 'excel', onClick: () => s.openDialog({ type: 'getData', kind: 'excel' }) },
    { label: 'Text/CSV', icon: 'csv', onClick: () => s.openDialog({ type: 'getData', kind: 'csv' }) },
    { label: 'JSON', icon: 'json', onClick: () => s.openDialog({ type: 'getData', kind: 'json' }) },
    { label: 'XML', icon: 'xml', onClick: () => s.openDialog({ type: 'getData', kind: 'xml' }) },
    { label: 'Parquet', icon: 'parquet', onClick: () => s.openDialog({ type: 'getData', kind: 'parquet' }) },
    { label: 'Folder', icon: 'folder', onClick: () => s.openDialog({ type: 'getData', kind: 'folder' }) },
    { label: 'SQL Server', icon: 'sql', onClick: () => s.openDialog({ type: 'getData', kind: 'sql' }) },
    { label: 'Enter data', icon: 'enterdata', onClick: () => s.openDialog({ type: 'enterData' }) },
    { label: 'Blank query', icon: 'blank', onClick: () => s.openDialog({ type: 'getData', kind: 'blank' }) },
    { sep: true },
    { label: 'Sample data (Contoso)', icon: 'sample', onClick: () => s.openDialog({ type: 'sampleData' }) },
    { label: 'More…', icon: 'getdata', onClick: () => s.openDialog({ type: 'getData' }) },
  ];
  menuBelow(el, items);
}

const FORMATS: { label: string; fs: string | undefined; kind: 'num' | 'date' | 'any' }[] = [
  { label: 'General', fs: undefined, kind: 'any' },
  { label: 'Whole number', fs: '0', kind: 'num' },
  { label: 'Decimal number', fs: '#,0.00', kind: 'num' },
  { label: 'Thousands separator', fs: '#,0', kind: 'num' },
  { label: 'Currency', fs: '\\$#,0.00;(\\$#,0.00);\\$#,0.00', kind: 'num' },
  { label: 'Percentage', fs: '0.00%', kind: 'num' },
  { label: 'Scientific', fs: '0.00E+000', kind: 'num' },
  { label: 'Short date (m/d/yyyy)', fs: 'm/d/yyyy', kind: 'date' },
  { label: 'Long date (dddd, mmmm d, yyyy)', fs: 'dddd, mmmm d, yyyy', kind: 'date' },
  { label: 'yyyy-mm-dd', fs: 'yyyy-mm-dd', kind: 'date' },
  { label: 'mmmm yyyy', fs: 'mmmm yyyy', kind: 'date' },
  { label: 'mmm yyyy', fs: 'mmm yyyy', kind: 'date' },
  { label: 'dd-mmm-yy', fs: 'dd-mmm-yy', kind: 'date' },
];
const MODEL_TYPES: [DataType, string][] = [['text', 'Text'], ['int', 'Whole number'], ['decimal', 'Decimal number'], ['currency', 'Fixed decimal number'], ['date', 'Date'], ['datetime', 'Date/time'], ['time', 'Time'], ['bool', 'True/false']];
const CATEGORIES: DataCategory[] = ['Uncategorized', 'Address', 'City', 'Continent', 'Country', 'County', 'Latitude', 'Longitude', 'Place', 'Postal code', 'State or Province', 'Web URL', 'Image URL', 'Barcode'];
const SUMMS: [Summarize, string][] = [['None', "Don't summarize"], ['Sum', 'Sum'], ['Average', 'Average'], ['Min', 'Minimum'], ['Max', 'Maximum'], ['Count', 'Count'], ['DistinctCount', 'Count (Distinct)']];

function ColumnTools() {
  const s = store; const f = s.ui.field!;
  const t = s.project.model.tables.find(x => x.name === f.table);
  const c = t?.columns.find(x => x.name === f.column);
  if (!t || !c) return null;
  const set = (patch: Partial<typeof c>, recalc = false) => { s.change(p => { Object.assign(p.model.tables.find(x => x.name === t.name)!.columns.find(x => x.name === c.name)!, patch); }, { recalc }); clearQueryCache(); };
  const changeType = (dt: DataType) => {
    s.change(p => {
      const tt = p.model.tables.find(x => x.name === t.name)!; const ci = tt.columns.findIndex(x => x.name === c.name);
      tt.columns[ci].dataType = dt; (tt.columns[ci] as any).typeOverride = dt;
      let bad = 0;
      for (const r of tt.rows) { const v = convertValue(r[ci], dt === 'time' ? 'datetime' : dt); if (v && typeof v === 'object' && 'reason' in v) { bad++; r[ci] = null; } else r[ci] = v; }
      if (bad) setTimeout(() => s.toast(`${bad} values couldn't be converted to ${dt} and are now blank.`, 'error'));
      if (isNumericType(dt) && tt.columns[ci].summarizeBy === 'None' && !/key|id$/i.test(c.name)) tt.columns[ci].summarizeBy = 'Sum';
    }, { recalc: true });
    clearQueryCache();
  };
  const fmtKind = isNumericType(c.dataType) ? 'num' : c.dataType === 'date' || c.dataType === 'datetime' ? 'date' : 'any';
  return <>
    <Group label="Structure">
      <div className="rstack">
        <div className="rfield">Name <input defaultValue={c.name} key={c.name} onBlur={e => { const n = e.target.value.trim(); if (n && n !== c.name) import('./actions').then(a => a.renameField({ table: t.name, column: c.name }, n)); }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></div>
        <div className="rfield">Data type <select value={c.dataType} onChange={e => changeType(e.target.value as DataType)} disabled={!!c.expression && false}>{MODEL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
    </Group>
    <Group label="Formatting">
      <div className="rstack">
        <div className="rfield">Format <select value={FORMATS.find(x => x.fs === c.formatString)?.label ?? (c.formatString ? 'Custom' : 'General')} onChange={e => set({ formatString: FORMATS.find(x => x.label === e.target.value)?.fs })}>
          {FORMATS.filter(x => x.kind === 'any' || x.kind === fmtKind).map(x => <option key={x.label}>{x.label}</option>)}{c.formatString && !FORMATS.some(x => x.fs === c.formatString) && <option>Custom</option>}
        </select></div>
        <div className="rfield">
          <button className="rsmall" title="Currency" onClick={() => set({ formatString: '\\$#,0.00;(\\$#,0.00);\\$#,0.00' })} disabled={fmtKind !== 'num'}>$</button>
          <button className="rsmall" title="Percentage" onClick={() => set({ formatString: '0.00%' })} disabled={fmtKind !== 'num'}>%</button>
          <button className="rsmall" title="Thousands separator" onClick={() => set({ formatString: '#,0' })} disabled={fmtKind !== 'num'}>9</button>
          <input type="number" min={0} max={10} style={{ width: 44 }} title="Decimal places" disabled={fmtKind !== 'num'} defaultValue={/\.(0+)/.exec(c.formatString ?? '')?.[1].length ?? ''} key={c.formatString} onBlur={e => { const d = +e.target.value; set({ formatString: `#,0${d ? '.' + '0'.repeat(d) : ''}${/%/.test(c.formatString ?? '') ? '%' : ''}` }); }} />
        </div>
        <div className="rfield">Custom <input defaultValue={c.formatString ?? ''} key={'cf' + c.formatString} placeholder="e.g. #,0.0" onBlur={e => set({ formatString: e.target.value || undefined })} style={{ width: 110 }} /></div>
      </div>
    </Group>
    <Group label="Properties">
      <div className="rstack">
        <div className="rfield">Summarization <select value={c.summarizeBy ?? 'None'} onChange={e => set({ summarizeBy: e.target.value as Summarize })}>{SUMMS.filter(([k]) => isNumericType(c.dataType) || ['None', 'Count', 'DistinctCount', 'Min', 'Max'].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="rfield">Data category <select value={c.dataCategory ?? 'Uncategorized'} onChange={e => set({ dataCategory: e.target.value as DataCategory })}>{CATEGORIES.map(k => <option key={k}>{k}</option>)}</select></div>
        <div className="rfield">Display folder <input defaultValue={c.displayFolder ?? ''} key={'df' + c.name} onBlur={e => set({ displayFolder: e.target.value || undefined })} style={{ width: 100 }} /></div>
      </div>
    </Group>
    <Group label="Sort">
      <RBtn icon="sort" label="Sort by column" menu onClick={e => menuBelow(e.currentTarget, [{ label: c.name, checked: !c.sortByColumn, onClick: () => set({ sortByColumn: undefined }) }, ...t.columns.filter(x => x.name !== c.name).map(x => ({ label: x.name, checked: c.sortByColumn === x.name, onClick: () => {
        // Power BI requires one sort value per column value
        const ci = t.columns.indexOf(c), si = t.columns.indexOf(x); const map = new Map<any, any>(); let bad = false;
        for (const r of t.rows) { const k = r[ci] instanceof Date ? r[ci].getTime() : r[ci]; const sv = r[si] instanceof Date ? r[si].getTime() : r[si]; if (map.has(k) && map.get(k) !== sv) { bad = true; break; } map.set(k, sv); }
        if (bad) s.openDialog({ type: 'message', title: 'Sort by column', text: `We can't sort the '${c.name}' column by '${x.name}'. There can't be more than one value in '${x.name}' for the same value in '${c.name}'. Please choose another column for sorting or update the data in '${x.name}'.` });
        else set({ sortByColumn: x.name });
      } }))])} />
    </Group>
    <Group label="Groups"><RBtn icon="group" label="Data groups" onClick={() => s.openDialog({ type: 'groups', table: t.name, column: c.name })} /></Group>
    <Group label="Relationships"><RBtn icon="relationship" label="Manage relationships" onClick={() => s.openDialog({ type: 'relationships' })} /></Group>
    <Group label="Calculations"><RBtn icon="newcolumn" label="New column" onClick={() => startNewColumn(t.name)} /></Group>
  </>;
}

function MeasureTools() {
  const s = store; const f = s.ui.field!;
  const mm = s.project.model.measures.find(x => x.name === f.measure);
  if (!mm) return null;
  const set = (patch: Partial<typeof mm>) => { s.change(p => { Object.assign(p.model.measures.find(x => x.name === mm.name)!, patch); }); clearQueryCache(); };
  return <>
    <Group label="Structure">
      <div className="rstack">
        <div className="rfield">Name <input defaultValue={mm.name} key={mm.name} onBlur={e => { const n = e.target.value.trim(); if (n && n !== mm.name) import('./actions').then(a => a.renameField({ table: mm.table, measure: mm.name }, n)); }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></div>
        <div className="rfield">Home table <select value={mm.table} onChange={e => set({ table: e.target.value })}>{s.project.model.tables.map(t => <option key={t.name}>{t.name}</option>)}</select></div>
      </div>
    </Group>
    <Group label="Formatting">
      <div className="rstack">
        <div className="rfield">Format <select value={FORMATS.find(x => x.fs === mm.formatString)?.label ?? (mm.formatString ? 'Custom' : 'General')} onChange={e => set({ formatString: FORMATS.find(x => x.label === e.target.value)?.fs })}>{FORMATS.map(x => <option key={x.label}>{x.label}</option>)}{mm.formatString && !FORMATS.some(x => x.fs === mm.formatString) && <option>Custom</option>}</select></div>
        <div className="rfield">
          <button className="rsmall" title="Currency" onClick={() => set({ formatString: '\\$#,0.00;(\\$#,0.00);\\$#,0.00' })}>$</button>
          <button className="rsmall" title="Percentage" onClick={() => set({ formatString: '0.00%' })}>%</button>
          <button className="rsmall" title="Thousands separator" onClick={() => set({ formatString: '#,0' })}>9</button>
          <input type="number" min={0} max={10} style={{ width: 44 }} title="Decimal places" defaultValue={/\.(0+)/.exec(mm.formatString ?? '')?.[1].length ?? ''} key={mm.formatString} onBlur={e => { const d = +e.target.value; set({ formatString: `${/\$/.test(mm.formatString ?? '') ? '\\$' : ''}#,0${d ? '.' + '0'.repeat(d) : ''}${/%/.test(mm.formatString ?? '') ? '%' : ''}` }); }} />
        </div>
        <div className="rfield">Custom <input defaultValue={mm.formatString ?? ''} key={'mf' + mm.formatString} onBlur={e => set({ formatString: e.target.value || undefined })} style={{ width: 110 }} /></div>
      </div>
    </Group>
    <Group label="Properties">
      <div className="rstack">
        <div className="rfield">Display folder <input defaultValue={mm.displayFolder ?? ''} key={'mdf' + mm.name} onBlur={e => set({ displayFolder: e.target.value || undefined })} style={{ width: 110 }} /></div>
        <div className="rfield">Description <input defaultValue={mm.description ?? ''} key={'md' + mm.name} onBlur={e => set({ description: e.target.value || undefined })} style={{ width: 150 }} /></div>
      </div>
    </Group>
    <Group label="Calculations"><RBtn icon="measure" label="New measure" onClick={() => startNewMeasure(mm.table)} /><RBtn icon="quickmeasure" label="Quick measure" onClick={() => s.openDialog({ type: 'quickMeasure', table: mm.table })} /></Group>
  </>;
}

function TableTools() {
  const s = store; const tn = s.ui.field?.table ?? s.ui.tableViewTable;
  const t = s.project.model.tables.find(x => x.name === tn);
  if (!t) return null;
  return <>
    <Group label="Structure"><div className="rstack"><div className="rfield">Name <input defaultValue={t.name} key={t.name} onBlur={e => { const n = e.target.value.trim(); if (n && n !== t.name) import('./actions').then(a => a.renameField({ table: t.name }, n)); }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></div></div></Group>
    <Group label="Calendars"><RBtn icon="calendar" label="Mark as date table" on={!!t.dateColumn} onClick={() => s.openDialog({ type: 'markDate', table: t.name })} /></Group>
    <Group label="Relationships"><RBtn icon="relationship" label="Manage relationships" onClick={() => s.openDialog({ type: 'relationships' })} /></Group>
    <Group label="Calculations">
      <RBtn icon="measure" label="New measure" onClick={() => startNewMeasure(t.name)} />
      <RBtn icon="quickmeasure" label="Quick measure" onClick={() => s.openDialog({ type: 'quickMeasure', table: t.name })} />
      <RBtn icon="newcolumn" label="New column" onClick={() => startNewColumn(t.name)} />
      <RBtn icon="newtable" label="New table" onClick={() => startNewTable()} />
      {t.calculationGroup && <RBtn icon="calcgroup" label="New calculation item" onClick={() => startCalcItem(t.name)} />}
    </Group>
  </>;
}

export function Ribbon() {
  const s = useStore();
  const view = s.ui.view;
  const v = view === 'report' ? s.selectedVisual() : undefined;
  const f = s.ui.field;
  const fieldIsCol = !!(f?.column && s.project.model.tables.find(t => t.name === f.table)?.columns.some(c => c.name === f.column));
  const fieldIsMeasure = !!(f?.measure && s.project.model.measures.some(x => x.name === f.measure));
  const ctxTabs: string[] = [];
  if (v) ctxTabs.push('Format', 'Data / Drill');
  if ((view === 'table' || view === 'model' || view === 'report') && (f?.table || (view === 'table' && s.ui.tableViewTable))) ctxTabs.push('Table tools');
  if (fieldIsCol && view !== 'dax') ctxTabs.push('Column tools');
  if (fieldIsMeasure && view !== 'dax') ctxTabs.push('Measure tools');
  const base = view === 'report' ? ['Home', 'Insert', 'Modeling', 'View', 'Optimize', 'Help'] : view === 'dax' ? ['Home', 'Help'] : ['Home', 'Help'];
  const tabs = [...base, ...ctxTabs];
  const tab = tabs.includes(s.ui.ribbon) ? s.ui.ribbon : 'Home';
  const setTab = (t: string) => s.setUI({ ribbon: t });
  const hasData = s.project.model.tables.length > 0;
  const lv = v ? drillLevels(s, v, v.type === 'matrix' ? 'rows' : 'axis') : null;
  let body: React.ReactNode = null;
  if (tab === 'Home') body = <>
    <Group label="Clipboard">
      <RBtn icon="paste" label="Paste" onClick={pasteVisuals} disabled={!s.ui.clipboard || view !== 'report'} />
      <div className="rstack">
        <RSmall icon="cut" label="Cut" disabled={view !== 'report' || !s.ui.selected.length} onClick={() => { copyVisuals(); deleteSelected(); }} />
        <RSmall icon="copy" label="Copy" disabled={view !== 'report' || !s.ui.selected.length} onClick={copyVisuals} />
        <RSmall icon="brush" label="Format painter" on={!!s.ui.painter} disabled={!v} onClick={() => { s.setUI({ painter: s.ui.painter ? null : JSON.parse(JSON.stringify(v!.format ?? {})) }); if (!s.ui.painter) return; s.toast('Format painter: click another visual to apply this formatting.'); }} />
      </div>
    </Group>
    <Group label="Data">
      <RBtn icon="getdata" label="Get data" menu onClick={e => getDataMenu(e.currentTarget)} />
      <RBtn icon="excel" label="Excel workbook" onClick={() => s.openDialog({ type: 'getData', kind: 'excel' })} />
      <RBtn icon="sql" label="SQL Server" onClick={() => s.openDialog({ type: 'getData', kind: 'sql' })} />
      <RBtn icon="enterdata" label="Enter data" onClick={() => s.openDialog({ type: 'enterData' })} />
      <RBtn icon="sample" label="Sample data" onClick={() => s.openDialog({ type: 'sampleData' })} />
    </Group>
    <Group label="Queries">
      <RBtn icon="transform" label="Transform data" menu onClick={e => menuBelow(e.currentTarget, [
        { label: 'Transform data', icon: 'transform', onClick: () => openPowerQuery() },
        { label: 'Data source settings', icon: 'datasource', onClick: () => s.openDialog({ type: 'dataSources' }) },
        { label: 'Edit parameters', icon: 'manageparams', onClick: () => s.openDialog({ type: 'editParams' }) },
      ])} />
      <RBtn icon="refresh" label="Refresh" onClick={refreshAll} disabled={!s.project.queries.length} />
    </Group>
    {view === 'report' && <Group label="Insert">
      <RBtn icon="newvisual" label="New visual" onClick={() => addVisual('clusteredColumn')} disabled={!hasData} />
      <RBtn icon="textbox" label="Text box" onClick={() => addVisual('textbox')} />
      <RBtn icon="moreVisuals" label="More visuals" menu onClick={e => menuBelow(e.currentTarget, VISUALS.filter(x => x.group !== 'element').map(x => ({ label: x.name, icon: 'v_' + x.type, onClick: () => addVisual(x.type) })))} />
    </Group>}
    <Group label="Calculations">
      <RBtn icon="measure" label="New measure" onClick={() => startNewMeasure()} disabled={!hasData} />
      <RBtn icon="quickmeasure" label="Quick measure" onClick={() => s.openDialog({ type: 'quickMeasure' })} disabled={!hasData} />
      {view === 'report' && <RBtn icon="visualCalc" label="New visual calculation" onClick={() => startVisualCalc()} disabled={!v} title="Select a visual first" />}
      {view !== 'report' && <RBtn icon="newcolumn" label="New column" onClick={() => startNewColumn()} disabled={!hasData} />}
      {view !== 'report' && <RBtn icon="newtable" label="New table" onClick={() => startNewTable()} />}
      {view === 'model' && <RBtn icon="calcgroup" label="Calculation group" onClick={newCalculationGroup} disabled={!hasData} />}
    </Group>
    {view === 'report' && <Group label="Copilot"><RBtn icon="chat" label="Copilot" on={!!s.ui.copilot} onClick={() => s.setUI({ copilot: !s.ui.copilot })} /></Group>}
    <Group label="Sensitivity">
      <RBtn icon="label" label={s.project.report.sensitivity ?? 'Sensitivity'} menu onClick={e => menuBelow(e.currentTarget, [
        ...LABELS.map(l => ({ label: l.name, checked: s.project.report.sensitivity === l.name, onClick: () => {
          const cur = labelRank(s.project.report.sensitivity), next = labelRank(l.name);
          const apply = () => s.change(p => { p.report.sensitivity = l.name; });
          if (cur > next) s.openDialog({ type: 'confirm', title: 'Change sensitivity label', text: `You're lowering the label from ${s.project.report.sensitivity} to ${l.name}. Your organization may ask you to justify a downgrade, and it's recorded in the audit log.`, ok: 'Change', onOk: apply });
          else apply();
        } })),
        { sep: true },
        { label: 'Remove label', disabled: !s.project.report.sensitivity, onClick: () => s.change(p => { p.report.sensitivity = undefined; }) },
      ])} />
    </Group>
    <Group label="Share">
      <RBtn icon="publish" label="Publish" onClick={() => s.openDialog({ type: 'publish' })} />
    </Group>
  </>;
  if (tab === 'Insert') body = <>
    <Group label="Pages"><RBtn icon="newpage" label="New page" menu onClick={e => menuBelow(e.currentTarget, [{ label: 'Blank page', onClick: newPage }, { label: 'Duplicate page', onClick: () => s.change(p => { const pg = s.page(); const c = JSON.parse(JSON.stringify(pg)); c.id = 'pg' + Math.random().toString(36).slice(2); c.name = 'Duplicate of ' + pg.name; c.visuals.forEach((x: any) => { x.id = 'v' + Math.random().toString(36).slice(2); }); p.report.pages.push(c); s.ui.pageId = c.id; }) }])} /></Group>
    <Group label="Visuals"><RBtn icon="newvisual" label="New visual" onClick={() => addVisual('clusteredColumn')} disabled={!hasData} /><RBtn icon="moreVisuals" label="More visuals" menu onClick={e => menuBelow(e.currentTarget, VISUALS.filter(x => x.group !== 'element').map(x => ({ label: x.name, icon: 'v_' + x.type, onClick: () => addVisual(x.type) })))} /></Group>
    <Group label="AI visuals">
      <RBtn icon="v_keyInfluencers" label="Key influencers" onClick={() => addVisual('keyInfluencers')} />
      <RBtn icon="v_decompositionTree" label="Decomposition tree" onClick={() => addVisual('decompositionTree')} />
      <RBtn icon="qna" label="Q&A" onClick={() => addVisual('qna')} />
      <RBtn icon="v_smartNarrative" label="Narrative" onClick={() => addVisual('smartNarrative')} />
    </Group>
    <Group label="Elements">
      <RBtn icon="textbox" label="Text box" onClick={() => addVisual('textbox')} />
      <RBtn icon="button" label="Buttons" menu onClick={e => menuBelow(e.currentTarget, [
        { label: 'Blank', onClick: () => addVisual('button') },
        { label: 'Back', onClick: () => { const id = addVisual('button'); s.updateVisual(id, x => { x.format = { icon: 'back' }; x.text = ''; x.action = { type: 'back' }; x.w = 48; }); } },
        { label: 'Bookmark', onClick: () => { const id = addVisual('button'); s.updateVisual(id, x => { x.action = { type: 'bookmark' }; x.text = 'Bookmark'; }); } },
        { label: 'Page navigation', onClick: () => { const id = addVisual('button'); s.updateVisual(id, x => { x.action = { type: 'page' }; x.text = 'Go to page'; }); } },
        { label: 'Information', onClick: () => { const id = addVisual('button'); s.updateVisual(id, x => { x.format = { icon: 'info' }; x.text = ''; x.w = 48; }); } },
      ])} />
      <RBtn icon="shape" label="Shapes" menu onClick={e => menuBelow(e.currentTarget, [{ label: 'Rectangle', onClick: () => addVisual('shape') }, { label: 'Rounded rectangle', onClick: () => { const id = addVisual('shape'); s.updateVisual(id, x => { x.format = { shape: 'rounded' }; }); } }, { label: 'Oval', onClick: () => { const id = addVisual('shape'); s.updateVisual(id, x => { x.format = { shape: 'oval' }; }); } }])} />
      <RBtn icon="image" label="Image" onClick={() => { const id = addVisual('image'); s.setUI({ selected: [id], vizTab: 'format' }); }} />
    </Group>
  </>;
  if (tab === 'Modeling') body = <>
    <Group label="Relationships"><RBtn icon="relationship" label="Manage relationships" onClick={() => s.openDialog({ type: 'relationships' })} disabled={!hasData} /></Group>
    <Group label="Calculations">
      <RBtn icon="measure" label="New measure" onClick={() => startNewMeasure()} disabled={!hasData} />
      <RBtn icon="quickmeasure" label="Quick measure" onClick={() => s.openDialog({ type: 'quickMeasure' })} disabled={!hasData} />
      <RBtn icon="newcolumn" label="New column" onClick={() => startNewColumn()} disabled={!hasData} />
      <RBtn icon="newtable" label="New table" onClick={() => startNewTable()} />
      <RBtn icon="calcgroup" label="Calculation group" onClick={newCalculationGroup} disabled={!hasData} />
    </Group>
    <Group label="Parameters"><RBtn icon="param" label="New parameter" menu onClick={e => menuBelow(e.currentTarget, [{ label: 'Numeric range', onClick: () => s.openDialog({ type: 'whatIf' }) }, { label: 'Fields', onClick: () => s.openDialog({ type: 'fieldParam' }) }])} /></Group>
    <Group label="Security">
      <RBtn icon="role" label="Manage roles" onClick={() => s.openDialog({ type: 'roles' })} disabled={!hasData} />
      <RBtn icon="viewas" label="View as" on={!!s.ui.viewAs} onClick={() => s.openDialog({ type: 'viewAs' })} disabled={!s.project.model.roles.length} />
    </Group>
    <Group label="Q&A"><RBtn icon="qna" label="Q&A setup" onClick={() => s.openDialog({ type: 'message', title: 'Q&A setup', text: 'Q&A in the sandbox matches your question against measure and column names. Rename fields (or add a measure with the word you use) to improve results. Try: "Total Sales by Category", "count of orders by year as line".' })} /></Group>
  </>;
  if (tab === 'View') body = <>
    <Group label="Themes"><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 38px)', gap: 3 }}>
      {Object.entries(THEMES).map(([n, t]) => <button key={n} title={n} onClick={() => { s.change(p => { p.report.theme = n; }); clearQueryCache(); }} style={{ width: 38, height: 30, border: s.project.report.theme === n ? '2px solid #252423' : '1px solid #c8c6c4', padding: 2, background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, borderRadius: 3 }}>{t.colors.slice(0, 4).map(c => <span key={c} style={{ background: c }} />)}</button>)}
    </div></Group>
    <Group label="Scale to fit"><RBtn icon="fitpage" label="Page view" menu onClick={e => menuBelow(e.currentTarget, [{ label: 'Fit to page', checked: s.ui.zoom === 0, onClick: () => s.setUI({ zoom: 0 }) }, { label: 'Actual size', checked: s.ui.zoom === 100, onClick: () => s.setUI({ zoom: 100 }) }, { label: '75%', checked: s.ui.zoom === 75, onClick: () => s.setUI({ zoom: 75 }) }, { label: '50%', checked: s.ui.zoom === 50, onClick: () => s.setUI({ zoom: 50 }) }])} /></Group>
    <Group label="Mobile"><RBtn icon="mobile" label="Mobile layout" on={!!s.ui.mobileLayout} onClick={() => s.setUI({ mobileLayout: !s.ui.mobileLayout, selected: [] })} /></Group>
    <Group label="Page options"><div className="rstack">
      <label className="rsmall"><input type="checkbox" checked={s.ui.gridlines} onChange={e => s.setUI({ gridlines: e.target.checked })} /> Gridlines</label>
      <label className="rsmall"><input type="checkbox" checked={s.ui.snap} onChange={e => s.setUI({ snap: e.target.checked })} /> Snap to grid</label>
      <label className="rsmall"><input type="checkbox" checked={s.ui.focus === 'reading'} onChange={e => s.setUI({ focus: e.target.checked ? 'reading' : null })} /> Reading view</label>
    </div></Group>
    <Group label="Show panes">
      <RBtn icon="filter" label="Filters" on={s.ui.panes.filters} onClick={() => s.setUI({ panes: { ...s.ui.panes, filters: !s.ui.panes.filters } })} />
      <RBtn icon="bookmark" label="Bookmarks" on={s.ui.panes.bookmarks} onClick={() => s.setUI({ panes: { ...s.ui.panes, bookmarks: !s.ui.panes.bookmarks } })} />
      <RBtn icon="selection" label="Selection" on={s.ui.panes.selection} onClick={() => s.setUI({ panes: { ...s.ui.panes, selection: !s.ui.panes.selection } })} />
      <RBtn icon="perf" label="Performance analyzer" on={s.ui.panes.perf} onClick={() => s.setUI({ panes: { ...s.ui.panes, perf: !s.ui.panes.perf } })} />
      <RBtn icon="sync" label="Sync slicers" on={s.ui.panes.sync} onClick={() => s.setUI({ panes: { ...s.ui.panes, sync: !s.ui.panes.sync } })} />
    </Group>
  </>;
  if (tab === 'Optimize') body = <>
    <Group label="Refresh"><RBtn icon="refresh" label="Refresh visuals" onClick={() => { clearQueryCache(); s.emit(); }} /></Group>
    <Group label="Optimization presets"><RBtn icon="options" label="Optimization presets" disabled title="Not part of the sandbox" /></Group>
    <Group label="Show panes"><RBtn icon="perf" label="Performance analyzer" on={s.ui.panes.perf} onClick={() => s.setUI({ panes: { ...s.ui.panes, perf: !s.ui.panes.perf } })} /></Group>
  </>;
  if (tab === 'Help') body = <>
    <Group label="Help"><RBtn icon="grad" label="PL-300 tutorials" onClick={() => s.setUI({ showTutorials: true })} /><RBtn icon="help" label="Keyboard shortcuts" onClick={() => s.openDialog({ type: 'shortcuts' })} /><RBtn icon="info" label="About" onClick={() => s.openDialog({ type: 'about' })} /></Group>
    <Group label="Community"><RBtn icon="book" label="PL-300 study guide" onClick={() => window.open('https://learn.microsoft.com/credentials/certifications/resources/study-guides/pl-300', '_blank')} /><RBtn icon="book" label="DAX reference" onClick={() => window.open('https://learn.microsoft.com/dax/dax-function-reference', '_blank')} /><RBtn icon="book" label="M reference" onClick={() => window.open('https://learn.microsoft.com/powerquery-m/power-query-m-function-reference', '_blank')} /></Group>
  </>;
  if (tab === 'Format' && v) body = <>
    <Group label="Interactions"><RBtn icon="filter" label="Edit interactions" on={s.ui.editInteractions} onClick={() => s.setUI({ editInteractions: !s.ui.editInteractions })} title="Choose how this visual filters or highlights the others on the page" /></Group>
    <Group label="Arrange"><div className="rstack">
      <RSmall icon="chevronUp" label="Bring forward" onClick={() => s.updateVisual(v.id, x => { x.z = (x.z ?? 0) + 1; })} />
      <RSmall icon="chevronDown" label="Send backward" onClick={() => s.updateVisual(v.id, x => { x.z = (x.z ?? 0) - 1; })} />
      <RSmall icon="selection" label="Selection pane" onClick={() => s.setUI({ panes: { ...s.ui.panes, selection: true } })} />
    </div><RBtn icon="snap" label="Align" menu onClick={e => {
      const sel = s.page().visuals.filter(x => s.ui.selected.includes(x.id));
      const al = (f: (x: typeof sel[0], all: typeof sel) => void) => s.change(p => { const pv = p.report.pages.find(pg => pg.id === s.ui.pageId)!.visuals.filter(x => s.ui.selected.includes(x.id)); pv.forEach(x => f(x, pv)); });
      menuBelow(e.currentTarget, [
        { label: 'Align left', onClick: () => al((x, a) => { x.x = Math.min(...a.map(y => y.x)); }) },
        { label: 'Align right', onClick: () => al((x, a) => { x.x = Math.max(...a.map(y => y.x + y.w)) - x.w; }) },
        { label: 'Align top', onClick: () => al((x, a) => { x.y = Math.min(...a.map(y => y.y)); }) },
        { label: 'Align bottom', onClick: () => al((x, a) => { x.y = Math.max(...a.map(y => y.y + y.h)) - x.h; }) },
        { label: 'Distribute horizontally', disabled: sel.length < 3, onClick: () => al((x, a) => { const s0 = [...a].sort((p, q) => p.x - q.x); const tot = s0[s0.length - 1].x + s0[s0.length - 1].w - s0[0].x - a.reduce((t, y) => t + y.w, 0); const gap = tot / (a.length - 1); let cur = s0[0].x; for (const y of s0) { y.x = Math.round(cur); cur += y.w + gap; } void x; }) },
      ]);
    }} /></Group>
    <Group label="Visual"><RBtn icon="format" label="Format visual" onClick={() => s.setUI({ vizTab: 'format' })} /></Group>
  </>;
  if (tab === 'Data / Drill' && v) body = <>
    <Group label="Data"><RBtn icon="table" label="Show as a table" onClick={() => s.openDialog({ type: 'showAsTable', visualId: v.id })} /><RBtn icon="export" label="Export data" onClick={() => exportVisualData(v, s.page())} /></Group>
    <Group label="Drill actions">
      <RBtn icon="drillUp" label="Drill up" disabled={!lv?.canDrill || !lv.level} onClick={() => s.updateVisual(v.id, x => { x.drill = { level: Math.max(0, lv!.level - 1), path: (x.drill?.path ?? []).slice(0, Math.max(0, lv!.level - 1)) }; }, false)} />
      <RBtn icon="drillMode" label="Drill down" on={!!v.format?.drillMode} disabled={!lv?.canDrill} onClick={() => s.updateVisual(v.id, x => { x.format = { ...x.format, drillMode: !x.format?.drillMode }; }, false)} />
      <RBtn icon="nextLevel" label="Show next level" disabled={!lv?.canDrill || lv.level >= lv.levels.length - 1} onClick={() => s.updateVisual(v.id, x => { x.drill = { level: lv!.level + 1, path: [] }; }, false)} />
      <RBtn icon="expandAll" label="Expand next level" disabled={!lv?.canDrill || lv.level >= lv.levels.length - 1} onClick={() => s.updateVisual(v.id, x => { x.drill = { level: lv!.level + 1, path: [], expandAll: true }; }, false)} />
    </Group>
  </>;
  if (tab === 'Table tools') body = <TableTools />;
  if (tab === 'Column tools') body = <ColumnTools />;
  if (tab === 'Measure tools') body = <MeasureTools />;
  if (view === 'dax' && tab === 'Home') body = <>
    <Group label="Clipboard"><RBtn icon="paste" label="Paste" disabled /></Group>
    <Group label="Data"><RBtn icon="getdata" label="Get data" menu onClick={e => getDataMenu(e.currentTarget)} /></Group>
    <Group label="Queries"><RBtn icon="transform" label="Transform data" onClick={() => openPowerQuery()} /><RBtn icon="refresh" label="Refresh" onClick={refreshAll} /></Group>
    <Group label="Calculations"><RBtn icon="measure" label="New measure" onClick={() => startNewMeasure()} disabled={!hasData} /><RBtn icon="quickmeasure" label="Quick queries" onClick={() => s.openDialog({ type: 'message', title: 'Quick queries', text: 'Right-click a table in the Data pane and pick "Show top 100 rows", or a measure and pick "Evaluate". Or write EVALUATE <table expression> and press Ctrl+Enter.' })} /></Group>
  </>;
  return <div className="ribbon">
    <div className="ribbon-tabs" role="tablist">
      <button className="rtab file" onClick={() => s.setUI({ backstage: true })}>File</button>
      {tabs.map(t => <button key={t} role="tab" aria-selected={t === tab} className={`rtab ${t === tab ? 'active' : ''} ${ctxTabs.includes(t) ? 'ctx' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
    </div>
    <div className="ribbon-body">{body}</div>
  </div>;
}
