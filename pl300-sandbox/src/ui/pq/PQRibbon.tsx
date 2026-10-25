// Power Query Editor ribbon: Home, Transform, Add Column, View, Tools, Help.
import React from 'react';
import { store } from '../../store';
import { RBtn, RSmall, Group } from '../Ribbon';
import { menuBelow, MenuItem } from '../common';
import { T, pq, setPQ, closeAndApply, applyOnly, currentQuery, currentTable, addQuery, stepsOf, invalidate } from './ops';
import { typeMenu } from './PQGrid';
import { typeName } from '../../core/values';
import { mId } from '../../m/parser';

const d = (type: string, extra: Record<string, any> = {}) => () => store.openDialog({ type, ...extra });

function statsMenu(): MenuItem[] {
  return [['Sum', 'Sum'], ['Min', 'Minimum'], ['Max', 'Maximum'], ['Median', 'Median'], ['Average', 'Average'], ['StandardDeviation', 'Standard Deviation'], ['Count', 'Count Values'], ['CountDistinct', 'Count Distinct Values']].map(([f, l]) => ({ label: l, onClick: () => T.statistic(f, l) }));
}
function standardMenu(asNew: boolean): MenuItem[] {
  return [['add', 'Add'], ['multiply', 'Multiply'], ['subtract', 'Subtract'], ['divide', 'Divide'], ['intdivide', 'Integer-Divide'], ['modulo', 'Modulo'], ['percent', 'Percentage'], ['percentOf', 'Percent Of']].map(([k, l]) => ({ label: l, onClick: () => store.openDialog({ type: 'pq:form', form: 'number', op: k, label: l, asNew }) }));
}
function scientificMenu(asNew: boolean): MenuItem[] {
  return [{ label: 'Absolute Value', onClick: () => T.numberOp('abs', null, asNew) }, { label: 'Power…', onClick: () => store.openDialog({ type: 'pq:form', form: 'number', op: 'power', label: 'Power', asNew }) }, { label: 'Square Root', onClick: () => T.numberOp('sqrt', null, asNew) }, { label: 'Exponent', onClick: () => T.numberOp('exp', null, asNew) }, { label: 'Natural Logarithm', onClick: () => T.numberOp('ln', null, asNew) }, { label: 'Base-10 Logarithm', onClick: () => T.numberOp('log10', null, asNew) }];
}
function roundingMenu(asNew: boolean): MenuItem[] { return [{ label: 'Round Up', onClick: () => T.numberOp('roundUp', null, asNew) }, { label: 'Round Down', onClick: () => T.numberOp('roundDown', null, asNew) }, { label: 'Round…', onClick: () => store.openDialog({ type: 'pq:form', form: 'round', asNew }) }]; }
function infoMenu(asNew: boolean): MenuItem[] { return [{ label: 'Is Even', onClick: () => T.numberOp('even', null, asNew) }, { label: 'Is Odd', onClick: () => T.numberOp('odd', null, asNew) }, { label: 'Sign', onClick: () => T.numberOp('sign', null, asNew) }]; }
function formatMenu(asNew: boolean): MenuItem[] {
  return [
    { label: 'lowercase', onClick: () => T.textTransform('Text.Lower', 'Lowercased Text', asNew, 'lowercase') },
    { label: 'UPPERCASE', onClick: () => T.textTransform('Text.Upper', 'Uppercased Text', asNew, 'UPPERCASE') },
    { label: 'Capitalize Each Word', onClick: () => T.textTransform('Text.Proper', 'Capitalized Each Word', asNew, 'Capitalize Each Word') },
    { label: 'Trim', onClick: () => T.textTransform('Text.Trim', 'Trimmed Text', asNew, 'Trim') },
    { label: 'Clean', onClick: () => T.textTransform('Text.Clean', 'Cleaned Text', asNew, 'Clean') },
    { label: 'Add Prefix…', onClick: () => store.openDialog({ type: 'pq:form', form: 'prefix', asNew }) },
    { label: 'Add Suffix…', onClick: () => store.openDialog({ type: 'pq:form', form: 'suffix', asNew }) },
  ];
}
function extractMenu(asNew: boolean): MenuItem[] {
  return [
    { label: 'Length', onClick: () => T.extract('length', {}, asNew) },
    { label: 'First Characters…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractFirst', asNew }) },
    { label: 'Last Characters…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractLast', asNew }) },
    { label: 'Range…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractRange', asNew }) },
    { sep: true },
    { label: 'Text Before Delimiter…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractBefore', asNew }) },
    { label: 'Text After Delimiter…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractAfter', asNew }) },
    { label: 'Text Between Delimiters…', onClick: () => store.openDialog({ type: 'pq:form', form: 'extractBetween', asNew }) },
  ];
}
function dateMenu(asNew: boolean): MenuItem[] {
  const o = (k: string) => () => T.dateOp(k, asNew);
  return [
    { label: 'Age', onClick: o('age') }, { label: 'Date Only', onClick: o('dateOnly') },
    { label: 'Year', items: [{ label: 'Year', onClick: o('year') }, { label: 'Start of Year', onClick: o('startYear') }, { label: 'End of Year', onClick: o('endYear') }] },
    { label: 'Month', items: [{ label: 'Month', onClick: o('month') }, { label: 'Start of Month', onClick: o('startMonth') }, { label: 'End of Month', onClick: o('endMonth') }, { label: 'Days in Month', onClick: o('daysInMonth') }, { label: 'Name of Month', onClick: o('monthName') }] },
    { label: 'Quarter', items: [{ label: 'Quarter of Year', onClick: o('quarter') }, { label: 'Start of Quarter', onClick: o('startQuarter') }, { label: 'End of Quarter', onClick: o('endQuarter') }] },
    { label: 'Week', items: [{ label: 'Week of Year', onClick: o('weekOfYear') }, { label: 'Week of Month', onClick: o('weekOfMonth') }, { label: 'Start of Week', onClick: o('startWeek') }, { label: 'End of Week', onClick: o('endWeek') }] },
    { label: 'Day', items: [{ label: 'Day', onClick: o('day') }, { label: 'Day of Week', onClick: o('dayOfWeek') }, { label: 'Day of Year', onClick: o('dayOfYear') }, { label: 'Name of Day', onClick: o('dayName') }] },
  ];
}
const timeMenu = (asNew: boolean): MenuItem[] => [{ label: 'Time Only', onClick: () => T.dateOp('timeOnly', asNew) }, { label: 'Hour', onClick: () => T.dateOp('hour', asNew) }, { label: 'Minute', onClick: () => T.dateOp('minute', asNew) }, { label: 'Second', onClick: () => T.dateOp('second', asNew) }];
const durationMenu = (asNew: boolean): MenuItem[] => [{ label: 'Days', onClick: () => T.dateOp('days', asNew) }, { label: 'Total Years', onClick: () => T.dateOp('totalYears', asNew) }, { label: 'Total Days', onClick: () => T.dateOp('totalDays', asNew) }, { label: 'Total Hours', onClick: () => T.dateOp('totalHours', asNew) }];
const splitMenu = (): MenuItem[] => [
  { label: 'By Delimiter…', onClick: d('pq:split') }, { label: 'By Number of Characters…', onClick: d('pq:form', { form: 'splitChars' }) }, { label: 'By Positions…', onClick: d('pq:form', { form: 'splitPositions' }) },
  { label: 'By Lowercase to Uppercase', onClick: () => T.splitPositions('transition', 'lowerUpper') }, { label: 'By Uppercase to Lowercase', onClick: () => T.splitPositions('transition', 'upperLower') },
  { label: 'By Digit to Non-Digit', onClick: () => T.splitPositions('transition', 'digitNon') }, { label: 'By Non-Digit to Digit', onClick: () => T.splitPositions('transition', 'nonDigit') },
];

export function PQRibbon() {
  const s = store; const p = pq();
  const t = currentTable();
  const col = p.selectedCols[0];
  const colType = t && col ? t.columns.find(c => c.name === col)?.type : undefined;
  const tab = p.ribbon;
  const tabs = ['Home', 'Transform', 'Add Column', 'View', 'Tools', 'Help'];
  const q = currentQuery();
  let body: React.ReactNode = null;
  if (tab === 'Home') body = <>
    <Group label="Close"><RBtn icon="closeapply" label="Close & Apply" menu onClick={e => menuBelow(e.currentTarget, [{ label: 'Close & Apply', onClick: () => closeAndApply(true) }, { label: 'Apply', onClick: applyOnly }, { label: 'Close', onClick: () => s.openDialog({ type: 'pq:closeConfirm' }) }])} /></Group>
    <Group label="New Query">
      <RBtn icon="newsource" label="New Source" menu onClick={e => menuBelow(e.currentTarget, [
        { label: 'Excel Workbook', icon: 'excel', onClick: d('getData', { kind: 'excel', pq: true }) }, { label: 'Text/CSV', icon: 'csv', onClick: d('getData', { kind: 'csv', pq: true }) }, { label: 'JSON', icon: 'json', onClick: d('getData', { kind: 'json', pq: true }) },
        { label: 'XML', icon: 'xml', onClick: d('getData', { kind: 'xml', pq: true }) }, { label: 'Parquet', icon: 'parquet', onClick: d('getData', { kind: 'parquet', pq: true }) }, { label: 'Folder', icon: 'folder', onClick: d('getData', { kind: 'folder', pq: true }) },
        { label: 'SQL Server', icon: 'sql', onClick: d('getData', { kind: 'sql', pq: true }) }, { label: 'Blank Query', icon: 'blank', onClick: () => addQuery({ name: 'Query1', code: 'let\n    Source = ""\nin\n    Source' }) },
        { sep: true }, { label: 'Sample data (Contoso files)', icon: 'sample', onClick: d('sampleData', { pq: true }) },
      ])} />
      <RBtn icon="enterdata" label="Enter Data" onClick={d('enterData', { pq: true })} />
    </Group>
    <Group label="Sources & Parameters"><div className="rstack">
      <RSmall icon="datasource" label="Data source settings" onClick={d('dataSources')} />
      <RSmall icon="manageparams" label="Manage Parameters ▾" onClick={e => menuBelow(e.currentTarget, [{ label: 'Manage Parameters', onClick: d('pq:params') }, { label: 'New Parameter', onClick: d('pq:params', { create: true }) }])} />
      <RSmall icon="refresh" label="Refresh Preview" onClick={() => { invalidate(); setPQ({}); }} />
    </div></Group>
    <Group label="Query">
      <div className="rstack">
        <RSmall icon="info" label="Properties" disabled={!q} onClick={d('pq:props')} />
        <RSmall icon="advanced" label="Advanced Editor" disabled={!q} onClick={d('pq:advanced')} />
        <RSmall icon="more" label="Manage ▾" disabled={!q} onClick={e => menuBelow(e.currentTarget, [{ label: 'Delete', onClick: d('pq:deleteQuery', { name: q!.name }) }, { label: 'Duplicate', onClick: () => addQuery({ name: q!.name, code: q!.code }) }, { label: 'Reference', onClick: () => addQuery({ name: q!.name, code: `let\n    Source = ${mId(q!.name)}\nin\n    Source` }) }])} />
      </div>
    </Group>
    <Group label="Manage Columns">
      <RBtn icon="chooseCols" label="Choose Columns" menu disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Choose Columns', onClick: d('pq:choose') }, { label: 'Go to Column', onClick: d('pq:choose', { goto: true }) }])} />
      <RBtn icon="removeCols" label="Remove Columns" menu disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Remove Columns', onClick: () => T.removeColumns() }, { label: 'Remove Other Columns', onClick: () => T.removeOther() }])} />
    </Group>
    <Group label="Reduce Rows">
      <RBtn icon="keep" label="Keep Rows" menu disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Keep Top Rows', onClick: d('pq:form', { form: 'keepTop' }) }, { label: 'Keep Bottom Rows', onClick: d('pq:form', { form: 'keepBottom' }) }, { label: 'Keep Range of Rows', onClick: d('pq:form', { form: 'keepRange' }) }, { sep: true }, { label: 'Keep Duplicates', onClick: () => T.keepDuplicates() }, { label: 'Keep Errors', onClick: () => T.keepErrors() }])} />
      <RBtn icon="removeRows" label="Remove Rows" menu disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Remove Top Rows', onClick: d('pq:form', { form: 'removeTop' }) }, { label: 'Remove Bottom Rows', onClick: d('pq:form', { form: 'removeBottom' }) }, { label: 'Remove Alternate Rows', onClick: d('pq:form', { form: 'removeAlternate' }) }, { sep: true }, { label: 'Remove Duplicates', onClick: () => T.removeDuplicates() }, { label: 'Remove Blank Rows', onClick: () => T.removeBlank() }, { label: 'Remove Errors', onClick: () => T.removeErrors() }])} />
    </Group>
    <Group label="Sort"><div className="rstack"><RSmall icon="sortAsc" label="Sort Ascending" disabled={!col} onClick={() => T.sort(false)} /><RSmall icon="sortDesc" label="Sort Descending" disabled={!col} onClick={() => T.sort(true)} /></div></Group>
    <Group label="Transform">
      <RBtn icon="split" label="Split Column" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, splitMenu())} />
      <RBtn icon="groupby" label="Group By" disabled={!t} onClick={d('pq:group')} />
      <div className="rstack">
        <RSmall icon="datatype" label={`Data Type: ${colType ? typeName(colType) : '—'}`} disabled={!col} onClick={e => menuBelow(e.currentTarget, typeMenu(p.selectedCols))} />
        <RSmall icon="promote" label="Use First Row as Headers ▾" disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Use First Row as Headers', onClick: () => T.promote() }, { label: 'Use Headers as First Row', onClick: () => T.demote() }])} />
        <RSmall icon="replace" label="Replace Values" disabled={!col} onClick={d('pq:replace')} />
      </div>
    </Group>
    <Group label="Combine"><div className="rstack">
      <RSmall icon="merge" label="Merge Queries ▾" disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Merge Queries', onClick: d('pq:merge') }, { label: 'Merge Queries as New', onClick: d('pq:merge', { asNew: true }) }])} />
      <RSmall icon="append" label="Append Queries ▾" disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Append Queries', onClick: d('pq:append') }, { label: 'Append Queries as New', onClick: d('pq:append', { asNew: true }) }])} />
      <RSmall icon="combine" label="Combine Files" onClick={d('getData', { kind: 'folder', pq: true })} />
    </div></Group>
  </>;
  if (tab === 'Transform') body = <>
    <Group label="Table">
      <RBtn icon="groupby" label="Group By" disabled={!t} onClick={d('pq:group')} />
      <RBtn icon="promote" label="Use First Row as Headers" menu disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'Use First Row as Headers', onClick: () => T.promote() }, { label: 'Use Headers as First Row', onClick: () => T.demote() }])} />
      <div className="rstack"><RSmall icon="transpose" label="Transpose" disabled={!t} onClick={() => T.transpose()} /><RSmall icon="sort" label="Reverse Rows" disabled={!t} onClick={() => T.reverse()} /><RSmall icon="indexcol" label="Count Rows" disabled={!t} onClick={() => T.countRows()} /></div>
    </Group>
    <Group label="Any Column">
      <div className="rstack">
        <RSmall icon="datatype" label={`Data Type: ${colType ? typeName(colType) : '—'} ▾`} disabled={!col} onClick={e => menuBelow(e.currentTarget, typeMenu(p.selectedCols))} />
        <RSmall icon="datatype" label="Detect Data Type" disabled={!t} onClick={() => T.detectTypes()} />
        <RSmall icon="edit" label="Rename" disabled={!col} onClick={d('pq:rename', { col })} />
      </div>
      <div className="rstack">
        <RSmall icon="replace" label="Replace Values ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'Replace Values', onClick: d('pq:replace') }, { label: 'Replace Errors', onClick: d('pq:form', { form: 'replaceErrors' }) }])} />
        <RSmall icon="fill" label="Fill ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'Down', onClick: () => T.fill('Down') }, { label: 'Up', onClick: () => T.fill('Up') }])} />
        <RSmall icon="pivot" label="Pivot Column" disabled={!col} onClick={d('pq:pivot')} />
      </div>
      <div className="rstack">
        <RSmall icon="unpivot" label="Unpivot Columns ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'Unpivot Columns', onClick: () => T.unpivot('selected') }, { label: 'Unpivot Other Columns', onClick: () => T.unpivot('other') }, { label: 'Unpivot Only Selected Columns', onClick: () => T.unpivot('only') }])} />
        <RSmall icon="sort" label="Move ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'Left', onClick: () => T.move('Left') }, { label: 'Right', onClick: () => T.move('Right') }, { label: 'To Beginning', onClick: () => T.move('Beginning') }, { label: 'To End', onClick: () => T.move('End') }])} />
        <RSmall icon="blank" label="Convert to List" disabled={!col} onClick={() => T.drillDown(col!)} />
      </div>
    </Group>
    <Group label="Text Column">
      <RBtn icon="split" label="Split Column" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, splitMenu())} />
      <RBtn icon="fieldText" label="Format" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, formatMenu(false))} />
      <div className="rstack">
        <RSmall icon="merge" label="Merge Columns" disabled={p.selectedCols.length < 2} onClick={d('pq:form', { form: 'mergeCols', asNew: false })} />
        <RSmall icon="blank" label="Extract ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, extractMenu(false))} />
        <RSmall icon="json" label="Parse ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'JSON', onClick: () => T.parse('JSON') }, { label: 'XML', onClick: () => T.parse('XML') }])} />
      </div>
    </Group>
    <Group label="Number Column">
      <RBtn icon="sigma" label="Statistics" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, statsMenu())} />
      <RBtn icon="calc" label="Standard" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, standardMenu(false))} />
      <RBtn icon="fieldNum" label="Scientific" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, scientificMenu(false))} />
      <div className="rstack"><RSmall icon="fieldNum" label="Rounding ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, roundingMenu(false))} /><RSmall icon="info" label="Information ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, infoMenu(false))} /></div>
    </Group>
    <Group label="Date & Time Column">
      <RBtn icon="calendar" label="Date" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, dateMenu(false))} />
      <RBtn icon="perf" label="Time" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, timeMenu(false))} />
      <RBtn icon="perf" label="Duration" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, durationMenu(false))} />
    </Group>
    <Group label="Structured Column">
      <RBtn icon="expandAll" label="Expand" disabled={!col || !['table', 'record', 'list', 'any'].includes(colType ?? '')} onClick={() => { const v = t!.rows.find(r => r[t!.idx(col!)] !== null)?.[t!.idx(col!)]; const kind = Array.isArray(v) ? 'list' : v && (v as any).names && !(v as any).columns ? 'record' : 'table'; if (kind === 'list') T.expand(col!, [], false, 'list'); else s.openDialog({ type: 'pq:expand', col, kind }); }} />
      <RBtn icon="sigma" label="Aggregate" disabled={!col} onClick={d('pq:expand', { col, kind: 'table', aggregate: true })} />
    </Group>
  </>;
  if (tab === 'Add Column') body = <>
    <Group label="General">
      <RBtn icon="blank" label="Column From Examples" disabled title="Column From Examples needs AI pattern matching and isn't part of the sandbox" />
      <RBtn icon="customcol" label="Custom Column" disabled={!t} onClick={d('pq:custom')} />
      <RBtn icon="advanced" label="Invoke Custom Function" disabled={!t} onClick={d('pq:invoke')} />
      <div className="rstack">
        <RSmall icon="condcol" label="Conditional Column" disabled={!t} onClick={d('pq:conditional')} />
        <RSmall icon="indexcol" label="Index Column ▾" disabled={!t} onClick={e => menuBelow(e.currentTarget, [{ label: 'From 0', onClick: () => T.index(0, 1) }, { label: 'From 1', onClick: () => T.index(1, 1) }, { label: 'Custom…', onClick: d('pq:form', { form: 'index' }) }])} />
        <RSmall icon="copy" label="Duplicate Column" disabled={!col} onClick={() => T.duplicate()} />
      </div>
    </Group>
    <Group label="From Text">
      <RBtn icon="fieldText" label="Format" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, formatMenu(true))} />
      <div className="rstack">
        <RSmall icon="merge" label="Merge Columns" disabled={p.selectedCols.length < 2} onClick={d('pq:form', { form: 'mergeCols', asNew: true })} />
        <RSmall icon="blank" label="Extract ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, extractMenu(true))} />
        <RSmall icon="json" label="Parse ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, [{ label: 'JSON', onClick: () => T.parse('JSON') }, { label: 'XML', onClick: () => T.parse('XML') }])} />
      </div>
    </Group>
    <Group label="From Number">
      <RBtn icon="sigma" label="Statistics" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, statsMenu())} />
      <RBtn icon="calc" label="Standard" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, standardMenu(true))} />
      <RBtn icon="fieldNum" label="Scientific" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, scientificMenu(true))} />
      <div className="rstack"><RSmall icon="fieldNum" label="Rounding ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, roundingMenu(true))} /><RSmall icon="info" label="Information ▾" disabled={!col} onClick={e => menuBelow(e.currentTarget, infoMenu(true))} /></div>
    </Group>
    <Group label="From Date & Time">
      <RBtn icon="calendar" label="Date" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, dateMenu(true))} />
      <RBtn icon="perf" label="Time" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, timeMenu(true))} />
      <RBtn icon="perf" label="Duration" menu disabled={!col} onClick={e => menuBelow(e.currentTarget, durationMenu(true))} />
    </Group>
  </>;
  if (tab === 'View') body = <>
    <Group label="Layout"><div className="rstack">
      <label className="rsmall"><input type="checkbox" checked={p.showSettings} onChange={e => setPQ({ showSettings: e.target.checked })} /> Query Settings</label>
      <label className="rsmall"><input type="checkbox" checked={p.formulaBar} onChange={e => setPQ({ formulaBar: e.target.checked })} /> Formula Bar</label>
    </div></Group>
    <Group label="Data Preview"><div className="rstack">
      <label className="rsmall"><input type="checkbox" checked={!!(p as any).mono} onChange={e => setPQ({ mono: e.target.checked } as any)} /> Monospaced</label>
      <label className="rsmall"><input type="checkbox" checked={!!(p as any).whitespace} onChange={e => setPQ({ whitespace: e.target.checked } as any)} /> Show whitespace</label>
    </div><div className="rstack">
      <label className="rsmall"><input type="checkbox" checked={p.profile.quality} onChange={e => setPQ({ profile: { ...p.profile, quality: e.target.checked } })} /> Column quality</label>
      <label className="rsmall"><input type="checkbox" checked={p.profile.distribution} onChange={e => setPQ({ profile: { ...p.profile, distribution: e.target.checked } })} /> Column distribution</label>
      <label className="rsmall"><input type="checkbox" checked={p.profile.profile} onChange={e => setPQ({ profile: { ...p.profile, profile: e.target.checked } })} /> Column profile</label>
    </div></Group>
    <Group label="Columns"><RBtn icon="chooseCols" label="Go to Column" disabled={!t} onClick={d('pq:choose', { goto: true })} /></Group>
    <Group label="Advanced"><RBtn icon="advanced" label="Advanced Editor" disabled={!q} onClick={d('pq:advanced')} /></Group>
    <Group label="Dependencies"><RBtn icon="queryDeps" label="Query Dependencies" onClick={d('pq:deps')} /></Group>
  </>;
  if (tab === 'Tools') body = <>
    <Group label="Diagnostics"><RBtn icon="perf" label="Diagnose Step" disabled={!q} onClick={() => { const sp = q ? stepsOf(q) : null; const r = sp ? sp.steps.length : 0; s.toast(`${q?.name}: ${r} steps. The status bar shows each preview's evaluation time.`); }} /></Group>
  </>;
  if (tab === 'Help') body = <>
    <Group label="Help"><RBtn icon="grad" label="PL-300 tutorials" onClick={() => s.setUI({ showTutorials: true })} /><RBtn icon="book" label="M reference" onClick={() => window.open('https://learn.microsoft.com/powerquery-m/power-query-m-function-reference', '_blank')} /></Group>
  </>;
  return <div className="ribbon">
    <div className="ribbon-tabs">
      <button className="rtab file" onClick={e => menuBelow(e.currentTarget, [{ label: 'Close & Apply', onClick: () => closeAndApply(true) }, { label: 'Apply', onClick: applyOnly }, { label: 'Discard & Close', onClick: () => closeAndApply(false) }, { sep: true }, { label: 'Options and settings', onClick: d('options') }])}>File</button>
      {tabs.map(x => <button key={x} className={`rtab ${x === tab ? 'active' : ''}`} onClick={() => setPQ({ ribbon: x })}>{x}</button>)}
    </div>
    <div className="ribbon-body">{body}</div>
  </div>;
}
