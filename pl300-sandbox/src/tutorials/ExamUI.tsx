// Practice exam (setup, timed runner, results with review) and the syllabus coverage table, shown as tabs of the tutorials home.
import React, { useEffect, useMemo, useState } from 'react';
import { I } from '../ui/icons';
import { AREAS, Area, TUTORIALS } from './content';
import { ExamQ, examBank, isCorrect, credit, SYLLABUS, WEIGHTS } from './exam';
import { startTutorial } from './TutorialUI';

const HKEY = 'pl300-sandbox-exams';
interface Attempt { at: number; score: number; n: number; areas: string[] }
function history(): Attempt[] { try { return JSON.parse(localStorage.getItem(HKEY) ?? '[]'); } catch { return []; } }
function saveAttempt(a: Attempt) { try { localStorage.setItem(HKEY, JSON.stringify([a, ...history()].slice(0, 20))); } catch { /* storage unavailable */ } }

function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Draws questions so each area's share follows the exam's weighting (midpoints of the published ranges).
function draw(bank: ExamQ[], areas: Area[], n: number): ExamQ[] {
  const w: Record<Area, number> = { 'Prepare the data': 27.5, 'Model the data': 27.5, 'Visualize and analyze the data': 27.5, 'Manage and secure Power BI': 17.5 };
  const total = areas.reduce((s, a) => s + w[a], 0);
  const pools = Object.fromEntries(areas.map(a => [a, shuffle(bank.filter(q => q.area === a))])) as Record<Area, ExamQ[]>;
  const out: ExamQ[] = [];
  for (const a of areas) out.push(...pools[a].splice(0, Math.round(n * w[a] / total)));
  const rest = shuffle(areas.flatMap(a => pools[a]));
  while (out.length < n && rest.length) out.push(rest.pop()!);
  return shuffle(out.slice(0, n));
}

const TYPE_NOTE: Record<ExamQ['type'], string> = {
  single: 'Choose one answer.',
  multi: 'Choose all that apply.',
  yesno: 'For each statement, select Yes or No.',
  order: 'Select the actions you need, in the correct order. Not every action is used.',
  dropdown: 'Select the correct option in each drop-down.',
};

type Resp = number | number[] | undefined;

function QuestionView({ q, r, set, reveal }: { q: ExamQ; r: Resp; set: (r: Resp) => void; reveal: boolean }) {
  // Order questions show their actions in a fixed shuffled order so the answer isn't given away.
  const orderPerm = useMemo(() => shuffle((q.options ?? []).map((_, i) => i)), [q.id]);
  const lock = reveal;
  const row = (ok: boolean | null) => ({ background: ok === null ? '#fff' : ok ? '#dff6dd' : '#fde7e9' });
  return <div className="exq">
    {q.scenario && <div className="scen"><b>Scenario.</b> {q.scenario}</div>}
    <p className="stem">{q.stem}</p>
    <div className="tiny" style={{ marginBottom: 8 }}>{TYPE_NOTE[q.type]}</div>
    {(q.type === 'single' || q.type === 'multi') && q.options!.map((o, j) => {
      const multi = q.type === 'multi';
      const picked = multi ? ((r as number[] | undefined) ?? []).includes(j) : r === j;
      const correct = multi ? (q.answer as number[]).includes(j) : q.answer === j;
      return <label key={j} className="opt" style={row(reveal ? (correct ? true : picked ? false : null) : null)}>
        <input type={multi ? 'checkbox' : 'radio'} name={q.id} checked={picked} disabled={lock}
          onChange={() => { if (!multi) set(j); else { const cur = (r as number[] | undefined) ?? []; set(cur.includes(j) ? cur.filter(x => x !== j) : [...cur, j]); } }} />
        <span><b>{String.fromCharCode(65 + j)}.</b> {o}</span>
      </label>;
    })}
    {q.type === 'yesno' && <table className="yn"><thead><tr><th>Statement</th><th>Yes</th><th>No</th></tr></thead><tbody>
      {q.options!.map((o, j) => {
        const cur = (r as number[] | undefined) ?? [];
        const ok = reveal ? cur[j] === (q.answer as number[])[j] : null;
        return <tr key={j} style={row(ok)}><td>{o}{reveal && ok === false && <span className="tiny"> (answer: {(q.answer as number[])[j] ? 'Yes' : 'No'})</span>}</td>
          {[1, 0].map(v => <td key={v} style={{ textAlign: 'center' }}><input type="radio" name={`${q.id}-${j}`} disabled={lock} checked={cur[j] === v} onChange={() => { const n = [...cur]; n[j] = v; set(n); }} aria-label={v ? 'Yes' : 'No'} /></td>)}
        </tr>;
      })}
    </tbody></table>}
    {q.type === 'order' && (() => {
      const seq = (r as number[] | undefined) ?? [];
      return <div className="ord">
        <div><div className="tiny" style={{ fontWeight: 600, marginBottom: 4 }}>Actions</div>
          {orderPerm.filter(i => !seq.includes(i)).map(i => <button key={i} className="opt" disabled={lock} onClick={() => set([...seq, i])}>{q.options![i]}</button>)}
        </div>
        <div><div className="tiny" style={{ fontWeight: 600, marginBottom: 4 }}>Answer area {seq.length > 0 && !lock && <button className="linkbtn" onClick={() => set([])}>Reset</button>}</div>
          {seq.length === 0 && <div className="tiny" style={{ padding: 8, border: '1px dashed var(--line-strong)', borderRadius: 4 }}>Click actions to add them here in order.</div>}
          {seq.map((i, k) => <button key={i} className="opt" disabled={lock} onClick={() => set(seq.filter(x => x !== i))} style={row(reveal ? (q.answer as number[])[k] === i : null)}><b>{k + 1}.</b> {q.options![i]}</button>)}
        </div>
        {reveal && !isCorrect(q, r) && <div className="tiny" style={{ gridColumn: '1 / -1' }}><b>Correct order:</b> {(q.answer as number[]).map((i, k) => `${k + 1}. ${q.options![i]}`).join('  ·  ')}</div>}
      </div>;
    })()}
    {q.type === 'dropdown' && q.blanks!.map((b, j) => {
      const cur = (r as number[] | undefined) ?? [];
      const ok = reveal ? cur[j] === b.answer : null;
      return <div key={j} className="dd" style={row(ok)}><span>{b.label}</span>
        <select className="tx" disabled={lock} value={cur[j] ?? ''} onChange={e => { const n = [...cur]; n[j] = +e.target.value; set(n); }}>
          <option value="" disabled>Select…</option>
          {b.options.map((o, k) => <option key={k} value={k}>{o}</option>)}
        </select>
        {reveal && ok === false && <span className="tiny">Answer: {b.options[b.answer]}</span>}
      </div>;
    })}
    {reveal && <div className={`expl ${isCorrect(q, r) ? 'ok' : ''}`}>
      <b>{isCorrect(q, r) ? 'Correct.' : r === undefined ? 'Not answered.' : credit(q, r) > 0 ? 'Partly correct.' : 'Incorrect.'}</b> {q.why}
      {q.lab && <div style={{ marginTop: 6 }}><TryIt id={q.lab} /></div>}
    </div>}
  </div>;
}

function TryIt({ id }: { id: string }) {
  const t = TUTORIALS.find(x => x.id === id);
  if (!t) return null;
  return <button className="btn sm" onClick={() => startTutorial(t)}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><I n="grad" s={14} />Practice it: {t.title}</span></button>;
}

export function PracticeExam() {
  const bank = useMemo(examBank, []);
  const [areas, setAreas] = useState<Area[]>([...AREAS]);
  const [count, setCount] = useState(50);
  const [mode, setMode] = useState<'exam' | 'study'>('exam');
  const [serviceOnly, setServiceOnly] = useState(false);
  const [qs, setQs] = useState<ExamQ[] | null>(null);
  const [resp, setResp] = useState<Record<string, Resp>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!qs || done) return; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, [qs, done]);
  const pool = serviceOnly ? bank.filter(q => !q.id.startsWith('t-')) : bank;
  const avail = pool.filter(q => areas.includes(q.area)).length;

  const start = () => {
    const n = Math.min(count, avail);
    setQs(draw(pool, areas, n)); setResp({}); setFlags(new Set()); setChecked(new Set()); setI(0); setDone(false);
    setDeadline(mode === 'exam' ? Date.now() + n * 2 * 60_000 : 0); setNow(Date.now());
  };
  const finish = () => {
    setDone(true);
    const sc = Math.round(1000 * qs!.reduce((s, q) => s + credit(q, resp[q.id]), 0) / qs!.length);
    saveAttempt({ at: Date.now(), score: sc, n: qs!.length, areas });
  };
  useEffect(() => { if (qs && !done && deadline && now >= deadline) finish(); }, [now]);

  if (!qs) {
    const hist = history();
    return <div className="exam-setup">
      <p>Questions in the formats the real exam uses: single and multiple choice, Yes/No statement series, ordering, and drop-down (hot area) questions, some with a short scenario. About half cover the Power BI service and features the sandbox can't run. Each one explains the answer and links to a lab where you can practice it.</p>
      <div className="row"><b>Skill areas</b><div className="areas" style={{ padding: 0 }}>{AREAS.map(a => <button key={a} className={`chip ${areas.includes(a) ? 'on' : ''}`} onClick={() => setAreas(areas.includes(a) ? areas.filter(x => x !== a) : [...areas, a])}>{a} · {WEIGHTS[a]}</button>)}</div></div>
      <div className="row"><b>Questions</b><div className="areas" style={{ padding: 0 }}>{[10, 25, 50].map(n => <button key={n} className={`chip ${count === n ? 'on' : ''}`} onClick={() => setCount(n)}>{n}</button>)}<button className={`chip ${count === 999 ? 'on' : ''}`} onClick={() => setCount(999)}>All ({avail})</button></div></div>
      <div className="row"><b>Mode</b><div className="areas" style={{ padding: 0 }}>
        <button className={`chip ${mode === 'exam' ? 'on' : ''}`} onClick={() => setMode('exam')}>Exam: timed, review at the end</button>
        <button className={`chip ${mode === 'study' ? 'on' : ''}`} onClick={() => setMode('study')}>Study: check each answer</button>
      </div></div>
      <label className="row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={serviceOnly} onChange={e => setServiceOnly(e.target.checked)} /> Only the exam bank (leave out the tutorial quiz questions)</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className="btn primary" disabled={!areas.length || !avail} onClick={start}>Start</button><span className="tiny">{Math.min(count, avail)} questions{mode === 'exam' ? ` · ${Math.min(count, avail) * 2} minutes` : ''} · pass mark 700 / 1000</span></div>
      <div className="tiny" style={{ marginTop: 10 }}>The real exam has about 40–60 questions in 100 minutes and is scored on a 1–1,000 scale with 700 to pass. Scores here are the share of points earned (Yes/No and drop-down items earn partial credit), so treat them as a guide.</div>
      {hist.length > 0 && <div style={{ marginTop: 14 }}><b>Recent attempts</b><table className="yn" style={{ marginTop: 6 }}><tbody>{hist.slice(0, 6).map((h, k) => <tr key={k}><td>{new Date(h.at).toLocaleString()}</td><td>{h.n} questions</td><td style={{ color: h.score >= 700 ? '#107c10' : '#a4262c', fontWeight: 600 }}>{h.score} {h.score >= 700 ? 'Pass' : 'Fail'}</td></tr>)}</tbody></table></div>}
    </div>;
  }

  if (done) {
    const sc = Math.round(1000 * qs.reduce((s, q) => s + credit(q, resp[q.id]), 0) / qs.length);
    const by = AREAS.filter(a => qs.some(q => q.area === a)).map(a => { const xs = qs.filter(q => q.area === a); return { a, pct: Math.round(100 * xs.reduce((s, q) => s + credit(q, resp[q.id]), 0) / xs.length), n: xs.length }; });
    return <div className="exam-setup">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}><span style={{ fontSize: 34, fontWeight: 700, color: sc >= 700 ? '#107c10' : '#a4262c' }}>{sc}</span><span style={{ fontSize: 16, fontWeight: 600 }}>{sc >= 700 ? 'Pass' : 'Below the pass mark'}</span><span className="tiny">700 needed · {qs.filter(q => isCorrect(q, resp[q.id])).length} of {qs.length} fully correct</span></div>
      <div className="bars">{by.map(b => <div key={b.a}><div className="tiny" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{b.a} ({b.n})</span><span>{b.pct}%</span></div><div className="bar"><span style={{ width: `${b.pct}%`, background: b.pct >= 70 ? '#107c10' : '#d83b01' }} /></div></div>)}</div>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}><button className="btn primary" onClick={start}>New exam</button><button className="btn" onClick={() => setQs(null)}>Change settings</button></div>
      <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>Review</h3>
      {qs.map((q, k) => <details key={q.id} className="rev" open={!isCorrect(q, resp[q.id])}>
        <summary><span className={`mk ${isCorrect(q, resp[q.id]) ? 'ok' : ''}`}>{isCorrect(q, resp[q.id]) ? '✓' : '✗'}</span> {k + 1}. <span className="tiny">{q.area} · {q.skill}</span></summary>
        <QuestionView q={q} r={resp[q.id]} set={() => {}} reveal />
      </details>)}
    </div>;
  }

  const q = qs[i];
  const left = deadline ? Math.max(0, deadline - now) : 0;
  const answered = qs.filter(x => resp[x.id] !== undefined).length;
  const revealed = mode === 'study' && checked.has(q.id);
  return <div className="exam-run">
    <div className="exam-bar">
      <b>Question {i + 1} of {qs.length}</b>
      <span className="tiny">{q.area}</span>
      <span style={{ flex: 1 }} />
      {deadline > 0 && <span className="tiny" style={{ fontVariantNumeric: 'tabular-nums', color: left < 5 * 60_000 ? '#a4262c' : undefined }}>Time left {Math.floor(left / 60000)}:{String(Math.floor(left / 1000) % 60).padStart(2, '0')}</span>}
      <button className={`chip ${flags.has(q.id) ? 'on' : ''}`} onClick={() => { const f = new Set(flags); f.has(q.id) ? f.delete(q.id) : f.add(q.id); setFlags(f); }}>{flags.has(q.id) ? 'Flagged' : 'Flag for review'}</button>
    </div>
    <div className="exam-nav">{qs.map((x, k) => <button key={x.id} onClick={() => setI(k)} className={`${k === i ? 'cur' : ''} ${resp[x.id] !== undefined ? 'ans' : ''} ${flags.has(x.id) ? 'flag' : ''}`} aria-label={`Question ${k + 1}`}>{k + 1}</button>)}</div>
    <div className="exam-body"><QuestionView key={q.id} q={q} r={resp[q.id]} set={r => setResp({ ...resp, [q.id]: r })} reveal={revealed} /></div>
    <div className="exam-foot">
      <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
      {mode === 'study' && !revealed && <button className="btn" disabled={resp[q.id] === undefined} onClick={() => setChecked(new Set(checked).add(q.id))}>Check answer</button>}
      <span className="tiny" style={{ flex: 1, textAlign: 'center' }}>{answered} answered{flags.size ? ` · ${flags.size} flagged` : ''}</span>
      {i < qs.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Next</button> : null}
      <button className={`btn ${i === qs.length - 1 ? 'primary' : ''}`} onClick={() => { if (answered < qs.length && !confirm(`${qs.length - answered} questions are unanswered. Finish anyway?`)) return; finish(); }}>Finish</button>
    </div>
  </div>;
}

export function SyllabusCoverage() {
  const bank = useMemo(examBank, []);
  const [only, setOnly] = useState(false);
  const label = { lab: 'Tutorial lab', sandbox: 'In the sandbox', study: 'Questions only' } as const;
  const counts = { lab: 0, sandbox: 0, study: 0 }; SYLLABUS.forEach(r => counts[r.cov]++);
  return <div className="exam-setup">
    <p>Each skill in the PL-300 outline (version of April 20, 2026), and where you can practice it. <b>Tutorial lab</b> has a guided exercise, <b>In the sandbox</b> works in the app without a dedicated lab, and <b>Questions only</b> needs the Power BI service, Fabric or a feature the sandbox doesn't run, so it's covered by practice-exam questions. {counts.lab} lab · {counts.sandbox} sandbox · {counts.study} questions only.</p>
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} />Show only skills the sandbox can't simulate</label>
    {AREAS.map(a => {
      const rows = SYLLABUS.filter(r => r.area === a && (!only || r.cov === 'study'));
      if (!rows.length) return null;
      return <div key={a} style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '6px 0', fontSize: 14 }}>{a} <span className="tiny">({WEIGHTS[a]})</span></h3>
        <table className="yn cov"><thead><tr><th>Skill</th><th>Coverage</th><th>Where</th><th>Exam-bank questions</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.skill}><td>{r.skill}<div className="tiny">{r.group}</div></td><td><span className={`cv ${r.cov}`}>{label[r.cov]}</span></td><td>{r.where}</td><td style={{ textAlign: 'right' }}>{bank.filter(q => q.skill === r.skill).length || ''}</td></tr>)}
        </tbody></table>
      </div>;
    })}
  </div>;
}
