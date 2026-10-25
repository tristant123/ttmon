// File menu (backstage view).
import React, { useState } from 'react';
import { useStore } from '../store';
import { I } from './icons';
import { saveProjectFile, openProjectFile, exportBim, exportTableCsv, serializeProject } from '../io/project';
import { copyText } from './common';

export function Backstage() {
  const s = useStore();
  const [tab, setTab] = useState('home');
  const closeBs = () => s.setUI({ backstage: false });
  const item = (icon: string, title: string, desc: string, onClick: () => void) => <button className="bs-item" onClick={onClick}><I n={icon} s={30} /><div><b>{title}</b><span className="subtle">{desc}</span></div></button>;
  return <div className="backstage" role="dialog" aria-label="File">
    <div className="side">
      <button onClick={closeBs}><I n="chevronLeft" s={14} c="#4d3e00" /> Back</button>
      {[['home', 'Home'], ['new', 'New'], ['open', 'Open'], ['save', 'Save'], ['import', 'Import'], ['export', 'Export'], ['options', 'Options and settings'], ['about', 'About']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>
    <div className="content">
      {tab === 'home' && <><h1>Good day</h1><div className="bs-list">
        {item('newfile', 'Blank report', 'Start a new report with no data.', () => { s.newProject(); closeBs(); })}
        {item('sample', 'Sample data', 'Load the Contoso sample files or a ready-made star schema.', () => { closeBs(); s.openDialog({ type: 'sampleData' }); })}
        {item('grad', 'PL-300 tutorials', 'Guided, exam-focused walkthroughs with their own sample data.', () => { closeBs(); s.setUI({ showTutorials: true }); })}
        {item('open', 'Open a file', 'A .pbisandbox project, a Power BI template (.pbit) or a model.bim.', () => { closeBs(); void openProjectFile(); })}
      </div></>}
      {tab === 'new' && <><h1>New</h1><div className="bs-list">{item('newfile', 'Blank report', 'Discards the current project (save it first if you want to keep it).', () => { s.newProject(); closeBs(); })}</div></>}
      {tab === 'open' && <><h1>Open</h1><div className="bs-list">
        {item('open', 'Browse this device', 'Open .pbisandbox, .pbit or .bim. Opening a .pbix explains how to export it as a template first.', () => { closeBs(); void openProjectFile(); })}
        <div className="tiny">Your work is also saved automatically in this browser, and reopens next time.</div>
      </div></>}
      {tab === 'save' && <><h1>Save</h1><div className="bs-list">
        <div className="field"><label htmlFor="bs-name">Report name</label><input id="bs-name" className="tx" style={{ maxWidth: 360 }} value={s.project.name} onChange={e => s.change(p => { p.name = e.target.value; }, { noUndo: true })} /></div>
        {item('save', 'Save as .pbisandbox', 'Downloads one file with your queries, model, report and uploaded source files.', () => saveProjectFile())}
        {item('copy', 'Copy project to clipboard', 'For viewers that block downloads: paste it into a text file named something.pbisandbox.', () => void copyText(serializeProject()))}
      </div></>}
      {tab === 'import' && <><h1>Import</h1><div className="bs-list">
        {item('import', 'Power BI template (.pbit)', 'Brings in queries, tables, measures, relationships, roles and report pages.', () => { closeBs(); void openProjectFile(); })}
        {item('import', 'Semantic model (model.bim / TMSL JSON)', 'From a .pbip project folder or Tabular Editor.', () => { closeBs(); void openProjectFile(); })}
      </div></>}
      {tab === 'export' && <><h1>Export</h1><div className="bs-list">
        {item('export', 'Semantic model as model.bim (TMSL)', 'Open it in Tabular Editor, or drop it into a .pbip project.', () => exportBim())}
        {s.project.model.tables.map(t => item('csv', `Table ${t.name} as CSV`, `${t.rows.length.toLocaleString()} rows`, () => exportTableCsv(t.name)))}
      </div></>}
      {tab === 'options' && <><h1>Options</h1><div className="bs-list" style={{ gap: 12 }}>
        <label className="row"><input type="checkbox" checked={s.project.settings.autoDateTime} onChange={e => s.change(p => { p.settings.autoDateTime = e.target.checked; })} />Time intelligence: Auto date/time (date columns get a Year › Quarter › Month › Day hierarchy)</label>
        <label className="row"><input type="checkbox" checked={s.project.settings.autodetectRelationships} onChange={e => s.change(p => { p.settings.autodetectRelationships = e.target.checked; })} />Relationships: Autodetect new relationships after data is loaded</label>
        <div className="tiny">Exam tip: turn off Auto date/time in large models and use your own Date table marked as a date table.</div>
      </div></>}
      {tab === 'about' && <><h1>About</h1><div style={{ maxWidth: 680, lineHeight: 1.6 }}>
        <p>PL-300 Sandbox is a practice environment that recreates Power BI Desktop in the browser: Power Query with a real M engine, a DAX engine with filter context, row context, context transition and relationship propagation, the model view, report visuals, and the DAX query view.</p>
        <p>It's an independent learning tool, not Microsoft software. Power BI service features (workspaces, apps, gateways, scheduled refresh, sharing, sensitivity labels) are outside the sandbox; the tutorials cover them as exam notes.</p>
      </div></>}
    </div>
  </div>;
}
