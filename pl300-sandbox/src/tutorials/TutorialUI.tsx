// Tutorials home (grid by exam skill area) and the floating step-by-step panel with live checks and a quiz.
import React, { useEffect, useState } from 'react';
import { useStore, store } from '../store';
import { I } from '../ui/icons';
import { TUTORIALS, AREAS, Tutorial } from './content';

const KEY = 'pl300-sandbox-tutorials';
function progress(): Record<string, { done?: boolean; quiz?: number }> { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } }
function saveProgress(id: string, patch: { done?: boolean; quiz?: number }) { try { const p = progress(); p[id] = { ...p[id], ...patch }; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

export async function startTutorial(t: Tutorial) {
  store.setUI({ showTutorials: false, tutorial: null, pq: null, dialogs: [], backstage: false });
  try { await t.setup(); } catch (e) { store.toast(`Couldn't load the tutorial data: ${(e as Error).message}`, 'error'); }
  store.setUI({ tutorial: { id: t.id, step: 0 } });
}

export function TutorialHome() {
  const s = useStore();
  const [area, setArea] = useState<string>('All');
  const [busy, setBusy] = useState<string | null>(null);
  const prog = progress();
  const list = TUTORIALS.filter(t => area === 'All' || t.area === area);
  const done = TUTORIALS.filter(t => prog[t.id]?.done).length;
  return <div className="tut-home" onMouseDown={e => { if (e.target === e.currentTarget) s.setUI({ showTutorials: false }); }}>
    <div className="box" role="dialog" aria-label="PL-300 tutorials">
      <div className="top">
        <div>
          <h2>PL-300 tutorials</h2>
          <div className="subtle">Hands-on labs for each skill area of the Power BI Data Analyst exam. Each one loads its own sample data into a fresh report, checks your work as you go, and ends with exam-style questions. {done}/{TUTORIALS.length} completed.</div>
        </div>
        <button className="iconbtn" onClick={() => s.setUI({ showTutorials: false })} aria-label="Close"><I n="close" s={16} /></button>
      </div>
      <div className="areas">
        {['All', ...AREAS].map(a => <button key={a} className={`chip ${area === a ? 'on' : ''}`} onClick={() => setArea(a)}>{a}{a !== 'All' && ` (${TUTORIALS.filter(t => t.area === a).length})`}</button>)}
      </div>
      <div className="warnbox" style={{ margin: '0 24px 10px' }}>Starting a tutorial replaces the current report. Save it first (File › Save) if you want to keep it.</div>
      <div className="tut-grid">
        {list.map(t => <button key={t.id} className="tcard" disabled={!!busy} onClick={async () => { setBusy(t.id); await startTutorial(t); setBusy(null); }}>
          <span className="area">{t.area}</span>
          <h4>{t.title}</h4>
          <p>{t.summary}</p>
          <span className="meta">{prog[t.id]?.done && <><span className="done-dot" />Completed ·</>} {t.steps.length} steps · {t.quiz.length} questions · ~{t.minutes} min{busy === t.id ? ' · loading…' : ''}</span>
        </button>)}
      </div>
    </div>
  </div>;
}

export function TutorialPanel() {
  const s = useStore();
  const tu = s.ui.tutorial!;
  const t = TUTORIALS.find(x => x.id === tu.id)!;
  const [checks, setChecks] = useState<boolean[]>([]);
  const [min, setMin] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const inQuiz = tu.step >= t.steps.length;
  useEffect(() => {
    const h = setTimeout(() => setChecks(t.steps.map(st => { try { return st.check ? !!st.check() : false; } catch { return false; } })), 350);
    return () => clearTimeout(h);
  }, [s.version, t]);
  const step = t.steps[tu.step];
  const go = (n: number) => s.setUI({ tutorial: { ...tu, step: Math.max(0, Math.min(t.steps.length, n)) } });
  if (min) return <button className="btn yellow" style={{ position: 'fixed', right: 16, bottom: 36, zIndex: 80 }} onClick={() => setMin(false)}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="grad" s={16} />{t.title} · step {Math.min(tu.step + 1, t.steps.length)}/{t.steps.length}</span></button>;
  const score = Object.entries(answers).filter(([i, a]) => t.quiz[+i].answer === a).length;
  return <div className="tut-panel" role="complementary" aria-label="Tutorial">
    <div className="tut-h">
      <I n="grad" s={20} />
      <div style={{ flex: 1, minWidth: 0 }}><div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{t.area}</div><h3>{t.title}</h3></div>
      <button className="iconbtn" title="Minimize" onClick={() => setMin(true)}><I n="chevronDown" s={14} /></button>
      <button className="iconbtn" title="Close tutorial" onClick={() => s.setUI({ tutorial: null })}><I n="close" s={14} /></button>
    </div>
    <div style={{ display: 'flex', gap: 3, padding: '8px 14px 0' }}>
      {t.steps.map((st, i) => <button key={i} title={st.title} onClick={() => go(i)} style={{ flex: 1, height: 5, border: 0, borderRadius: 3, padding: 0, background: checks[i] ? '#107c10' : i === tu.step ? '#252423' : '#e1dfdd' }} />)}
      <button title="Exam questions" onClick={() => go(t.steps.length)} style={{ flex: 1, height: 5, border: 0, borderRadius: 3, padding: 0, background: inQuiz ? '#f2c811' : '#fff4ce' }} />
    </div>
    <div className="tut-b">
      {!inQuiz ? <>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{tu.step + 1}. {step.title}</div>
        <div dangerouslySetInnerHTML={{ __html: step.html }} />
        {step.check && <div className={`check ${checks[tu.step] ? 'ok' : ''}`}><span className="mk">{checks[tu.step] ? '✓' : ''}</span><span>{checks[tu.step] ? 'Done. Nice work.' : 'Waiting for you to complete this step…'}</span></div>}
      </> : <>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Exam-style questions</div>
        {t.quiz.map((qz, i) => <div key={i} style={{ marginBottom: 12 }}>
          <p><b>{i + 1}.</b> {qz.q}</p>
          {qz.options.map((o, j) => {
            const picked = answers[i] === j; const shown = answers[i] !== undefined;
            const bg = shown && j === qz.answer ? '#dff6dd' : picked ? '#fde7e9' : '#fff';
            return <button key={j} onClick={() => { if (answers[i] === undefined) { const na = { ...answers, [i]: j }; setAnswers(na); if (Object.keys(na).length === t.quiz.length) { saveProgress(t.id, { done: true, quiz: Object.entries(na).filter(([k, a]) => t.quiz[+k].answer === a).length }); } } }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', margin: '3px 0', border: '1px solid #e1dfdd', borderRadius: 4, background: bg }}>{String.fromCharCode(65 + j)}. {o}</button>;
          })}
          {answers[i] !== undefined && <div className="tiny" style={{ color: '#252423', marginTop: 4 }}><b>{answers[i] === qz.answer ? 'Correct.' : `Answer: ${String.fromCharCode(65 + qz.answer)}.`}</b> {qz.why}</div>}
        </div>)}
        {Object.keys(answers).length === t.quiz.length && <div className="info">You scored {score}/{t.quiz.length}. <button className="btn sm" onClick={() => s.setUI({ showTutorials: true, tutorial: null })}>Next tutorial</button></div>}
      </>}
    </div>
    <div className="tut-f">
      <button className="btn sm" disabled={tu.step === 0} onClick={() => go(tu.step - 1)}>Back</button>
      <span className="tiny" style={{ flex: 1, textAlign: 'center' }}>{inQuiz ? 'Questions' : `Step ${tu.step + 1} of ${t.steps.length}`}</span>
      {!inQuiz ? <button className="btn sm primary" onClick={() => go(tu.step + 1)}>{tu.step === t.steps.length - 1 ? 'Exam questions' : 'Next'}</button> : <button className="btn sm" onClick={() => s.setUI({ showTutorials: true, tutorial: null })}>All tutorials</button>}
    </div>
  </div>;
}
