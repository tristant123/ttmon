// Visualizations pane: Build visual (gallery + field wells), Format visual, Analytics.
import React, { useState } from 'react';
import { useStore, store } from '../../store';
import { I } from '../icons';
import { menuBelow, MenuItem, Toggle, Collapsible } from '../common';
import { VISUALS, vdef } from '../../report/visuals';
import { FieldRef, Visual } from '../../model/types';
import { fieldLabel, colMeta, isValueField, fieldKey } from '../../report/query';
import { addVisual, changeVisualType, addFieldToVisual } from '../actions';
import { isNumericType } from '../../core/values';
import { THEMES } from '../report/themes';

const AGGS: { key: FieldRef['agg']; label: string; num?: boolean }[] = [
  { key: 'Sum', label: 'Sum', num: true }, { key: 'Average', label: 'Average', num: true }, { key: 'Min', label: 'Minimum' }, { key: 'Max', label: 'Maximum' },
  { key: 'DistinctCount', label: 'Count (Distinct)' }, { key: 'Count', label: 'Count' }, { key: 'StdDev', label: 'Standard deviation', num: true }, { key: 'Variance', label: 'Variance', num: true }, { key: 'Median', label: 'Median', num: true },
];

function Well({ v, wellKey, label, kind }: { v: Visual; wellKey: string; label: string; kind: string }) {
  const s = store;
  const [over, setOver] = useState(false);
  const [rename, setRename] = useState<number | null>(null);
  const fields = v.wells[wellKey] ?? [];
  const m = s.project.model;
  const update = (f: (list: FieldRef[]) => void) => s.updateVisual(v.id, x => { const l = [...(x.wells[wellKey] ?? [])]; f(l); x.wells[wellKey] = l; x.drill = undefined; });
  const pillMenu = (el: HTMLElement, i: number) => {
    const f = fields[i];
    const c = colMeta(m, f);
    const items: MenuItem[] = [{ label: 'Remove field', icon: 'close', onClick: () => update(l => l.splice(i, 1)) }, { label: 'Rename for this visual', icon: 'edit', onClick: () => setRename(i) }];
    if (i > 0) items.push({ label: 'Move up', onClick: () => update(l => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; }) });
    if (i < fields.length - 1) items.push({ label: 'Move down', onClick: () => update(l => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; }) });
    if (f.column && (kind === 'value' || kind === 'any')) {
      items.push({ sep: true }, { header: 'Summarization' });
      if (kind === 'any') items.push({ label: 'Don\'t summarize', checked: !f.agg || f.agg === 'None', onClick: () => update(l => { l[i] = { ...l[i], agg: undefined }; }) });
      for (const a of AGGS) if (!a.num || isNumericType(c?.dataType ?? 'text')) items.push({ label: a.label, checked: f.agg === a.key, onClick: () => update(l => { l[i] = { ...l[i], agg: a.key }; }) });
      if (!isNumericType(c?.dataType ?? 'text')) { items.push({ label: 'First', checked: f.agg === 'First', onClick: () => update(l => { l[i] = { ...l[i], agg: 'First' }; }) }, { label: 'Last', checked: f.agg === 'Last', onClick: () => update(l => { l[i] = { ...l[i], agg: 'Last' }; }) }); }
    }
    if (kind === 'group' && c && (c.dataType === 'date' || c.dataType === 'datetime') && !f.datePart) {
      items.push({ sep: true }, { label: 'Date Hierarchy', checked: !(f as any).noHierarchy, onClick: () => update(l => { l[i] = { ...l[i], noHierarchy: false } as any; }) }, { label: f.column!, checked: !!(f as any).noHierarchy, onClick: () => update(l => { l[i] = { ...l[i], noHierarchy: true } as any; }) });
    }
    if (kind === 'group') items.push({ sep: true }, { label: 'Show items with no data', checked: !!f.showItemsNoData, onClick: () => update(l => { l[i] = { ...l[i], showItemsNoData: !l[i].showItemsNoData }; }) });
    if (kind !== 'group' && (f.measure || f.agg)) items.push({ sep: true }, { label: 'New quick measure', icon: 'quickmeasure', onClick: () => s.openDialog({ type: 'quickMeasure', table: f.table, field: f }) });
    menuBelow(el, items);
  };
  return <div className="well">
    <div className="well-h">{label}</div>
    <div className={`well-drop ${over ? 'over' : ''}`}
      onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field') || e.dataTransfer.types.includes('application/x-pill')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        setOver(false); e.preventDefault();
        const pill = e.dataTransfer.getData('application/x-pill');
        if (pill) {
          const { from, index } = JSON.parse(pill);
          const f = v.wells[from][index];
          s.updateVisual(v.id, x => { x.wells[from] = x.wells[from].filter((_y, j) => j !== index); });
          addFieldToVisual(v.id, f, wellKey);
          return;
        }
        const raw = e.dataTransfer.getData('application/x-field'); if (raw) addFieldToVisual(v.id, JSON.parse(raw), wellKey);
      }}>
      {!fields.length && <div className="ph">Add data fields here</div>}
      {fields.map((f, i) => rename === i
        ? <input key={i} className="tx" autoFocus defaultValue={fieldLabel(f)} onBlur={e => { const val = e.target.value.trim(); setRename(null); update(l => { l[i] = { ...l[i], alias: val && val !== fieldLabel({ ...f, alias: undefined }) ? val : undefined }; }); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        : <div key={i} className="pill" draggable onDragStart={e => { e.dataTransfer.setData('application/x-pill', JSON.stringify({ from: wellKey, index: i })); }} title={`${f.table}${f.column ? '[' + f.column + ']' : f.measure ? '[' + f.measure + ']' : ''}`}>
          <span className="nm">{fieldLabel(f)}{f.column && kind === 'group' && !f.datePart && !(f as any).noHierarchy && ['date', 'datetime'].includes(colMeta(m, f)?.dataType ?? '') && s.project.settings.autoDateTime && m.tables.find(t => t.name === f.table)?.dateColumn !== f.column ? ' (Date Hierarchy)' : ''}</span>
          <button className="iconbtn" style={{ height: 18, minWidth: 18 }} onClick={e => pillMenu(e.currentTarget, i)} aria-label="Field options"><I n="chevronDown" s={11} /></button>
          <button className="iconbtn" style={{ height: 18, minWidth: 18 }} onClick={() => update(l => l.splice(i, 1))} aria-label="Remove field"><I n="close" s={11} /></button>
        </div>)}
    </div>
  </div>;
}

function PageBuild() {
  const s = store; const page = s.page();
  const [over, setOver] = useState(false);
  return <div>
    <div className="section-h">Drill through</div>
    <div className="tiny" style={{ marginBottom: 6 }}>Add fields here to make this a drill-through target. Right-click a data point on another page and pick <b>Drill through</b>.</div>
    <div className={`well-drop ${over ? 'over' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('application/x-field')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={e => { setOver(false); const raw = e.dataTransfer.getData('application/x-field'); if (!raw) return; const f = JSON.parse(raw) as FieldRef; if (!f.column) { s.toast('Drill-through fields must be columns.', 'error'); return; }
        s.change(p => { const pg = p.report.pages.find(x => x.id === page.id)!; pg.drillthrough = [...(pg.drillthrough ?? []), { table: f.table, column: f.column }]; if (!pg.visuals.some(v => v.type === 'button' && v.action?.type === 'back')) pg.visuals.push({ id: 'v' + Math.random().toString(36).slice(2), type: 'button', x: 10, y: 10, w: 44, h: 36, wells: {}, filters: [], format: { icon: 'back' }, text: '', action: { type: 'back' } }); }); }}>
      {!page.drillthrough?.length && <div className="ph">Add drill-through fields here</div>}
      {page.drillthrough?.map((f, i) => <div key={i} className="pill"><span className="nm">{f.column}</span><button className="iconbtn" style={{ height: 18 }} onClick={() => s.change(p => { const pg = p.report.pages.find(x => x.id === page.id)!; pg.drillthrough = pg.drillthrough!.filter((_x, j) => j !== i); })}><I n="close" s={11} /></button></div>)}
    </div>
    <div className="frow inline" style={{ marginTop: 10 }}><label>Use as tooltip page</label><Toggle on={!!page.isTooltip} onChange={b => s.change(p => { p.report.pages.find(x => x.id === page.id)!.isTooltip = b; })} /></div>
  </div>;
}

function F({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return <div className={`frow ${inline ? 'inline' : ''}`}><label>{label}</label>{children}</div>;
}

function FormatPane({ v }: { v: Visual }) {
  const s = store; const m = s.project.model;
  const f = v.format ?? {};
  const set = (patch: Record<string, any>) => s.updateVisual(v.id, x => { x.format = { ...(x.format ?? {}), ...patch }; });
  const tog = (k: string, dflt: boolean) => <Toggle on={f[k] ?? dflt} onChange={b => set({ [k]: b })} label={k} />;
  const def = vdef(v.type);
  const valueFields = (v.wells.values ?? v.wells.columns?.filter(x => isValueField(m, x)) ?? []);
  const chart = def.chart && !['gauge'].includes(v.type);
  return <div>
    <div className="viz-tabs" style={{ marginBottom: 4 }}><button className="active">Visual</button></div>
    {chart && <>
      <Collapsible title="Legend" open right={tog('legend', true)}><F label="Show legend" inline>{tog('legend', true)}</F></Collapsible>
      {!['pie', 'donut', 'treemap', 'funnel', 'scatter'].includes(v.type) && <>
        <Collapsible title="X-axis" right={tog('xTitle', true)}><F label="Title" inline>{tog('xTitle', true)}</F><F label="Rotate long labels" inline>{tog('rotateLabels', true)}</F></Collapsible>
        <Collapsible title="Y-axis" right={tog('yTitle', true)}><F label="Title" inline>{tog('yTitle', true)}</F></Collapsible>
        <Collapsible title="Gridlines" right={tog('gridlines', true)}><F label="Horizontal" inline>{tog('gridlines', true)}</F></Collapsible>
      </>}
      <Collapsible title="Columns / colors" open>
        <F label="Default color"><input type="color" className="color-swatch" value={f.defaultColor ?? THEMES[s.project.report.theme]?.colors[0] ?? '#118dff'} onChange={e => set({ defaultColor: e.target.value })} /></F>
        {f.defaultColor && <button className="btn sm" onClick={() => set({ defaultColor: undefined, colors: undefined })}>Reset to default</button>}
      </Collapsible>
      {(v.type === 'line' || v.type.startsWith('line')) && <Collapsible title="Markers" right={tog('markers', false)}><F label="Show markers" inline>{tog('markers', false)}</F><F label="Stroke width"><input className="tx" type="number" min={1} max={8} value={f.strokeWidth ?? 2} onChange={e => set({ strokeWidth: +e.target.value })} /></F></Collapsible>}
      <Collapsible title="Data labels" right={tog('dataLabels', ['pie', 'donut', 'treemap', 'funnel'].includes(v.type))}><F label="Show data labels" inline>{tog('dataLabels', ['pie', 'donut', 'treemap', 'funnel'].includes(v.type))}</F></Collapsible>
    </>}
    {(v.type === 'card' || v.type === 'cardNew' || v.type === 'kpi') && <Collapsible title="Callout value" open>
      <F label="Display units"><select className="tx" value={f.displayUnits ?? 'auto'} onChange={e => set({ displayUnits: e.target.value })}><option value="auto">Auto</option><option value="none">None</option></select></F>
      <F label="Value decimal places"><input className="tx" type="number" min={0} max={6} value={f.decimals ?? 2} onChange={e => set({ decimals: +e.target.value })} /></F>
      <F label="Font size"><input className="tx" type="number" min={8} max={96} value={f.calloutSize ?? ''} placeholder="Auto" onChange={e => set({ calloutSize: e.target.value ? +e.target.value : undefined })} /></F>
      <F label="Color"><input type="color" className="color-swatch" value={f.calloutColor ?? '#252423'} onChange={e => set({ calloutColor: e.target.value })} /></F>
      {v.type === 'card' && <F label="Category label" inline>{tog('categoryLabel', true)}</F>}
    </Collapsible>}
    {(v.type === 'table' || v.type === 'matrix') && <>
      <Collapsible title="Values" open><F label="Font size"><input className="tx" type="number" min={8} max={30} value={f.fontSize ?? 12} onChange={e => set({ fontSize: +e.target.value })} /></F></Collapsible>
      {v.type === 'table' && <Collapsible title="Totals" right={tog('totals', true)}><F label="Show totals" inline>{tog('totals', true)}</F></Collapsible>}
      {v.type === 'matrix' && <Collapsible title="Row subtotals / layout" open>
        <F label="Row subtotals (grand total)" inline>{tog('rowSubtotals', true)}</F>
        <F label="Column subtotals" inline>{tog('colSubtotals', true)}</F>
        <F label="Stepped layout" inline>{tog('stepped', true)}</F>
        <F label="+/- icons" inline>{tog('plusMinus', true)}</F>
      </Collapsible>}
      <Collapsible title="Cell elements (conditional formatting)" open>
        {!valueFields.length && <div className="tiny">Add numeric values to format them.</div>}
        {valueFields.map(vf => {
          const k = fieldKey(vf); const cf = f.cf?.[k] ?? {};
          const setCf = (patch: any) => set({ cf: { ...(f.cf ?? {}), [k]: { ...cf, ...patch } } });
          return <div key={k} style={{ borderTop: '1px solid #f3f2f1', paddingTop: 6 }}>
            <b>{fieldLabel(vf)}</b>
            <F label="Background color (gradient)" inline><Toggle on={!!cf.background} onChange={b => setCf({ background: b ? { min: '#ffffff', max: '#118dff' } : undefined })} /></F>
            {cf.background && <div className="row"><span className="tiny">Lowest</span><input type="color" className="color-swatch" value={cf.background.min} onChange={e => setCf({ background: { ...cf.background, min: e.target.value } })} /><span className="tiny">Highest</span><input type="color" className="color-swatch" value={cf.background.max} onChange={e => setCf({ background: { ...cf.background, max: e.target.value } })} /></div>}
            <F label="Data bars" inline><Toggle on={!!cf.dataBars} onChange={b => setCf({ dataBars: b ? { color: '#9ecbff' } : undefined })} /></F>
            <F label="Font color (rules)" inline><Toggle on={!!cf.fontRules?.length} onChange={b => setCf({ fontRules: b ? [{ op: 'lt', value: 0, color: '#a4262c' }] : undefined })} /></F>
            {cf.fontRules?.map((r: any, ri: number) => <div key={ri} className="row" style={{ gap: 4 }}>
              <span className="tiny">If value</span>
              <select className="tx" style={{ width: 54 }} value={r.op} onChange={e => { const fr = [...cf.fontRules]; fr[ri] = { ...r, op: e.target.value }; setCf({ fontRules: fr }); }}><option value="lt">&lt;</option><option value="lte">≤</option><option value="gt">&gt;</option><option value="gte">≥</option></select>
              <input className="tx" style={{ width: 70 }} type="number" value={r.value} onChange={e => { const fr = [...cf.fontRules]; fr[ri] = { ...r, value: +e.target.value }; setCf({ fontRules: fr }); }} />
              <input type="color" className="color-swatch" value={r.color} onChange={e => { const fr = [...cf.fontRules]; fr[ri] = { ...r, color: e.target.value }; setCf({ fontRules: fr }); }} />
            </div>)}
          </div>;
        })}
      </Collapsible>
    </>}
    {v.type === 'slicer' && <Collapsible title="Slicer settings" open>
      <F label="Style"><select className="tx" value={f.slicerStyle ?? ''} onChange={e => set({ slicerStyle: e.target.value || undefined })}><option value="">Default</option><option value="list">Vertical list</option><option value="tile">Tile</option><option value="dropdown">Dropdown</option><option value="between">Between</option></select></F>
      <F label="Single select" inline>{tog('singleSelect', false)}</F>
      <F label="Multi-select with Ctrl" inline>{tog('ctrlMulti', false)}</F>
      <F label="Show &quot;Select all&quot; option" inline>{tog('selectAll', false)}</F>
      <F label="Search" inline>{tog('search', false)}</F>
      <F label="Slicer header" inline>{tog('header', true)}</F>
      <F label="Sync this slicer to other pages" inline><Toggle on={!!f.sync} onChange={b => { set({ sync: b }); if (b) s.toast('Sync slicers: use View › Sync slicers to choose pages. (The sandbox applies a slicer on its own page.)'); }} /></F>
    </Collapsible>}
    {v.type === 'textbox' && <Collapsible title="Text" open>
      <F label="Font size"><input className="tx" type="number" min={8} max={72} value={f.fontSize ?? 14} onChange={e => set({ fontSize: +e.target.value })} /></F>
      <F label="Bold" inline>{tog('bold', false)}</F><F label="Italic" inline>{tog('italic', false)}</F>
      <F label="Font color"><input type="color" className="color-swatch" value={f.fontColor ?? '#252423'} onChange={e => set({ fontColor: e.target.value })} /></F>
      <F label="Alignment"><select className="tx" value={f.align ?? 'left'} onChange={e => set({ align: e.target.value })}><option>left</option><option>center</option><option>right</option></select></F>
    </Collapsible>}
    {v.type === 'button' && <Collapsible title="Button" open>
      <F label="Text"><input className="tx" value={v.text ?? ''} onChange={e => s.updateVisual(v.id, x => { x.text = e.target.value; })} /></F>
      <F label="Icon"><select className="tx" value={f.icon ?? 'blank'} onChange={e => set({ icon: e.target.value })}><option value="blank">Blank</option><option value="back">Back</option><option value="next">Right arrow</option><option value="info">Information</option></select></F>
      <F label="Fill"><input type="color" className="color-swatch" value={f.fill ?? '#ffffff'} onChange={e => set({ fill: e.target.value })} /></F>
      <F label="Action type"><select className="tx" value={v.action?.type ?? ''} onChange={e => s.updateVisual(v.id, x => { x.action = e.target.value ? { type: e.target.value as any } : undefined; })}><option value="">None</option><option value="back">Back</option><option value="bookmark">Bookmark</option><option value="page">Page navigation</option></select></F>
      {v.action?.type === 'bookmark' && <F label="Bookmark"><select className="tx" value={v.action.target ?? ''} onChange={e => s.updateVisual(v.id, x => { x.action = { type: 'bookmark', target: e.target.value }; })}><option value="">Choose…</option>{s.project.report.bookmarks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></F>}
      {v.action?.type === 'page' && <F label="Destination"><select className="tx" value={v.action.target ?? ''} onChange={e => s.updateVisual(v.id, x => { x.action = { type: 'page', target: e.target.value }; })}><option value="">Choose…</option>{s.project.report.pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></F>}
      <div className="tiny">In Desktop, hold Ctrl and click a button to run its action.</div>
    </Collapsible>}
    {v.type === 'shape' && <Collapsible title="Shape" open>
      <F label="Shape"><select className="tx" value={f.shape ?? 'rectangle'} onChange={e => set({ shape: e.target.value })}><option value="rectangle">Rectangle</option><option value="rounded">Rounded rectangle</option><option value="oval">Oval</option></select></F>
      <F label="Fill"><input type="color" className="color-swatch" value={f.fill ?? '#c7e0f4'} onChange={e => set({ fill: e.target.value })} /></F>
      <F label="Border color"><input type="color" className="color-swatch" value={f.borderColor ?? '#118dff'} onChange={e => set({ borderColor: e.target.value })} /></F>
    </Collapsible>}
    {v.type === 'image' && <Collapsible title="Image" open>
      <button className="btn sm" onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const file = inp.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = () => set({ src: r.result }); r.readAsDataURL(file); }; inp.click(); }}>Browse…</button>
      <F label="Alt text"><input className="tx" value={f.alt ?? ''} onChange={e => set({ alt: e.target.value })} /></F>
      <F label="Scaling"><select className="tx" value={f.fit ?? 'contain'} onChange={e => set({ fit: e.target.value })}><option value="contain">Fit</option><option value="cover">Fill</option><option value="none">Normal</option></select></F>
    </Collapsible>}
    <div className="viz-tabs" style={{ margin: '12px 0 4px' }}><button className="active">General</button></div>
    <Collapsible title="Title" open right={<Toggle on={f.titleOn ?? !['textbox', 'button', 'shape', 'image', 'slicer', 'card', 'cardNew'].includes(v.type)} onChange={b => set({ titleOn: b })} />}>
      <F label="Text"><input className="tx" value={f.title ?? ''} placeholder="Automatic" onChange={e => set({ title: e.target.value || undefined })} /></F>
      <F label="Font size"><input className="tx" type="number" min={8} max={40} value={f.titleSize ?? 14} onChange={e => set({ titleSize: +e.target.value })} /></F>
      <F label="Bold" inline>{tog('titleBold', false)}</F>
      <F label="Horizontal alignment"><select className="tx" value={f.titleAlign ?? 'left'} onChange={e => set({ titleAlign: e.target.value })}><option>left</option><option>center</option><option>right</option></select></F>
    </Collapsible>
    <Collapsible title="Effects">
      <F label="Background" inline>{tog('background', true)}</F>
      <F label="Background color"><input type="color" className="color-swatch" value={f.bgColor ?? '#ffffff'} onChange={e => set({ bgColor: e.target.value })} /></F>
      <F label="Visual border" inline>{tog('border', false)}</F>
      <F label="Rounded corners (px)"><input className="tx" type="number" min={0} max={30} value={f.radius ?? 0} onChange={e => set({ radius: +e.target.value })} /></F>
      <F label="Shadow" inline>{tog('shadow', false)}</F>
    </Collapsible>
    <Collapsible title="Properties">
      <F label="Alt text"><textarea className="tx" rows={2} value={f.altText ?? ''} onChange={e => set({ altText: e.target.value })} placeholder="Describe the visual for screen reader users" /></F>
      <div className="row"><F label="X"><input className="tx" type="number" value={v.x} onChange={e => s.updateVisual(v.id, x => { x.x = +e.target.value; })} /></F><F label="Y"><input className="tx" type="number" value={v.y} onChange={e => s.updateVisual(v.id, x => { x.y = +e.target.value; })} /></F></div>
      <div className="row"><F label="Width"><input className="tx" type="number" value={v.w} onChange={e => s.updateVisual(v.id, x => { x.w = +e.target.value; })} /></F><F label="Height"><input className="tx" type="number" value={v.h} onChange={e => s.updateVisual(v.id, x => { x.h = +e.target.value; })} /></F></div>
      {v.type === 'table' && <F label="Show only top N rows"><input className="tx" type="number" min={0} value={f.topN ?? ''} onChange={e => set({ topN: e.target.value ? +e.target.value : undefined })} /></F>}
    </Collapsible>
  </div>;
}

function PageFormat() {
  const s = store; const page = s.page();
  return <div>
    <Collapsible title="Canvas background" open>
      <F label="Color"><input type="color" className="color-swatch" value={page.background ?? '#ffffff'} onChange={e => s.change(p => { p.report.pages.find(x => x.id === page.id)!.background = e.target.value; })} /></F>
    </Collapsible>
    <Collapsible title="Page information" open>
      <F label="Name"><input className="tx" value={page.name} onChange={e => s.change(p => { p.report.pages.find(x => x.id === page.id)!.name = e.target.value; }, { noUndo: true })} /></F>
    </Collapsible>
    <Collapsible title="Theme" open>
      <select className="tx" value={s.project.report.theme} onChange={e => s.change(p => { p.report.theme = e.target.value; })}>{Object.keys(THEMES).map(t => <option key={t}>{t}</option>)}</select>
    </Collapsible>
  </div>;
}

function Analytics({ v }: { v: Visual }) {
  const s = store;
  const a = v.format?.analytics ?? {};
  const set = (patch: any) => s.updateVisual(v.id, x => { x.format = { ...(x.format ?? {}), analytics: { ...(x.format?.analytics ?? {}), ...patch } }; });
  const ok = ['line', 'area', 'clusteredColumn', 'clusteredBar', 'stackedColumn', 'stackedBar', 'lineClusteredColumn', 'scatter'].includes(v.type);
  if (!ok) return <div className="tiny" style={{ padding: 8 }}>Analytics lines are available for line, area, column and bar charts.</div>;
  return <div>
    <Collapsible title="Constant line" open right={<Toggle on={!!a.constant?.on} onChange={b => set({ constant: { ...(a.constant ?? {}), on: b } })} />}>
      <F label="Value"><input className="tx" type="number" value={a.constant?.value ?? 0} onChange={e => set({ constant: { ...(a.constant ?? {}), on: true, value: +e.target.value } })} /></F>
      <F label="Label"><input className="tx" value={a.constant?.label ?? ''} onChange={e => set({ constant: { ...(a.constant ?? {}), label: e.target.value } })} /></F>
    </Collapsible>
    {(['average', 'min', 'max', 'median'] as const).map(k => <Collapsible key={k} title={`${k[0].toUpperCase() + k.slice(1)} line`} right={<Toggle on={!!a[k]} onChange={b => set({ [k]: b })} />}><F label="Show" inline><Toggle on={!!a[k]} onChange={b => set({ [k]: b })} /></F></Collapsible>)}
    {(v.type === 'line' || v.type === 'area' || v.type === 'scatter') && <Collapsible title="Trend line" right={<Toggle on={!!a.trend} onChange={b => set({ trend: b })} />}><F label="Show" inline><Toggle on={!!a.trend} onChange={b => set({ trend: b })} /></F></Collapsible>}
  </div>;
}

export function VizPane({ width = 250 }: { width?: number }) {
  const s = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const v = s.selectedVisual();
  if (collapsed) return <div className="pane collapsed" style={{ width: 32 }}><div className="pane-vert" onClick={() => setCollapsed(false)}><I n="chevronLeft" s={12} />Visualizations</div></div>;
  const tab = s.ui.vizTab;
  const gallery = VISUALS.filter(x => x.group !== 'element');
  return <div className="pane" style={{ width }}>
    <div className="pane-h"><span>Visualizations</span><button className="iconbtn" title="Collapse" onClick={() => setCollapsed(true)}><I n="chevronRight" s={12} /></button></div>
    <div className="pane-body">
      <div className="viz-tabs">
        <button className={tab === 'build' ? 'active' : ''} onClick={() => s.setUI({ vizTab: 'build' })} title="Build visual"><I n="build" s={16} /></button>
        <button className={tab === 'format' ? 'active' : ''} onClick={() => s.setUI({ vizTab: 'format' })} title={v ? 'Format visual' : 'Format page'}><I n="format" s={16} /></button>
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => s.setUI({ vizTab: 'analytics' })} title="Add further analyses to your visual" disabled={!v}><I n="analytics" s={16} /></button>
      </div>
      {tab === 'build' && <>
        <div className="viz-gallery">
          {gallery.map(d => <button key={d.type} title={d.name} className={v?.type === d.type ? 'active' : ''} onClick={() => (v && !['textbox', 'button', 'shape', 'image'].includes(v.type) ? changeVisualType(v.id, d.type) : addVisual(d.type))}><I n={'v_' + d.type} s={20} /></button>)}
        </div>
        {v ? <div>{vdef(v.type).wells.map(w => <Well key={w.key} v={v} wellKey={w.key} label={w.label} kind={w.kind} />)}
          {!vdef(v.type).wells.length && <div className="tiny">This element has no field wells. Use the Format tab.</div>}
        </div> : <PageBuild />}
      </>}
      {tab === 'format' && (v ? <FormatPane v={v} /> : <PageFormat />)}
      {tab === 'analytics' && v && <Analytics v={v} />}
    </div>
  </div>;
}

export { isNumericType };
