// DAX formula bar (New measure / New column / New table), with IntelliSense.
import React, { useState } from 'react';
import { useStore, store } from '../store';
import { I } from './icons';
import { CodeEditor, Suggestion } from './CodeEditor';
import { commitFormula } from './actions';
import { DAX_FUNCTIONS } from '../dax/functions';

export function daxSuggestions(): Suggestion[] {
  const m = store.project.model;
  const q = (t: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t) ? t : `'${t.replace(/'/g, "''")}'`);
  return [
    ...DAX_FUNCTIONS().map(f => ({ text: f, insert: f + '()', kind: 'function' })),
    ...m.measures.map(x => ({ text: `[${x.name}]`, kind: 'measure' })),
    ...m.tables.flatMap(t => [{ text: q(t.name), kind: 'table' }, ...t.columns.map(c => ({ text: `${q(t.name)}[${c.name}]`, kind: 'column' }))]),
    ...['VAR', 'RETURN', 'TRUE()', 'FALSE()', 'BLANK()', 'ASC', 'DESC', 'YEAR', 'MONTH', 'DAY', 'QUARTER'].map(k => ({ text: k, kind: 'keyword' })),
  ];
}

export function FormulaBar() {
  const s = useStore();
  const fm = s.ui.formula;
  const [err, setErr] = useState<string | null>(null);
  if (!fm) return null;
  const commit = () => { const e = commitFormula(); setErr(e); };
  return <div style={{ flexShrink: 0 }}>
    <div className="formula">
      <div className="fbtns">
        <button className="iconbtn" title="Cancel (Esc)" onClick={() => { setErr(null); s.setUI({ formula: null }); }}><I n="cancel" s={18} /></button>
        <button className="iconbtn" title="Commit (Enter)" onClick={commit}><I n="commit" s={18} /></button>
      </div>
      <div className="ed" onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !(document.querySelector('.ac'))) { e.preventDefault(); commit(); }
        if (e.key === 'Escape' && !(document.querySelector('.ac'))) { setErr(null); s.setUI({ formula: null }); }
      }}>
        <CodeEditor id="dax-formula" value={fm.text} onChange={t => s.setUI({ formula: { ...fm, text: t } })} lang="dax" suggestions={daxSuggestions} gutter={fm.text.includes('\n')} autoFocus minHeight={fm.text.split('\n').length > 1 ? Math.min(240, 22 * fm.text.split('\n').length + 12) : 34} />
      </div>
    </div>
    <div className="tiny" style={{ padding: '2px 10px', background: '#fff', borderBottom: '1px solid #e1dfdd' }}>
      {fm.kind === 'measure' ? 'Measure' : fm.kind === 'column' ? 'Calculated column' : fm.kind === 'calcitem' ? 'Calculation item' : 'Calculated table'} in <b>{fm.kind === 'table' ? 'model' : fm.table}</b>{fm.kind === 'calcitem' && <> · use SELECTEDMEASURE() for the measure in the visual</>} · Enter to commit · Shift+Enter for a new line · Esc to cancel
    </div>
    {err && <div className="formula"><div className="err" style={{ flex: 1 }}>{err}</div></div>}
  </div>;
}
