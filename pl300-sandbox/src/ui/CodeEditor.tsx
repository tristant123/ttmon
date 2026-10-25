// Lightweight code editor: textarea over a highlighted <pre>, with IntelliSense-style completion.
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface Suggestion { text: string; insert?: string; kind: string }

const DAX_KW = /^(VAR|RETURN|IN|NOT|EVALUATE|DEFINE|MEASURE|ORDER|BY|ASC|DESC|START|AT|COLUMN|TABLE|TRUE|FALSE)$/i;
const M_KW = /^(let|in|if|then|else|each|and|or|not|try|otherwise|error|type|meta|is|as|true|false|null|optional|nullable)$/;

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function highlight(src: string, lang: 'dax' | 'm'): string {
  const re = lang === 'dax'
    ? /(--[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"]|"")*"?)|('(?:[^']|'')*'?)|(\[[^\]\n]*\]?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_.]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_.]*)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"]|"")*"?)|(#"(?:[^"]|"")*"?)|(\[[^\]\n]*\]?)|(\b\d+(?:\.\d+)?\b)|(#?[A-Za-z_][A-Za-z0-9_.]*)(?=\s*\()|(#?[A-Za-z_][A-Za-z0-9_.]*)/g;
  let out = ''; let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const [t] = m;
    let cls = '';
    if (m[1]) cls = 'tk-com';
    else if (m[2]) cls = 'tk-str';
    else if (m[3]) cls = lang === 'dax' ? 'tk-tbl' : 'tk-var';
    else if (m[4]) cls = 'tk-col';
    else if (m[5]) cls = 'tk-num';
    else if (m[6]) cls = 'tk-fn';
    else if (m[7]) cls = (lang === 'dax' ? DAX_KW : M_KW).test(t) ? 'tk-kw' : lang === 'dax' ? 'tk-tbl' : 'tk-var';
    out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
    last = m.index + t.length;
  }
  return out + esc(src.slice(last)) + '\n';
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  lang: 'dax' | 'm';
  suggestions?: () => Suggestion[];
  onRun?: () => void;
  gutter?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  id?: string;
}

export function CodeEditor({ value, onChange, lang, suggestions, onRun, gutter = true, autoFocus, minHeight, id }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  const gut = useRef<HTMLDivElement>(null);
  const [ac, setAc] = useState<{ items: Suggestion[]; sel: number; x: number; y: number; start: number } | null>(null);
  const html = useMemo(() => highlight(value, lang), [value, lang]);
  const lines = value.split('\n').length;
  useEffect(() => { if (autoFocus) ta.current?.focus(); }, [autoFocus]);

  const sync = () => {
    if (!ta.current || !pre.current) return;
    pre.current.scrollTop = ta.current.scrollTop; pre.current.scrollLeft = ta.current.scrollLeft;
    if (gut.current) gut.current.scrollTop = ta.current.scrollTop;
  };

  const updateAc = (text: string, caret: number) => {
    if (!suggestions) return;
    const before = text.slice(0, caret);
    const m = /(\[[^\]]*|'[^']*|#"[^"]*|[A-Za-z_#][A-Za-z0-9_.]*)$/.exec(before);
    if (!m || m[0].length < 1 || /["']$/.test(before.slice(0, -m[0].length)) && !m[0].startsWith("'")) { setAc(null); return; }
    const word = m[0];
    const q = word.replace(/^[[']|^#"/, '').toLowerCase();
    if (!q && !word.startsWith('[') && !word.startsWith("'")) { setAc(null); return; }
    const all = suggestions();
    const items = all.filter(s => {
      const t = s.text.toLowerCase();
      if (word.startsWith('[')) return s.kind !== 'function' && t.includes('[' + q);
      if (word.startsWith("'")) return t.startsWith("'" + q);
      return t.startsWith(q) || (q.length > 1 && t.includes(q));
    }).slice(0, 60);
    if (!items.length) { setAc(null); return; }
    const linesBefore = before.split('\n');
    const row = linesBefore.length - 1; const col = linesBefore[linesBefore.length - 1].length - word.length;
    const el = ta.current!;
    setAc({ items, sel: 0, x: 10 + col * 7.8 - el.scrollLeft, y: 8 + (row + 1) * 20.8 - el.scrollTop, start: caret - word.length });
  };

  const accept = (s: Suggestion) => {
    const el = ta.current!; const caret = el.selectionStart;
    const ins = s.insert ?? s.text;
    const next = value.slice(0, ac!.start) + ins + value.slice(caret);
    onChange(next);
    setAc(null);
    requestAnimationFrame(() => { const p = ac!.start + ins.length - (ins.endsWith('()') ? 1 : 0); el.selectionStart = el.selectionEnd = p; el.focus(); });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc({ ...ac, sel: Math.min(ac.items.length - 1, ac.sel + 1) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc({ ...ac, sel: Math.max(0, ac.sel - 1) }); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); accept(ac.items[ac.sel]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAc(null); return; }
    }
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') { e.preventDefault(); onRun?.(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget; const s = el.selectionStart, en = el.selectionEnd;
      const next = value.slice(0, s) + '    ' + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // keep indentation
      const el = e.currentTarget; const s = el.selectionStart;
      const line = value.slice(0, s).split('\n').pop() ?? '';
      const ind = /^\s*/.exec(line)![0];
      if (ind) { e.preventDefault(); const next = value.slice(0, s) + '\n' + ind + value.slice(el.selectionEnd); onChange(next); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 1 + ind.length; }); }
    }
  };

  return <div className="editor" style={{ minHeight }}>
    {gutter && <div className="gutter" ref={gut}>{Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>}
    <div className="area">
      <pre ref={pre} dangerouslySetInnerHTML={{ __html: html }} />
      <textarea ref={ta} id={id} value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        onChange={e => { onChange(e.target.value); updateAc(e.target.value, e.target.selectionStart); }}
        onScroll={sync} onKeyDown={onKey} onBlur={() => setTimeout(() => setAc(null), 150)} />
      {ac && <div className="ac" style={{ left: Math.max(4, ac.x), top: ac.y }}>
        {ac.items.map((s, i) => <div key={s.text + i} className={i === ac.sel ? 'on' : ''} onMouseDown={e => { e.preventDefault(); accept(s); }}>{s.text}<span>{s.kind}</span></div>)}
      </div>}
    </div>
  </div>;
}
