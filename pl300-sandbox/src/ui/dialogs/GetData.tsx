// Get data: connector gallery, file upload, Navigator, CSV preview, SQL Server, Folder combine, Enter data.
import React, { useMemo, useState } from 'react';
import { store, Dialog as DialogT } from '../../store';
import { Dialog, pickFiles } from '../common';
import { I } from '../icons';
import { StoredFile, ROOT_FOLDER, parseDelimited, sniffDelimiter, readWorkbook } from '../../m/sources';
import { csvQuery, excelQueries, jsonQuery, xmlQueries, parquetQuery, sqlQueries, folderCombine, enterDataQuery, blankQuery, uniqueName, ext, fullPath } from '../../io/getdata';
import { MEngine } from '../../m/engine';
import { MTable, displayValue } from '../../core/values';
import * as XLSX from 'xlsx';
import { addQuery as pqAdd } from '../pq/ops';
import { openPowerQuery } from '../actions';
import { clearQueryCache } from '../report/vhelpers';
import { contosoDW, LAKEHOUSE_SERVER, LAKEHOUSE_DB } from '../../data/sample';

const close = () => store.closeDialog();
function AutoRun({ run }: { run: () => void }) { React.useEffect(() => { run(); }, []); return null; }
type Q = { name: string; code: string; group?: string; load?: boolean; storageMode?: 'Import' | 'DirectQuery' | 'DirectLake' };

/** Add generated queries, then Load (refresh model) or Transform Data (open Power Query). */
export function finishQueries(qs: Q[], mode: 'load' | 'transform', fromPQ: boolean) {
  const s = store;
  if (fromPQ && s.ui.pq) { let last = ''; for (const q of qs) last = pqAdd(q, true); store.setUI({ pq: { ...store.ui.pq!, selected: last } }); return; }
  const taken = s.project.queries.map(q => q.name);
  const named = qs.map(q => ({ ...q, name: taken.includes(q.name) ? uniqueName(q.name, [...taken, ...qs.map(x => x.name)]) : q.name }));
  s.change(p => { for (const q of named) p.queries.push({ id: 'q' + Math.random().toString(36).slice(2, 9), name: q.name, code: q.code, load: q.load ?? true, refresh: true, group: q.group, storageMode: q.storageMode }); });
  if (mode === 'transform') { openPowerQuery(named[named.length - 1].name); return; }
  const res = s.refresh();
  clearQueryCache();
  if (res.errors.length) s.openDialog({ type: 'loadErrors', errors: res.errors });
  else s.toast(`Loaded ${res.loaded.length} table${res.loaded.length === 1 ? '' : 's'}${s.project.model.relationships.length ? ' · relationships were autodetected (see Model view)' : ''}`);
}

export async function filesFromInput(files: File[], folder = ROOT_FOLDER): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const f of files) {
    const rel = (f as any).webkitRelativePath as string | undefined;
    const dir = rel && rel.includes('/') ? `${folder}\\${rel.split('/').slice(0, -1).join('\\')}` : folder;
    out.push({ name: f.name, folder: dir, bytes: new Uint8Array(await f.arrayBuffer()), modified: f.lastModified });
  }
  return out;
}

const CONNECTORS: { kind: string; name: string; icon: string; cat: string; accept?: string; desc: string }[] = [
  { kind: 'excel', name: 'Excel Workbook', icon: 'excel', cat: 'File', accept: '.xlsx,.xlsm,.xls,.xlsb,.ods', desc: 'Sheets and named ranges from .xlsx, .xlsm, .xls' },
  { kind: 'csv', name: 'Text/CSV', icon: 'csv', cat: 'File', accept: '.csv,.txt,.tsv,.prn', desc: 'Delimited text: .csv, .txt, .tsv' },
  { kind: 'xml', name: 'XML', icon: 'xml', cat: 'File', accept: '.xml', desc: 'XML documents' },
  { kind: 'json', name: 'JSON', icon: 'json', cat: 'File', accept: '.json', desc: 'JSON documents (arrays of records, nested objects)' },
  { kind: 'parquet', name: 'Parquet', icon: 'parquet', cat: 'File', accept: '.parquet', desc: 'Apache Parquet columnar files' },
  { kind: 'folder', name: 'Folder', icon: 'folder', cat: 'File', desc: 'Combine all files in a folder (same structure)' },
  { kind: 'pdf', name: 'PDF', icon: 'blank', cat: 'File', desc: 'Not available in the sandbox' },
  { kind: 'sharepoint', name: 'SharePoint folder', icon: 'folder', cat: 'File', desc: 'Not reachable from the sandbox; use Folder instead' },
  { kind: 'sql', name: 'SQL Server database', icon: 'sql', cat: 'Database', desc: 'Built-in sandbox server: localhost / ContosoDW' },
  { kind: 'lakehouse', name: 'Lakehouses (OneLake catalog)', icon: 'lakehouse', cat: 'Microsoft Fabric', desc: 'Sandbox lakehouse ContosoLakehouse: Direct Lake, or Import/DirectQuery through the SQL analytics endpoint' },
  { kind: 'semanticModel', name: 'Power BI semantic models', icon: 'plug', cat: 'Microsoft Fabric', desc: 'Live connection to a published semantic model in the sandbox service' },
  { kind: 'oracle', name: 'Oracle database', icon: 'database', cat: 'Database', desc: 'Not reachable from the sandbox' },
  { kind: 'dataverse', name: 'Dataverse', icon: 'database', cat: 'Power Platform', desc: 'Not reachable from the sandbox' },
  { kind: 'dataflow', name: 'Dataflows', icon: 'database', cat: 'Power Platform', desc: 'Not reachable from the sandbox' },
  { kind: 'web', name: 'Web', icon: 'globe', cat: 'Other', desc: 'Not reachable offline; download the file and import it' },
  { kind: 'odata', name: 'OData feed', icon: 'globe', cat: 'Other', desc: 'Not reachable from the sandbox' },
  { kind: 'enter', name: 'Enter data', icon: 'enterdata', cat: 'Other', desc: 'Type or paste a small table' },
  { kind: 'blank', name: 'Blank query', icon: 'blank', cat: 'Other', desc: 'Write M from scratch' },
  { kind: 'sample', name: 'Sample data (Contoso files)', icon: 'sample', cat: 'Other', desc: 'Messy practice files in every format' },
];

export function GetDataDialog({ d }: { d: DialogT }) {
  const [kind, setKind] = useState<string | null>(d.kind ?? null);
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  if (kind && kind !== 'pick') return <ConnectorFlow kind={kind} fromPQ={!!d.pq} onBack={() => setKind(null)} />;
  const list = CONNECTORS.filter(c => (cat === 'All' || c.cat === cat) && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
  return <Dialog title="Get Data" width={760} height="min(620px, 92vh)" footer={<><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap', minHeight: 0, flex: 1 }}>
      <div style={{ width: 170, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="pane-search" style={{ margin: '0 0 6px' }}><I n="search" s={13} /><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} autoFocus /></div>
        {['All', 'File', 'Database', 'Microsoft Fabric', 'Power Platform', 'Other'].map(c => <button key={c} className={`btn sm ${cat === c ? 'primary' : ''}`} style={{ textAlign: 'left', border: 0 }} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="list" style={{ flex: 1, minHeight: 300 }}>
        {list.map(c => <div key={c.kind} className="it" onDoubleClick={() => setKind(c.kind)} onClick={() => setKind(c.kind)}><I n={c.icon} s={20} /><div><div style={{ fontWeight: 600 }}>{c.name}</div><div className="tiny">{c.desc}</div></div></div>)}
      </div>
    </div>
  </Dialog>;
}

function FilePicker({ kind, accept, onFile, fromPQ }: { kind: string; accept: string; onFile: (f: StoredFile) => void; fromPQ: boolean }) {
  const s = store;
  const existing = s.files.filter(f => accept.split(',').some(a => f.name.toLowerCase().endsWith(a.trim())));
  const upload = async () => {
    const files = await pickFiles(accept, false);
    if (!files.length) return;
    const sf = await filesFromInput(files);
    await s.addFiles(sf);
    onFile(sf[0]);
  };
  void fromPQ;
  return <Dialog title={`Open ${CONNECTORS.find(c => c.kind === kind)?.name ?? 'file'}`} width={620} footer={<button className="btn" onClick={close}>Cancel</button>}>
    <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={upload}>Browse your computer…</button>
    <div className="tiny">Files you upload are kept in this browser (IndexedDB) under {ROOT_FOLDER}, so File.Contents("…\\name") finds them by name.</div>
    <div className="section-h">Files already in the sandbox</div>
    {existing.length ? <div className="list" style={{ maxHeight: 280 }}>{existing.map(f => <div key={fullPath(f)} className="it" onClick={() => onFile(f)}><I n={ext(f.name) === 'csv' || ext(f.name) === 'txt' ? 'csv' : ext(f.name).startsWith('xl') ? 'excel' : ext(f.name)} s={18} /><div><div>{f.name}</div><div className="tiny">{f.folder} · {(f.bytes.length / 1024).toFixed(1)} KB</div></div></div>)}</div>
      : <div className="subtle">None yet. <button className="btn sm" onClick={() => store.openDialog({ type: 'sampleData', justFiles: true })}>Add the Contoso sample files</button></div>}
  </Dialog>;
}

function previewTable(code: string): MTable | null {
  try { const v = new MEngine([{ id: 'x', name: 'x', code, load: false, refresh: true }]).evaluateQuery('x'); return v instanceof MTable ? v : null; } catch { return null; }
}
function Preview({ t, max = 20 }: { t: MTable | null; max?: number }) {
  if (!t) return <div className="subtle" style={{ padding: 10 }}>No preview available.</div>;
  return <div style={{ overflow: 'auto', border: '1px solid #e1dfdd', flex: 1, minHeight: 0 }}>
    <table className="dgrid"><thead><tr>{t.columns.map(c => <th key={c.name}><div className="colh"><span className="nm">{c.name}</span></div></th>)}</tr></thead>
      <tbody>{t.rows.slice(0, max).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={v === null ? 'null' : typeof v === 'number' ? 'num' : ''}>{v === null ? 'null' : displayValue(v, t.columns[j].type)}</td>)}</tr>)}</tbody></table>
  </div>;
}

function LoadButtons({ onLoad, onTransform, disabled }: { onLoad: () => void; onTransform: () => void; disabled?: boolean }) {
  return <><button className="btn yellow" disabled={disabled} onClick={onLoad}>Load</button><button className="btn" disabled={disabled} onClick={onTransform}>Transform Data</button><button className="btn" onClick={close}>Cancel</button></>;
}

function ConnectorFlow({ kind, fromPQ, onBack }: { kind: string; fromPQ: boolean; onBack: () => void }) {
  const [file, setFile] = useState<StoredFile | null>(null);
  const done = (qs: Q[], mode: 'load' | 'transform') => { close(); finishQueries(qs, mode, fromPQ); };
  const taken = () => (fromPQ && store.ui.pq ? store.ui.pq.queries : store.project.queries).map(q => q.name);
  if (kind === 'enter') return <EnterDataDialog d={{ type: 'enterData', pq: fromPQ }} />;
  if (kind === 'sample') return <SampleDataDialog d={{ type: 'sampleData', pq: fromPQ }} />;
  if (kind === 'blank') return <AutoRun run={() => done([blankQuery(uniqueName('Query1', taken()))], 'transform')} />;
  if (kind === 'sql') return <SqlDialog fromPQ={fromPQ} />;
  if (kind === 'lakehouse') return <LakehouseDialog fromPQ={fromPQ} />;
  if (kind === 'semanticModel') return <AutoRun run={() => { close(); store.openDialog({ type: 'liveConnect' }); }} />;
  if (kind === 'folder') return <FolderDialog fromPQ={fromPQ} />;
  const conn = CONNECTORS.find(c => c.kind === kind);
  if (!conn?.accept) return <Dialog title={conn?.name ?? 'Connector'} width={480} footer={<><button className="btn" onClick={onBack}>Back</button><button className="btn" onClick={close}>Close</button></>}>
    <div className="warnbox">{conn?.name} needs a connection the sandbox can't make from your browser. For practice, download the data as Excel, CSV, JSON or Parquet and use that connector, or use the built-in SQL Server (localhost / ContosoDW).</div>
  </Dialog>;
  if (!file) return <FilePicker kind={kind} accept={conn.accept} onFile={setFile} fromPQ={fromPQ} />;
  const name = uniqueName(file.name, taken());
  const e = ext(file.name);
  if (kind === 'csv' || ['csv', 'txt', 'tsv', 'prn'].includes(e)) return <CsvPreview file={file} name={name} done={done} />;
  if (kind === 'excel') return <ExcelNavigator file={file} done={done} taken={taken()} />;
  if (kind === 'xml') return <XmlNavigator file={file} done={done} taken={taken()} />;
  if (kind === 'json') return <AutoRun run={() => done([jsonQuery(file, name)], 'transform')} />;
  if (kind === 'parquet') { const qq = parquetQuery(file, name); return <Dialog title={file.name} width="min(900px, 95vw)" footer={<LoadButtons onLoad={() => done([qq], 'load')} onTransform={() => done([qq], 'transform')} />}><Preview t={previewTable(qq.code)} /></Dialog>; }
  return null;
}

function CsvPreview({ file, name, done }: { file: StoredFile; name: string; done: (q: Q[], m: 'load' | 'transform') => void }) {
  const text = useMemo(() => new TextDecoder().decode(file.bytes.slice(0, 200000)), [file]);
  const [delim, setDelim] = useState(() => sniffDelimiter(text));
  const [detect, setDetect] = useState(true);
  const q = useMemo(() => csvQuery(file, name, { delimiter: delim, detect }), [file, delim, detect, name]);
  const t = useMemo(() => previewTable(q.code), [q]);
  void parseDelimited;
  return <Dialog title={file.name} width="min(1000px, 95vw)" height="min(640px, 92vh)" footer={<LoadButtons onLoad={() => done([q], 'load')} onTransform={() => done([q], 'transform')} />}>
    <div className="row">
      <div className="field"><label>File Origin</label><select className="tx"><option>65001: Unicode (UTF-8)</option><option>1252: Western European (Windows)</option></select></div>
      <div className="field"><label>Delimiter</label><select className="tx" value={delim} onChange={e => setDelim(e.target.value)}><option value=",">Comma</option><option value={'\t'}>Tab</option><option value=";">Semicolon</option><option value="|">Pipe</option><option value=" ">Space</option><option value=":">Colon</option></select></div>
      <div className="field"><label>Data Type Detection</label><select className="tx" value={detect ? 'first' : 'none'} onChange={e => setDetect(e.target.value !== 'none')}><option value="first">Based on first 200 rows</option><option value="none">Do not detect data types</option></select></div>
    </div>
    <Preview t={t} />
    <div className="tiny">Load adds the table to the model now. Transform Data opens Power Query so you can clean it first.</div>
  </Dialog>;
}

function NavigatorShell({ title, items, sel, setSel, preview, done, build }: { title: string; items: { id: string; label: string; icon: string }[]; sel: string[]; setSel: (x: string[]) => void; preview: (id: string) => MTable | null; done: (q: Q[], m: 'load' | 'transform') => void; build: () => Q[] }) {
  const [focus, setFocus] = useState<string | null>(items[0]?.id ?? null);
  const [q, setQ] = useState('');
  const t = useMemo(() => (focus ? preview(focus) : null), [focus]);
  return <Dialog title="Navigator" width="min(1060px, 96vw)" height="min(660px, 92vh)" footer={<LoadButtons disabled={!sel.length} onLoad={() => done(build(), 'load')} onTransform={() => done(build(), 'transform')} />}>
    <div className="row" style={{ alignItems: 'stretch', flexWrap: 'nowrap', flex: 1, minHeight: 0 }}>
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <div className="pane-search" style={{ margin: 0 }}><I n="search" s={13} /><input placeholder="Search" value={q} onChange={e => setQ(e.target.value)} /></div>
        <label className="row tiny"><input type="checkbox" checked={sel.length === items.length} onChange={e => setSel(e.target.checked ? items.map(i => i.id) : [])} />Select multiple items</label>
        <div className="list" style={{ flex: 1 }}>
          <div className="it" style={{ fontWeight: 600 }}><I n="folderSm" s={14} />{title} [{items.length}]</div>
          {items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase())).map(i => <label key={i.id} className={`it ${focus === i.id ? 'on' : ''}`} style={{ paddingLeft: 20 }} onClick={() => setFocus(i.id)}>
            <input type="checkbox" checked={sel.includes(i.id)} onChange={e => setSel(e.target.checked ? [...sel, i.id] : sel.filter(x => x !== i.id))} /><I n={i.icon} s={14} />{i.label}</label>)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{items.find(i => i.id === focus)?.label}</div>
        <Preview t={t} />
      </div>
    </div>
  </Dialog>;
}

function ExcelNavigator({ file, done, taken }: { file: StoredFile; done: (q: Q[], m: 'load' | 'transform') => void; taken: string[] }) {
  const wb = useMemo(() => { try { return readWorkbook(file.bytes); } catch { return null; } }, [file]);
  const items = useMemo(() => {
    if (!wb) return [];
    const out = wb.SheetNames.map(n => ({ id: `Sheet|${n}`, label: n, icon: 'tableIcon' }));
    for (const dn of wb.Workbook?.Names ?? []) if (/!/.test(dn.Ref)) out.push({ id: `DefinedName|${dn.Name}`, label: dn.Name, icon: 'table' });
    return out;
  }, [wb]);
  const [sel, setSel] = useState<string[]>([]);
  if (!wb) return <Dialog title="Excel" width={420} footer={<button className="btn" onClick={close}>Close</button>}><div className="errbox">The file couldn't be read as an Excel workbook.</div></Dialog>;
  const qsFor = (ids: string[]) => excelQueries(file, ids.map(id => { const [kind, item] = id.split('|'); return { kind, item }; }), taken);
  return <NavigatorShell title={file.name} items={items} sel={sel} setSel={setSel} done={done} build={() => qsFor(sel)}
    preview={id => { const ws = wb.Sheets[id.split('|')[1]]; if (!ws) return previewTable(qsFor([id])[0].code); const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }); const w = Math.max(0, ...aoa.map(r => r.length)); return new MTable(Array.from({ length: w }, (_, i) => ({ name: `Column${i + 1}`, type: 'any' })), aoa.slice(0, 30).map(r => Array.from({ length: w }, (_, i) => r[i] ?? null))); }} />;
}

function XmlNavigator({ file, done, taken }: { file: StoredFile; done: (q: Q[], m: 'load' | 'transform') => void; taken: string[] }) {
  const root = useMemo(() => previewTable(`Xml.Tables(File.Contents("${fullPath(file).replace(/"/g, '""')}"))`), [file]);
  const items = (root?.rows ?? []).map(r => ({ id: String(r[0]), label: String(r[0]), icon: 'tableIcon' }));
  const [sel, setSel] = useState<string[]>(items.length === 1 ? [items[0].id] : []);
  return <NavigatorShell title={file.name} items={items} sel={sel} setSel={setSel} done={done} build={() => xmlQueries(file, sel, taken)} preview={id => (root?.rows.find(r => r[0] === id)?.[1] as MTable) ?? null} />;
}

function SqlDialog({ fromPQ }: { fromPQ: boolean }) {
  const [server, setServer] = useState('localhost');
  const [db, setDb] = useState('ContosoDW');
  const [mode, setMode] = useState<'Import' | 'DirectQuery'>('Import');
  const [nav, setNav] = useState<MTable | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const taken = (fromPQ && store.ui.pq ? store.ui.pq.queries : store.project.queries).map(q => q.name);
  const done = (qs: Q[], m: 'load' | 'transform') => { close(); finishQueries(qs.map(q => ({ ...q, storageMode: mode })), m, fromPQ); };
  if (nav) return <NavigatorShell title={`${server}: ${db}`} items={nav.rows.map(r => ({ id: String(r[0]), label: String(r[0]), icon: 'tableIcon' }))} sel={sel} setSel={setSel} done={done}
    build={() => sqlQueries(server, db, sel.map(id => { const r = nav.rows.find(x => x[0] === id)!; return { schema: String(r[2]), item: String(r[3]) }; }), taken)} preview={id => (nav.rows.find(r => r[0] === id)?.[1] as MTable) ?? null} />;
  return <Dialog title="SQL Server database" width={520} footer={<><button className="btn primary" onClick={() => { const t = contosoDW(server, db); if (!t) setErr(`Couldn't connect to '${server}' / '${db}'. The sandbox has one server: localhost with database ContosoDW.`); else setNav(t); }}>OK</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label htmlFor="sql-s">Server</label><input id="sql-s" className="tx" value={server} onChange={e => setServer(e.target.value)} /></div>
    <div className="field"><label htmlFor="sql-d">Database (optional)</label><input id="sql-d" className="tx" value={db} onChange={e => setDb(e.target.value)} /></div>
    <div className="field"><label>Data Connectivity mode</label><div className="radio-row"><label><input type="radio" checked={mode === 'Import'} onChange={() => setMode('Import')} />Import</label><label><input type="radio" checked={mode === 'DirectQuery'} onChange={() => setMode('DirectQuery')} />DirectQuery</label></div></div>
    <div className="tiny">Exam tip: Import copies data into the model (fast, needs refresh). DirectQuery leaves data in the source and queries it live (always current, limited DAX/Power Query, slower). Dual tables can act as either.</div>
    {err && <div className="errbox">{err}</div>}
  </Dialog>;
}

function LakehouseDialog({ fromPQ }: { fromPQ: boolean }) {
  const nav = useMemo(() => contosoDW(LAKEHOUSE_SERVER, LAKEHOUSE_DB)!, []);
  const [picked, setPicked] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [mode, setMode] = useState<'DirectLake' | 'Import' | 'DirectQuery'>('DirectLake');
  const taken = (fromPQ && store.ui.pq ? store.ui.pq.queries : store.project.queries).map(q => q.name);
  if (!picked) return <Dialog title="OneLake catalog" sub="Choose a lakehouse, warehouse or semantic model" width={720} footer={<button className="btn" onClick={close}>Cancel</button>}>
    <table className="grid-table"><thead><tr><th>Name</th><th>Type</th><th>Workspace</th><th>Endorsement</th><th>Sensitivity</th></tr></thead><tbody>
      <tr className="clickable" onClick={() => setPicked(true)}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="lakehouse" s={16} /><b>ContosoLakehouse</b></span></td><td>Lakehouse</td><td>Sales Analytics</td><td><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><I n="certified" s={14} />Certified</span></td><td>General</td></tr>
      <tr className="clickable" onClick={() => { close(); store.openDialog({ type: 'liveConnect' }); }}><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="plug" s={16} /><b>Semantic models…</b></span></td><td>Semantic model</td><td>Any</td><td /><td /></tr>
    </tbody></table>
    <div className="tiny">The lakehouse stores Delta (Parquet) tables in OneLake. The sandbox lakehouse holds the same Contoso star schema as the sandbox SQL Server.</div>
  </Dialog>;
  return <Dialog title="ContosoLakehouse" sub="Sales Analytics workspace · Lakehouse" width={720} footer={<>
    <button className="btn yellow" disabled={!sel.length} onClick={() => {
      close();
      const server = LAKEHOUSE_SERVER, db = LAKEHOUSE_DB;
      const qs = sqlQueries(server, db, sel.map(id => { const r = nav.rows.find(x => x[0] === id)!; return { schema: String(r[2]), item: String(r[3]) }; }), taken).map(q => ({ ...q, storageMode: mode }));
      finishQueries(qs, 'load', fromPQ);
      if (mode === 'DirectLake') store.toast('Created Direct Lake tables. They read the Delta tables directly: no import refresh, only reframing, and no Power Query transformations.');
    }}>{mode === 'DirectLake' ? 'Connect' : 'Load'}</button><button className="btn" onClick={() => setPicked(false)}>Back</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="field"><label>How do you want to connect?</label>
      <div className="radio-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <label><input type="radio" checked={mode === 'DirectLake'} onChange={() => setMode('DirectLake')} /><b>Direct Lake</b> — query the Delta tables in OneLake directly. Import-like speed, no scheduled refresh. Requires Fabric capacity.</label>
        <label><input type="radio" checked={mode === 'Import'} onChange={() => setMode('Import')} /><b>Import</b> through the SQL analytics endpoint — copy the data into the model; full Power Query.</label>
        <label><input type="radio" checked={mode === 'DirectQuery'} onChange={() => setMode('DirectQuery')} /><b>DirectQuery</b> through the SQL analytics endpoint — live T-SQL queries; only steps that fold.</label>
      </div>
    </div>
    <div className="section-h">Tables</div>
    <div className="list" style={{ maxHeight: 260 }}>{nav.rows.map(r => { const id = String(r[0]); return <label key={id} className="it" style={{ cursor: 'pointer' }}><input type="checkbox" checked={sel.includes(id)} onChange={() => setSel(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])} /><I n="tableIcon" s={16} /><span>{String(r[3])}</span><span className="tiny" style={{ marginLeft: 'auto' }}>{(r[1] as MTable).rows.length.toLocaleString()} rows · Delta</span></label>; })}</div>
  </Dialog>;
}

function FolderDialog({ fromPQ }: { fromPQ: boolean }) {
  const s = store;
  const folders = [...new Set(s.files.map(f => f.folder))].filter(f => f !== ROOT_FOLDER || true);
  const [folder, setFolder] = useState<string>(folders.find(f => /Monthly/.test(f)) ?? folders[0] ?? '');
  const files = s.files.filter(f => f.folder.toLowerCase() === folder.toLowerCase() || f.folder.toLowerCase().startsWith(folder.toLowerCase() + '\\'));
  const taken = (fromPQ && store.ui.pq ? store.ui.pq.queries : store.project.queries).map(q => q.name);
  const go = (mode: 'combineTransform' | 'combineLoad' | 'load' | 'transform') => {
    close();
    if (mode.startsWith('combine')) finishQueries(folderCombine(folder, files, taken), mode === 'combineLoad' ? 'load' : 'transform', fromPQ);
    else finishQueries([{ name: uniqueName(folder.split('\\').pop() || 'Folder', taken), code: `let\n    Source = Folder.Files("${folder.replace(/"/g, '""')}")\nin\n    Source` }], mode === 'load' ? 'load' : 'transform', fromPQ);
  };
  const upload = async () => {
    const fs = await pickFiles('', true, true);
    if (!fs.length) return;
    const sf = await filesFromInput(fs);
    await s.addFiles(sf);
    setFolder(sf[0].folder);
  };
  return <Dialog title="Folder" width="min(900px, 95vw)" footer={<><button className="btn yellow" disabled={!files.length} onClick={() => go('combineTransform')}>Combine &amp; Transform Data</button><button className="btn" disabled={!files.length} onClick={() => go('combineLoad')}>Combine &amp; Load</button><button className="btn" disabled={!files.length} onClick={() => go('load')}>Load</button><button className="btn" disabled={!files.length} onClick={() => go('transform')}>Transform Data</button><button className="btn" onClick={close}>Cancel</button></>}>
    <div className="row"><div className="field"><label>Folder path</label><select className="tx" value={folder} onChange={e => setFolder(e.target.value)}>{folders.map(f => <option key={f}>{f}</option>)}</select></div><button className="btn" style={{ marginTop: 18 }} onClick={upload}>Upload a folder…</button></div>
    <div style={{ overflow: 'auto', maxHeight: 300, border: '1px solid #e1dfdd' }}>
      <table className="dgrid"><thead><tr>{['Content', 'Name', 'Extension', 'Date modified', 'Folder Path'].map(h => <th key={h}><div className="colh"><span className="nm">{h}</span></div></th>)}</tr></thead>
        <tbody>{files.map(f => <tr key={fullPath(f)}><td className="struct">Binary</td><td>{f.name}</td><td>.{ext(f.name)}</td><td>{new Date(f.modified).toLocaleString()}</td><td>{f.folder}\</td></tr>)}</tbody></table>
    </div>
    <div className="tiny">Exam tip: Combine Files creates a Sample File query, a Transform Sample File / Transform File function, and the combined query. Every file must have the same columns.</div>
  </Dialog>;
}

export function EnterDataDialog({ d }: { d: DialogT }) {
  const [name, setName] = useState('Table');
  const [cols, setCols] = useState(['Column1', 'Column2']);
  const [rows, setRows] = useState<string[][]>([['', ''], ['', '']]);
  const setCell = (r: number, c: number, v: string) => setRows(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  const onPaste = (e: React.ClipboardEvent) => {
    const t = e.clipboardData.getData('text'); if (!t.includes('\t') && !t.includes('\n')) return;
    e.preventDefault();
    const lines = t.replace(/\r/g, '').split('\n').filter(l => l.length).map(l => l.split('\t'));
    const w = Math.max(...lines.map(l => l.length));
    setCols(lines[0].map((h, i) => h || `Column${i + 1}`).concat(Array.from({ length: w - lines[0].length }, (_, i) => `Column${lines[0].length + i + 1}`)));
    setRows(lines.slice(1).map(l => Array.from({ length: w }, (_, i) => l[i] ?? '')));
  };
  const build = () => [enterDataQuery(name, cols, rows.filter(r => r.some(x => x !== '')))];
  return <Dialog title="Create Table" width="min(760px, 95vw)" footer={<LoadButtons onLoad={() => { close(); finishQueries(build(), 'load', !!d.pq); }} onTransform={() => { close(); finishQueries(build(), 'transform', !!d.pq); }} />}>
    <div className="tiny">Type values, or paste cells copied from Excel (the first row becomes headers).</div>
    <div style={{ overflow: 'auto', maxHeight: 340, border: '1px solid #e1dfdd' }} onPaste={onPaste}>
      <table className="dgrid"><thead><tr><th className="rn" />{cols.map((c, i) => <th key={i}><input className="tx" value={c} onChange={e => setCols(cols.map((x, j) => (j === i ? e.target.value : x)))} style={{ border: 0, fontWeight: 600 }} aria-label={`Column ${i + 1} name`} /></th>)}<th><button className="iconbtn" title="Insert column" onClick={() => { setCols([...cols, `Column${cols.length + 1}`]); setRows(rows.map(r => [...r, ''])); }}><I n="plus" s={12} /></button></th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td className="rn">{i + 1}</td>{r.map((v, j) => <td key={j} style={{ padding: 0 }}><input className="tx" style={{ border: 0, borderRadius: 0 }} value={v} onChange={e => setCell(i, j, e.target.value)} aria-label={`Row ${i + 1} ${cols[j]}`} /></td>)}</tr>)}
          <tr><td className="rn"><button className="iconbtn" title="Insert row" onClick={() => setRows([...rows, cols.map(() => '')])}><I n="plus" s={12} /></button></td></tr></tbody></table>
    </div>
    <div className="field" style={{ maxWidth: 300 }}><label htmlFor="ed-n">Name</label><input id="ed-n" className="tx" value={name} onChange={e => setName(e.target.value)} /></div>
  </Dialog>;
}

export function SampleDataDialog({ d }: { d: DialogT }) {
  const s = store;
  const [busy, setBusy] = useState(false);
  const add = async (mode: 'files' | 'model') => {
    setBusy(true);
    const { sampleFiles } = await import('../../data/sample');
    await s.addFiles(sampleFiles());
    close();
    if (mode === 'files') { s.toast(`Added sample files to ${ROOT_FOLDER}. Use Get data to import them.`); if (!d.justFiles) s.openDialog({ type: 'getData', pq: d.pq }); return; }
    const { quickModel } = await import('../../tutorials/scenarios');
    quickModel();
  };
  return <Dialog title="Sample data" sub="Contoso bicycle retailer, 2023–2025" width={640} footer={<button className="btn" onClick={close}>Cancel</button>}>
    <button className="bs-item" disabled={busy} onClick={() => add('files')}><I n="folder" s={28} /><div><b>Add the raw sample files</b><span className="subtle">Sales.csv, Products.xlsx (title rows to remove, messy names), Customers.json (nested records), Stores.xml, Budget 2025.csv (wide format to unpivot), Employees.csv (parent-child), Returns.txt (tab-delimited) and a folder of monthly files to combine. Practise every Get data and Power Query step yourself.</span></div></button>
    <button className="bs-item" disabled={busy} onClick={() => add('model')}><I n="model" s={28} /><div><b>Load a ready-made star schema</b><span className="subtle">Imports the files with clean-up steps already applied, adds a Date table marked as a date table, relationships, measures and a starter report page. Best for practising DAX and visuals.</span></div></button>
    <div className="tiny">Everything is generated in your browser. Nothing is uploaded anywhere.</div>
  </Dialog>;
}
