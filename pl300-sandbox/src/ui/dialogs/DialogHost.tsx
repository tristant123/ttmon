// Renders the dialog stack, plus the smaller dialogs.
import React, { useState } from 'react';
import { useStore, store, Dialog as DialogT } from '../../store';
import { Dialog } from '../common';
import { I } from '../icons';
import { GetDataDialog, EnterDataDialog, SampleDataDialog } from './GetData';
import { RelationshipsDialog, EditRelationshipDialog, RolesDialog, ViewAsDialog, MarkDateDialog, QuickMeasureDialog, WhatIfDialog, GroupsDialog } from './ModelDialogs';
import { PQ_DIALOGS } from '../pq/PQDialogs';
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
    {d.errors.map((e: any, i: number) => <div key={i} className="errbox"><b>{e.table}</b>{'\n'}{e.message}</div>)}
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

function DataSources() {
  const s = store;
  const queries = s.ui.pq ? s.ui.pq.queries : s.project.queries;
  const srcs = queries.flatMap(q => [...q.code.matchAll(/(File\.Contents|Folder\.Files|Folder\.Contents|Sql\.Database|Web\.Contents)\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g)].map(m => ({ q: q.name, fn: m[1], path: m[2], db: m[3] })));
  return <Dialog title="Data source settings" sub="Manage settings for data sources used in this file" width="min(760px, 95vw)" footer={<button className="btn primary" onClick={close}>Close</button>}>
    <table className="grid-table vtable"><thead><tr><th>Source</th><th>Used by</th><th>Status</th></tr></thead><tbody>
      {srcs.map((x, i) => { const ok = x.fn === 'File.Contents' ? !!findFile(x.path) : x.fn === 'Sql.Database' ? /localhost/i.test(x.path) : x.fn.startsWith('Folder') ? s.files.some(f => f.folder.toLowerCase().startsWith(x.path.toLowerCase().replace(/\\$/, ''))) : false;
        return <tr key={i}><td>{x.fn === 'Sql.Database' ? `${x.path};${x.db}` : x.path}</td><td>{x.q}</td><td style={{ color: ok ? '#107c10' : '#a4262c' }}>{ok ? 'Available' : 'Not found — upload it via Get data'}</td></tr>; })}
      {!srcs.length && <tr><td colSpan={3} className="subtle">No file or database sources yet.</td></tr>}
    </tbody></table>
    <div className="section-h">Files stored in the sandbox</div>
    <div className="list" style={{ maxHeight: 200 }}>{s.files.map(f => <div key={f.folder + f.name} className="it"><span style={{ flex: 1 }}>{f.folder}\{f.name}</span><span className="tiny">{(f.bytes.length / 1024).toFixed(1)} KB</span><button className="btn sm" onClick={() => { s.files = s.files.filter(x => x !== f); void s.persistFiles(); s.emit(); }}>Remove</button></div>)}</div>
    <div className="tiny">Change source: edit the path in the query's Source step (Power Query › Advanced Editor), or use a text parameter for the folder path, which is a common exam scenario.</div>
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
  return <Dialog title="Field parameters" width={520} footer={<button className="btn primary" onClick={close}>OK</button>}>
    <div>Field parameters let report readers swap the measure or column a visual uses. Power BI builds them as a calculated table of <code>NAMEOF()</code> references with special visual support, which the sandbox doesn't emulate.</div>
    <div className="tip"><b>Exam tip</b>To let users switch between measures in the sandbox, combine a disconnected table of measure names, a slicer on it, and a SWITCH(SELECTEDVALUE(…)) measure. The "Dynamic measure with SWITCH" tutorial walks through it.</div>
  </Dialog>;
}

function Options() {
  const s = store;
  return <Dialog title="Options" width={560} footer={<button className="btn primary" onClick={close}>OK</button>}>
    <label className="row"><input type="checkbox" checked={s.project.settings.autoDateTime} onChange={e => s.change(p => { p.settings.autoDateTime = e.target.checked; })} />Auto date/time for new files</label>
    <label className="row"><input type="checkbox" checked={s.project.settings.autodetectRelationships} onChange={e => s.change(p => { p.settings.autodetectRelationships = e.target.checked; })} />Autodetect new relationships after data is loaded</label>
  </Dialog>;
}

const DIALOGS: Record<string, (p: { d: DialogT }) => React.ReactElement | null> = {
  message: Message, confirm: Confirm, loadErrors: LoadErrors, welcome: Welcome, getData: GetDataDialog, enterData: EnterDataDialog, sampleData: SampleDataDialog,
  relationships: RelationshipsDialog, editRelationship: EditRelationshipDialog, roles: RolesDialog, viewAs: ViewAsDialog, markDate: MarkDateDialog, quickMeasure: QuickMeasureDialog,
  whatIf: WhatIfDialog, groups: GroupsDialog, showAsTable: ShowAsTable, publish: Publish, about: About, shortcuts: Shortcuts, dataSources: DataSources, editParams: EditParams, fieldParam: FieldParam, options: Options,
  ...PQ_DIALOGS,
};

export function DialogHost() {
  const s = useStore();
  return <>{s.ui.dialogs.map((d, i) => { const C = DIALOGS[d.type]; return C ? <C key={i + d.type} d={d} /> : null; })}</>;
}
