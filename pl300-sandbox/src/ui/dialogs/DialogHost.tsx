// Renders the dialog stack, plus the smaller dialogs.
import React, { useMemo, useState } from 'react';
import { exportRows } from '../report/Canvas';
import { download as downloadFile } from '../common';
import { useStore, store, uid, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { I } from '../icons';
import { GetDataDialog, EnterDataDialog, SampleDataDialog } from './GetData';
import { RelationshipsDialog, EditRelationshipDialog, RolesDialog, ViewAsDialog, MarkDateDialog, QuickMeasureDialog, WhatIfDialog, GroupsDialog } from './ModelDialogs';
import { PQ_DIALOGS } from '../pq/PQDialogs';
import { SOURCE_DIALOGS } from './SourceDialogs';
import { SERVICE_DIALOGS } from '../../service/Dialogs';
import { ANALYZE_DIALOGS } from '../report/analyze';
import { VisualCalcEditor } from '../report/VisualCalcEditor';
import { summarize, visualContext, fmt, formatFor, isValueField, drillLevels } from '../../report/query';
import { openProjectFile } from '../../io/project';
import { openPowerQuery, refreshAll } from '../actions';
import { paramInfo } from '../../m/engine';
import { findFile } from '../../m/sources';

const close = () => store.closeDialog();

function Message({ d }: { d: DialogT }) {
  return <Dialog title={d.title} width={520} footer={<button className="btn primary" onClick={close}>OK</button>}><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{d.text}</div></Dialog>;
}
function Confirm({ d }: { d: DialogT }) {
  return <Dialog title={d.title} width={460} footer={<><button className="btn primary" onClick={() => { close(); d.onOk(); }}>{d.ok ?? 'OK'}</button><button className="btn" onClick={close}>Cancel</button></>}><div>{d.text}</div></Dialog>;
}
function LoadErrors({ d }: { d: DialogT }) {
  return <Dialog title="Load" sub="Some tables couldn't be loaded or calculated" width={640} footer={<><button className="btn" onClick={() => { close(); openPowerQuery(d.errors[0]?.table); }}>Open Power Query</button><button className="btn primary" onClick={close}>Close</button></>}>
    {d.errors.map((e: any, i: number) => <div key={i} className="errbox"><b>{e.table}</b>{'\n'}{e.message}
      {/data privacy/.test(e.message) && <div style={{ marginTop: 6 }}><button className="btn sm" onClick={() => { close(); store.openDialog({ type: 'privacyLevels' }); }}>Continue (set privacy levels)</button></div>}
      {/Formula\.Firewall/.test(e.message) && <div style={{ marginTop: 6 }}><button className="btn sm" onClick={() => { close(); store.openDialog({ type: 'dataSources' }); }}>Data source settings</button></div>}
      {/Credentials are required/.test(e.message) && <div style={{ marginTop: 6 }}><button className="btn sm" onClick={() => { close(); store.openDialog({ type: 'dataSources' }); }}>Edit credentials</button></div>}</div>)}
    <div className="tiny">Missing files? Upload them with Get data (matching by file name), or use Data source settings to see which files each query needs.</div>
  </Dialog>;
}

function Welcome() {
  const s = store;
  return <Dialog title="Welcome to the PL-300 Sandbox" sub="Power BI Desktop, in your browser, for practising the Data Analyst exam" width={720} footer={<button className="btn" onClick={close}>Start with a blank report</button>}>
    <div className="bs-list">
      <button className="bs-item" onClick={() => { close(); s.setUI({ showTutorials: true }); }}><I n="grad" s={30} /><div><b>Open the PL-300 tutorials</b><span className="subtle">Exam-focused walkthroughs: merge join kinds, append, unpivot, star schemas, cardinality, cross-filter direction, CALCULATE, time intelligence, RLS and more. Each loads its own sample data.</span></div></button>
      <button className="bs-item" onClick={() => { close(); s.openDialog({ type: 'sampleData' }); }}><I n="sample" s={30} /><div><b>Explore sample data</b><span className="subtle">Contoso retail files in CSV, Excel, JSON, XML, TXT and a folder to combine, or a ready-made star schema.</span></div></button>
      <button className="bs-item" onClick={() => { close(); s.openDialog({ type: 'getData' }); }}><I n="getdata" s={30} /><div><b>Get your own data</b><span className="subtle">Excel, CSV/TXT, JSON, XML, Parquet, a folder of files, or a Power BI template (.pbit) via File › Open.</span></div></button>
      <button className="bs-item" onClick={() => { close(); void openProjectFile(); }}><I n="open" s={30} /><div><b>Open a file</b><span className="subtle">.pbisandbox project, .pbit template or model.bim.</span></div></button>
    </div>
    <div className="tiny">The four views on the left are Report, Table, Model and DAX query, the same as Power BI Desktop. Transform data opens the Power Query Editor. Your work saves automatically in this browser.</div>
  </Dialog>;
}

function ExportData({ d }: { d: DialogT }) {
  const s = store;
  const v = s.findVisual(d.visualId)!; const page = s.project.report.pages.find(p => p.id === d.pageId)!;
  const setting = s.project.report.settings?.exportData ?? 'underlying';
  const svc = d.service as { build?: boolean } | undefined;
  const allowUnderlying = setting === 'underlying' && (svc?.build ?? true);
  const [kind, setKind] = useState<'summarized' | 'layout' | 'underlying'>('summarized');
  const data = useMemo(() => { try { return exportRows(v, page, kind); } catch (e) { return { cols: [], rows: [], error: (e as Error).message }; } }, [kind]);
  if (setting === 'none') return <Dialog title="Export data" width={460} footer={<button className="btn primary" onClick={close}>OK</button>}><div className="warnbox">The report author turned off exporting data for this report (File › Options and settings › Options › Report settings › Export data).</div></Dialog>;
  const csv = () => { const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x); return [data.cols.map(esc).join(','), ...data.rows.map(r => r.map(esc).join(','))].join('\r\n'); };
  return <Dialog title="Export data" sub="Which data do you want to export?" width="min(760px, 95vw)" footer={<><button className="btn primary" onClick={() => { downloadFile(`${v.format?.title || v.title || 'data'}.csv`, csv(), 'text/csv'); }}>Export</button><button className="btn" onClick={() => { void navigator.clipboard?.writeText(csv().replace(/,/g, '\t')).then(() => s.toast('Copied to the clipboard; paste into Excel.')).catch(() => s.toast('Clipboard not available', 'error')); }}>Copy</button><button className="btn" onClick={close}>Cancel</button></>}>
    <label className="row"><input type="radio" checked={kind === 'summarized'} onChange={() => setKind('summarized')} /><div><b>Summarized data</b><div className="tiny">The data used for the visual, as aggregated values (.csv or .xlsx). Up to 30,000 rows to .csv, 150,000 to .xlsx.</div></div></label>
    <label className="row"><input type="radio" checked={kind === 'layout'} onChange={() => setKind('layout')} /><div><b>Data with current layout</b><div className="tiny">The data as it looks in the visual, including its layout, exported to .xlsx (in the service).</div></div></label>
    <label className="row" style={{ opacity: allowUnderlying ? 1 : 0.5 }}><input type="radio" disabled={!allowUnderlying} checked={kind === 'underlying'} onChange={() => setKind('underlying')} /><div><b>Underlying data</b><div className="tiny">{allowUnderlying ? 'The detail rows behind the visual, without aggregation.' : setting !== 'underlying' ? 'Turned off: the report allows summarized data only.' : 'Needs Build permission on the semantic model.'}</div></div></label>
    {s.project.report.sensitivity && <div className="info tiny">The sensitivity label <b>{s.project.report.sensitivity}</b> is applied to the exported file.</div>}
    {'error' in data && data.error ? <div className="errbox">{data.error}</div> : <div style={{ overflow: 'auto', maxHeight: 240 }}><table className="grid-table vtable"><thead><tr>{data.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{data.rows.slice(0, 50).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table></div>}
    <div className="tiny">{data.rows.length.toLocaleString()} rows. Export uses the visual's filters; RLS and the export settings apply in the service.</div>
  </Dialog>;
}

function ShowAsTable({ d }: { d: DialogT }) {
  const s = store; const v = s.findVisual(d.visualId)!; const page = s.page(); const m = s.project.model;
  const fields = Object.entries(v.wells).flatMap(([k, fs]) => (k === 'tooltips' ? [] : k === 'axis' || k === 'rows' ? drillLevels(s, v, k).shown : fs));
  const groups = fields.filter(f => !isValueField(m, f)); const vals = fields.filter(f => isValueField(m, f));
  let res; try { res = summarize(s, groups, vals, visualContext(s, page, v)); } catch (e) { res = null; }
  return <Dialog title="Show as a table" width="min(900px, 95vw)" footer={<button className="btn primary" onClick={close}>Close</button>}>
    {res ? <div style={{ overflow: 'auto', maxHeight: '60vh' }}><table className="grid-table vtable"><thead><tr>{res.cols.map((c, i) => <th key={i} className={c.isValue ? 'num' : ''}>{c.label}</th>)}</tr></thead><tbody>{res.rows.slice(0, 2000).map((r, i) => <tr key={i}>{r.map((x, j) => <td key={j} className={res!.cols[j].isValue ? 'num' : ''}>{fmt(x, formatFor(m, res!.cols[j].field), res!.cols[j].field)}</td>)}</tr>)}</tbody></table></div> : <div className="errbox">Couldn't evaluate this visual.</div>}
  </Dialog>;
}

function Publish() {
  return <Dialog title="Publish to Power BI" width={560} footer={<button className="btn primary" onClick={close}>OK</button>}>
    <div className="warnbox">The sandbox has no Power BI service to publish to.</div>
    <div style={{ lineHeight: 1.6 }}>What the exam expects you to know about publishing:
      <ul>
        <li>Publish sends the report and its semantic model to a <b>workspace</b>. My workspace is personal; shared workspaces have roles: Admin, Member, Contributor, Viewer.</li>
        <li>Import models need <b>scheduled refresh</b> (up to 8/day on Pro, 48/day on Premium); on-premises sources need an <b>on-premises data gateway</b>.</li>
        <li>Distribute with an <b>app</b>, share individual items, or embed. Add people to RLS roles in the semantic model's <b>Security</b> settings.</li>
        <li>Endorse content as <b>Promoted</b> or <b>Certified</b>; apply <b>sensitivity labels</b>; dashboards pin tiles from reports and support alerts on cards, KPIs and gauges.</li>
      </ul>
    </div>
  </Dialog>;
}

function About() {
  return <Dialog title="About PL-300 Sandbox" width={520} footer={<button className="btn primary" onClick={close}>OK</button>}>
    <div style={{ lineHeight: 1.6 }}>A browser recreation of Power BI Desktop for practising the PL-300 exam. It includes an M (Power Query) engine with nearly 400 functions, a DAX engine with about 230 functions and real filter-context semantics, and the Report, Table, Model and DAX query views. It's an independent learning tool and isn't affiliated with Microsoft.</div>
  </Dialog>;
}

function Shortcuts() {
  const rows: [string, string][] = [['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+S', 'Save project'], ['Ctrl+C / Ctrl+V', 'Copy / paste visuals'], ['Delete', 'Delete selected visuals'], ['Arrow keys (Shift = 10px)', 'Nudge selected visuals'], ['Ctrl+click', 'Multi-select visuals or data points; run a button'], ['Esc', 'Clear selection'], ['Enter / Shift+Enter', 'Commit DAX formula / new line'], ['Ctrl+Enter or F5', 'Run DAX query'], ['Tab', 'Accept IntelliSense suggestion']];
  return <Dialog title="Keyboard shortcuts" width={520} footer={<button className="btn primary" onClick={close}>Close</button>}>
    <table className="grid-table"><tbody>{rows.map(([k, v]) => <tr key={k}><td><span className="kbd">{k}</span></td><td>{v}</td></tr>)}</tbody></table>
  </Dialog>;
}

function EditParams() {
  const s = store;
  const params = s.project.queries.filter(q => paramInfo(q.code));
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(params.map(q => { const m = /^\s*("(?:[^"]|"")*"|[^\s]+)\s+meta/.exec(q.code); return [q.name, m ? m[1].replace(/^"|"$/g, '').replace(/""/g, '"') : '']; })));
  const ok = () => {
    s.change(p => { for (const q of p.queries) if (vals[q.name] !== undefined) { const pi = paramInfo(q.code)!; const lit = /Number/i.test(pi.type) ? vals[q.name] : `"${vals[q.name].replace(/"/g, '""')}"`; q.code = q.code.replace(/^\s*("(?:[^"]|"")*"|[^\s]+)(\s+meta)/, `${lit}$2`); } });
    close(); refreshAll();
  };
  return <Dialog title="Edit Parameters" width={480} footer={<><button className="btn primary" onClick={ok} disabled={!params.length}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    {!params.length && <div className="subtle">This file has no parameters. Create them in Power Query › Manage Parameters.</div>}
    {params.map(q => <div key={q.name} className="field"><label>{q.name}</label><input className="tx" value={vals[q.name]} onChange={e => setVals({ ...vals, [q.name]: e.target.value })} /></div>)}
  </Dialog>;
}

function FieldParam() {
  const s = store; const m = s.project.model;
  const [name, setName] = useState(() => { let n = 'Parameter', i = 2; while (m.tables.some(t => t.name === n)) n = `Parameter ${i++}`; return n; });
  const [fields, setFields] = useState<{ label: string; ref: string }[]>([]);
  const [slicer, setSlicer] = useState(true);
  const all = [...m.measures.map(x => ({ label: x.name, ref: `'${x.table.replace(/'/g, "''")}'[${x.name}]`, group: x.table, measure: true })), ...m.tables.filter(t => !t.fieldParameter && !t.calculationGroup).flatMap(t => t.columns.filter(c => !c.hidden).map(c => ({ label: c.name, ref: `'${t.name.replace(/'/g, "''")}'[${c.name}]`, group: t.name, measure: false })))];
  const ok = () => {
    const q = /\s/.test(name) ? `'${name}'` : name;
    const expr = `SELECTCOLUMNS({\n${fields.map((f, i) => `    ("${f.label.replace(/"/g, '""')}", NAMEOF(${f.ref}), ${i})`).join(',\n')}\n}, "${name}", [Value1], "${name} Fields", [Value2], "${name} Order", [Value3])`;
    s.change(p => { p.model.tables.push({ name, columns: [], rows: [], expression: expr, fieldParameter: true }); }, { recalc: true });
    s.change(p => { const t = p.model.tables.find(x => x.name === name)!; for (const c of t.columns) { if (c.name.endsWith(' Fields') || c.name.endsWith(' Order')) c.hidden = true; if (c.name === name) c.sortByColumn = `${name} Order`; } }, { noUndo: true });
    if (slicer) { const page = s.page(); s.change(p => { p.report.pages.find(x => x.id === page.id)!.visuals.push({ id: uid('v'), type: 'slicer', x: 20, y: 20, w: 220, h: 200, wells: { field: [{ table: name, column: name }] }, filters: [], format: { singleSelect: false }, slicer: { values: [] } }); }); }
    void q; close();
    s.toast(`Created the field parameter ${name}. Add its ${name} column to a visual's axis or values; the slicer chooses which fields the visual shows.`);
  };
  return <Dialog title="Parameters" sub="Add parameters to visuals and DAX expressions so people can use slicers to adjust the inputs and see different results." width={720} footer={<><button className="btn primary" disabled={!fields.length || !name.trim()} onClick={ok}>Create</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>What will your variable adjust?</label><select className="tx" value="fields" onChange={e => { if (e.target.value === 'numeric') { close(); s.openDialog({ type: 'whatIf' }); } }}><option value="fields">Fields</option><option value="numeric">Numeric range</option></select></div>
    <div className="field"><label>Name</label><input className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
    <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap', gap: 12 }}>
      <div style={{ flex: 1 }}><div className="section-h" style={{ marginTop: 0 }}>Fields (in order)</div>
        <div className="list" style={{ minHeight: 160, maxHeight: 260 }}>{fields.map((f, i) => <div key={f.ref} className="it"><span style={{ flex: 1 }}>{f.label}</span>
          <button className="iconbtn" disabled={i === 0} onClick={() => { const n = [...fields]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setFields(n); }} aria-label="Move up">↑</button>
          <button className="iconbtn" onClick={() => setFields(fields.filter(x => x !== f))} aria-label="Remove"><I n="close" s={11} /></button></div>)}
          {!fields.length && <div className="subtle" style={{ padding: 8 }}>Pick measures or columns on the right.</div>}</div></div>
      <div style={{ width: 280 }}><div className="section-h" style={{ marginTop: 0 }}>Add fields</div>
        <div className="list" style={{ maxHeight: 260 }}>{all.filter(x => !fields.some(f => f.ref === x.ref)).map(x => <div key={x.ref} className="it" onClick={() => setFields([...fields, { label: x.label, ref: x.ref }])}><I n={x.measure ? 'fieldCalc' : 'fieldText'} s={14} /><span style={{ flex: 1 }}>{x.label}</span><span className="tiny">{x.group}</span></div>)}</div></div>
    </div>
    <label className="row"><input type="checkbox" checked={slicer} onChange={e => setSlicer(e.target.checked)} />Add slicer to this page</label>
    <div className="tiny">Power BI builds a calculated table of NAMEOF() references. Use its column in a visual's axis or values; selecting items in the slicer swaps the fields the visual shows.</div>
  </Dialog>;
}

function Options() {
  const s = store;
  return <Dialog title="Options" width={560} footer={<button className="btn primary" onClick={close}>OK</button>}>
    <label className="row"><input type="checkbox" checked={s.project.settings.autoDateTime} onChange={e => s.change(p => { p.settings.autoDateTime = e.target.checked; })} />Auto date/time for new files</label>
    <label className="row"><input type="checkbox" checked={s.project.settings.autodetectRelationships} onChange={e => s.change(p => { p.settings.autodetectRelationships = e.target.checked; })} />Autodetect new relationships after data is loaded</label>
    <div className="section-h">Report settings (current file)</div>
    <label className="row"><input type="checkbox" checked={!!s.project.report.settings?.personalize} onChange={e => s.change(p => { p.report.settings = { ...(p.report.settings ?? {}), personalize: e.target.checked }; })} />Personalize visuals: allow report readers to change visuals (type, fields, summarization) in the service</label>
    <div className="field"><label>Export data</label><select className="tx" value={s.project.report.settings?.exportData ?? 'underlying'} onChange={e => s.change(p => { p.report.settings = { ...(p.report.settings ?? {}), exportData: e.target.value as any }; })}>
      <option value="underlying">Allow end users to export summarized and underlying data from the service</option>
      <option value="summarized">Allow end users to export summarized data from the service</option>
      <option value="none">Don't allow end users to export any data from the service</option></select></div>
    <label className="row"><input type="checkbox" checked={!!s.project.report.settings?.persistentFilters} onChange={e => s.change(p => { p.report.settings = { ...(p.report.settings ?? {}), persistentFilters: e.target.checked }; })} />Don't allow end users to save filters on this file in the service (persistent filters off)</label>
    <div className="section-h">Privacy (current file)</div>
    <label className="row"><input type="radio" checked={!s.project.settings.ignorePrivacy} onChange={() => s.change(p => { p.settings.ignorePrivacy = false; })} />Combine data according to your Privacy Level settings for each source</label>
    <label className="row"><input type="radio" checked={!!s.project.settings.ignorePrivacy} onChange={() => s.change(p => { p.settings.ignorePrivacy = true; })} />Ignore the Privacy levels and potentially improve performance</label>
    <div className="tiny">Ignoring privacy levels can expose sensitive or confidential data to an unauthorized person, because Power Query may send data from one source to another when it folds a combination.</div>
  </Dialog>;
}

const DIALOGS: Record<string, (p: { d: DialogT }) => React.ReactElement | null> = {
  message: Message, confirm: Confirm, loadErrors: LoadErrors, welcome: Welcome, getData: GetDataDialog, enterData: EnterDataDialog, sampleData: SampleDataDialog,
  relationships: RelationshipsDialog, editRelationship: EditRelationshipDialog, roles: RolesDialog, viewAs: ViewAsDialog, markDate: MarkDateDialog, quickMeasure: QuickMeasureDialog,
  whatIf: WhatIfDialog, groups: GroupsDialog, showAsTable: ShowAsTable, about: About, shortcuts: Shortcuts, editParams: EditParams, fieldParam: FieldParam, options: Options,
  ...PQ_DIALOGS, ...SOURCE_DIALOGS, ...ANALYZE_DIALOGS, ...SERVICE_DIALOGS, visualCalc: VisualCalcEditor, exportData: ExportData,
};

export function DialogHost() {
  const s = useStore();
  return <>{s.ui.dialogs.map((d, i) => { const C = DIALOGS[d.type]; return C ? <C key={i + d.type} d={d} /> : null; })}</>;
}
