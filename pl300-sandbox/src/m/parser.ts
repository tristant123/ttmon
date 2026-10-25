// Parser for the Power Query formula language (M).
// Hand-written recursive descent over the raw source, because M's
// "generalized identifiers" ([Column Name With Spaces]) depend on context.

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'null' }
  | { k: 'id'; name: string }
  | { k: 'let'; binds: Bind[]; body: Node; bodyStart: number }
  | { k: 'if'; c: Node; t: Node; e: Node }
  | { k: 'fn'; params: Param[]; body: Node }
  | { k: 'each'; body: Node }
  | { k: 'call'; f: Node; args: Node[] }
  | { k: 'field'; target: Node | null; name: string; opt: boolean }
  | { k: 'proj'; target: Node | null; names: string[]; opt: boolean }
  | { k: 'item'; target: Node; index: Node; opt: boolean }
  | { k: 'rec'; fields: { name: string; expr: Node }[] }
  | { k: 'list'; items: { a: Node; b?: Node }[] }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'un'; op: string; e: Node }
  | { k: 'try'; e: Node; otherwise?: Node }
  | { k: 'err'; e: Node }
  | { k: 'type'; t: TypeExpr }
  | { k: 'meta'; e: Node; m: Node };

export interface Bind { name: string; expr: Node; start: number; end: number; nameStart: number }
export interface Param { name: string; optional: boolean; type?: string }
export type TypeExpr =
  | { t: 'prim'; name: string; nullable?: boolean }
  | { t: 'table'; cols: { name: string; type: TypeExpr }[] }
  | { t: 'record'; cols: { name: string; type: TypeExpr }[] }
  | { t: 'list'; item: TypeExpr }
  | { t: 'expr'; e: Node };

export class MSyntaxError extends Error {
  constructor(msg: string, public pos: number) { super(msg); }
}

const KEYWORDS = new Set(['let', 'in', 'if', 'then', 'else', 'each', 'and', 'or', 'not', 'try', 'otherwise', 'error', 'type', 'meta', 'is', 'as', 'true', 'false', 'null', 'section', 'shared', 'catch']);
const PRIM_TYPES = new Set(['any', 'anynonnull', 'binary', 'date', 'datetime', 'datetimezone', 'duration', 'function', 'list', 'logical', 'none', 'null', 'number', 'record', 'table', 'text', 'time', 'type']);

type Tok = { t: 'id' | 'qid' | 'num' | 'str' | 'op' | 'eof'; v: string; s: number; e: number };

export class Parser {
  pos = 0;
  constructor(public src: string) {}

  static parse(src: string): Node {
    const p = new Parser(src);
    const n = p.expr();
    const t = p.peek();
    if (t.t !== 'eof') throw new MSyntaxError(`Token Eof expected. Found '${t.v}'.`, t.s);
    return n;
  }

  // ---------- lexing ----------
  skipWs() {
    const s = this.src;
    for (;;) {
      while (this.pos < s.length && /\s/.test(s[this.pos])) this.pos++;
      if (s.startsWith('//', this.pos)) { while (this.pos < s.length && s[this.pos] !== '\n') this.pos++; continue; }
      if (s.startsWith('/*', this.pos)) { const e = s.indexOf('*/', this.pos + 2); this.pos = e < 0 ? s.length : e + 2; continue; }
      break;
    }
  }

  lex(): Tok {
    this.skipWs();
    const s = this.src, st = this.pos;
    if (st >= s.length) return { t: 'eof', v: '<eof>', s: st, e: st };
    const c = s[st];
    if (c === '"') return { t: 'str', v: this.readString(), s: st, e: this.pos };
    if (c === '#' && s[st + 1] === '"') { this.pos++; return { t: 'qid', v: this.readString(), s: st, e: this.pos }; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[st + 1] || '') && s[st + 1] !== '.')) {
      const m = /^(0[xX][0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(s.slice(st))!;
      // "1..10" — don't swallow the first dot of a range
      let txt = m[0];
      if (txt.endsWith('.') && s[st + txt.length] === '.') txt = txt.slice(0, -1);
      this.pos = st + txt.length;
      return { t: 'num', v: txt, s: st, e: this.pos };
    }
    if (/[A-Za-z_#@]/.test(c)) {
      const m = /^[@#]?[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(s.slice(st));
      if (m) { this.pos = st + m[0].length; return { t: 'id', v: m[0], s: st, e: this.pos }; }
    }
    const ops = ['...', '..', '=>', '<=', '>=', '<>', '??', '=', '<', '>', '+', '-', '*', '/', '&', '(', ')', '[', ']', '{', '}', ',', ';', '?', '!'];
    for (const o of ops) if (s.startsWith(o, st)) { this.pos = st + o.length; return { t: 'op', v: o, s: st, e: this.pos }; }
    throw new MSyntaxError(`Invalid character '${c}'.`, st);
  }

  readString(): string {
    const s = this.src; let out = ''; this.pos++; // opening quote
    for (;;) {
      if (this.pos >= s.length) throw new MSyntaxError('Unterminated string literal.', this.pos);
      const c = s[this.pos];
      if (c === '"') {
        if (s[this.pos + 1] === '"') { out += '"'; this.pos += 2; continue; }
        this.pos++; return out;
      }
      if (c === '#' && s[this.pos + 1] === '(') {
        const e = s.indexOf(')', this.pos);
        const codes = s.slice(this.pos + 2, e).split(',').map(x => x.trim());
        const map: Record<string, string> = { cr: '\r', lf: '\n', tab: '\t', '#': '#' };
        if (codes.every(x => map[x] !== undefined || /^[0-9A-Fa-f]{4}$/.test(x))) {
          for (const x of codes) out += map[x] ?? String.fromCharCode(parseInt(x, 16));
          this.pos = e + 1; continue;
        }
      }
      out += c; this.pos++;
    }
  }

  peek(): Tok { const p = this.pos; const t = this.lex(); this.pos = p; return t; }
  next(): Tok { return this.lex(); }
  isOp(v: string) { const t = this.peek(); return t.t === 'op' && t.v === v; }
  isKw(v: string) { const t = this.peek(); return t.t === 'id' && t.v === v; }
  eatOp(v: string) { if (this.isOp(v)) { this.next(); return true; } return false; }
  eatKw(v: string) { if (this.isKw(v)) { this.next(); return true; } return false; }
  expectOp(v: string) {
    const t = this.next();
    if (t.t !== 'op' || t.v !== v) throw new MSyntaxError(`Token '${v}' expected${t.t === 'eof' ? '' : `, found '${t.v}'`}.`, t.s);
  }
  expectKw(v: string) {
    const t = this.next();
    if (t.t !== 'id' || t.v !== v) throw new MSyntaxError(`Token '${v}' expected${t.t === 'eof' ? '' : `, found '${t.v}'`}.`, t.s);
  }

  /** Reads a generalized identifier (field name) or #"quoted" one. */
  fieldName(stops: string): string {
    this.skipWs();
    if (this.src.startsWith('#"', this.pos)) { this.pos++; return this.readString(); }
    if (this.src[this.pos] === '"') return this.readString();
    const st = this.pos;
    while (this.pos < this.src.length && !stops.includes(this.src[this.pos])) this.pos++;
    const name = this.src.slice(st, this.pos).trim();
    if (!name) throw new MSyntaxError('Field name expected.', st);
    return name;
  }

  // ---------- grammar ----------
  expr(): Node {
    const t = this.peek();
    if (t.t === 'id') {
      switch (t.v) {
        case 'let': return this.letExpr();
        case 'if': {
          this.next(); const c = this.expr(); this.expectKw('then'); const th = this.expr(); this.expectKw('else');
          return { k: 'if', c, t: th, e: this.expr() };
        }
        case 'each': this.next(); return { k: 'each', body: this.expr() };
        case 'try': {
          this.next(); const e = this.expr();
          if (this.eatKw('otherwise')) return { k: 'try', e, otherwise: this.expr() };
          return { k: 'try', e };
        }
        case 'error': this.next(); return { k: 'err', e: this.expr() };
      }
    }
    if (t.t === 'op' && t.v === '(' && this.looksLikeFn()) return this.fnExpr();
    return this.logicalOr();
  }

  letExpr(): Node {
    this.expectKw('let');
    const binds: Bind[] = [];
    for (;;) {
      this.skipWs();
      const nameStart = this.pos;
      const nt = this.next();
      if (nt.t !== 'id' && nt.t !== 'qid') throw new MSyntaxError('Identifier expected in let.', nt.s);
      this.expectOp('=');
      this.skipWs();
      const start = this.pos;
      const expr = this.expr();
      binds.push({ name: nt.v, expr, start, end: this.pos, nameStart });
      if (this.eatOp(',')) continue;
      break;
    }
    this.expectKw('in');
    this.skipWs();
    const bodyStart = this.pos;
    return { k: 'let', binds, body: this.expr(), bodyStart };
  }

  looksLikeFn(): boolean {
    // scan to matching ')' then check for '=>' or 'as ... =>'
    const save = this.pos;
    try {
      this.next(); let depth = 1;
      while (depth > 0) {
        const t = this.next();
        if (t.t === 'eof') return false;
        if (t.t === 'op' && (t.v === '(' || t.v === '[' || t.v === '{')) depth++;
        if (t.t === 'op' && (t.v === ')' || t.v === ']' || t.v === '}')) depth--;
      }
      let t = this.next();
      if (t.t === 'id' && t.v === 'as') {
        t = this.next();
        if (t.t === 'id' && t.v === 'nullable') t = this.next();
        t = this.next();
      }
      return t.t === 'op' && t.v === '=>';
    } catch { return false; } finally { this.pos = save; }
  }

  fnExpr(): Node {
    this.expectOp('(');
    const params: Param[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        let optional = false;
        if (this.isKw('optional')) { this.next(); optional = true; }
        const nt = this.next();
        if (nt.t !== 'id' && nt.t !== 'qid') throw new MSyntaxError('Parameter name expected.', nt.s);
        let type: string | undefined;
        if (this.eatKw('as')) { this.eatKw('nullable'); type = this.next().v; }
        params.push({ name: nt.v, optional, type });
        if (!this.eatOp(',')) break;
      }
    }
    this.expectOp(')');
    if (this.eatKw('as')) { this.eatKw('nullable'); this.next(); }
    this.expectOp('=>');
    return { k: 'fn', params, body: this.expr() };
  }

  logicalOr(): Node {
    let l = this.logicalAnd();
    while (this.isKw('or')) { this.next(); l = { k: 'bin', op: 'or', l, r: this.logicalAnd() }; }
    if (this.isOp('??')) { this.next(); l = { k: 'bin', op: '??', l, r: this.logicalOr() }; }
    return l;
  }
  logicalAnd(): Node {
    let l = this.isExpr();
    while (this.isKw('and')) { this.next(); l = { k: 'bin', op: 'and', l, r: this.isExpr() }; }
    return l;
  }
  isExpr(): Node {
    let l = this.asExpr();
    while (this.isKw('is')) { this.next(); l = { k: 'bin', op: 'is', l, r: { k: 'type', t: this.primTypeExpr() } }; }
    return l;
  }
  asExpr(): Node {
    let l = this.equality();
    while (this.isKw('as')) { this.next(); l = { k: 'bin', op: 'as', l, r: { k: 'type', t: this.primTypeExpr() } }; }
    return l;
  }
  equality(): Node {
    let l = this.relational();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '=' || t.v === '<>')) { this.next(); l = { k: 'bin', op: t.v, l, r: this.relational() }; }
      else return l;
    }
  }
  relational(): Node {
    let l = this.additive();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ['<', '>', '<=', '>='].includes(t.v)) { this.next(); l = { k: 'bin', op: t.v, l, r: this.additive() }; }
      else return l;
    }
  }
  additive(): Node {
    let l = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ['+', '-', '&'].includes(t.v)) { this.next(); l = { k: 'bin', op: t.v, l, r: this.multiplicative() }; }
      else return l;
    }
  }
  multiplicative(): Node {
    let l = this.metaExpr();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '*' || t.v === '/')) { this.next(); l = { k: 'bin', op: t.v, l, r: this.metaExpr() }; }
      else return l;
    }
  }
  metaExpr(): Node {
    const e = this.unary();
    if (this.isKw('meta')) { this.next(); return { k: 'meta', e, m: this.unary() }; }
    return e;
  }
  unary(): Node {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+')) { this.next(); return { k: 'un', op: t.v, e: this.unary() }; }
    if (t.t === 'id' && t.v === 'not') { this.next(); return { k: 'un', op: 'not', e: this.unary() }; }
    if (t.t === 'id' && t.v === 'type') { this.next(); return { k: 'type', t: this.typeExpr() }; }
    return this.postfix(this.primary());
  }

  primary(): Node {
    const t = this.peek();
    if (t.t === 'num') { this.next(); return { k: 'num', v: Number(t.v) }; }
    if (t.t === 'str') { this.next(); return { k: 'str', v: t.v }; }
    if (t.t === 'qid') { this.next(); return { k: 'id', name: t.v }; }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') { this.next(); return { k: 'bool', v: t.v === 'true' }; }
      if (t.v === 'null') { this.next(); return { k: 'null' }; }
      if (KEYWORDS.has(t.v) && !['let', 'if', 'each', 'try', 'error'].includes(t.v)) throw new MSyntaxError(`Unexpected keyword '${t.v}'.`, t.s);
      if (['let', 'if', 'each', 'try', 'error'].includes(t.v)) return this.expr();
      this.next();
      return { k: 'id', name: t.v.startsWith('@') ? t.v.slice(1) : t.v };
    }
    if (t.t === 'op') {
      if (t.v === '(') {
        if (this.looksLikeFn()) return this.fnExpr();
        this.next(); const e = this.expr(); this.expectOp(')'); return e;
      }
      if (t.v === '{') return this.listExpr();
      if (t.v === '[') return this.bracket(null);
      if (t.v === '...') { this.next(); return { k: 'err', e: { k: 'str', v: 'Not implemented' } }; }
    }
    throw new MSyntaxError(t.t === 'eof' ? 'Unexpected end of expression.' : `Unexpected token '${t.v}'.`, t.s);
  }

  listExpr(): Node {
    this.expectOp('{');
    const items: { a: Node; b?: Node }[] = [];
    if (!this.isOp('}')) {
      for (;;) {
        const a = this.expr();
        if (this.eatOp('..')) items.push({ a, b: this.expr() }); else items.push({ a });
        if (!this.eatOp(',')) break;
      }
    }
    this.expectOp('}');
    return { k: 'list', items };
  }

  /** '[' … ']' — a record literal, an implicit field access, or a projection. */
  bracket(target: Node | null): Node {
    this.skipWs();
    const st = this.pos; // at '['
    this.pos++;
    this.skipWs();
    if (this.src[this.pos] === ']') {
      this.pos++;
      if (target) throw new MSyntaxError('Field name expected.', st);
      return { k: 'rec', fields: [] };
    }
    if (this.src[this.pos] === '[') {
      // projection [[a],[b]]
      const names: string[] = [];
      for (;;) {
        this.skipWs(); if (this.src[this.pos] !== '[') throw new MSyntaxError("'[' expected.", this.pos);
        this.pos++; names.push(this.fieldName(']')); this.skipWs(); this.pos++;
        this.skipWs();
        if (this.src[this.pos] === ',') { this.pos++; continue; }
        break;
      }
      this.skipWs(); if (this.src[this.pos] !== ']') throw new MSyntaxError("']' expected.", this.pos);
      this.pos++;
      const opt = this.optMark();
      return { k: 'proj', target, names, opt };
    }
    if (!target && this.isRecordLiteral(st)) {
      this.pos = st + 1;
      const fields: { name: string; expr: Node }[] = [];
      for (;;) {
        const name = this.fieldName('=');
        this.expectOp('=');
        fields.push({ name, expr: this.expr() });
        if (this.eatOp(',')) continue;
        break;
      }
      this.expectOp(']');
      return { k: 'rec', fields };
    }
    const name = this.fieldName(']');
    this.skipWs(); this.pos++; // ]
    return { k: 'field', target, name, opt: this.optMark() };
  }

  optMark() { const p = this.pos; this.skipWs(); if (this.src[this.pos] === '?' && this.src[this.pos + 1] !== '?') { this.pos++; return true; } this.pos = p; return false; }

  isRecordLiteral(st: number): boolean {
    // record when an '=' (not '=>') appears before the matching ']'
    const s = this.src; let depth = 0;
    for (let i = st; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { i++; while (i < s.length && !(s[i] === '"' && s[i + 1] !== '"')) { if (s[i] === '"') i++; i++; } continue; }
      if (c === '[' || c === '(' || c === '{') depth++;
      else if (c === ']' || c === ')' || c === '}') { depth--; if (depth === 0) return false; }
      else if (c === '=' && depth === 1 && s[i + 1] !== '>' && s[i - 1] !== '<' && s[i - 1] !== '>') return true;
    }
    return false;
  }

  postfix(n: Node): Node {
    for (;;) {
      const p = this.pos; this.skipWs();
      const c = this.src[this.pos];
      if (c === '(') {
        this.pos++;
        const args: Node[] = [];
        if (!this.isOp(')')) { for (;;) { args.push(this.expr()); if (!this.eatOp(',')) break; } }
        this.expectOp(')');
        n = { k: 'call', f: n, args };
      } else if (c === '[') {
        n = this.bracket(n);
      } else if (c === '{') {
        this.pos++;
        const index = this.expr();
        this.expectOp('}');
        n = { k: 'item', target: n, index, opt: this.optMark() };
      } else { this.pos = p; return n; }
    }
  }

  primTypeExpr(): TypeExpr {
    let nullable = false;
    if (this.eatKw('nullable')) nullable = true;
    const t = this.next();
    if (t.t === 'id' && PRIM_TYPES.has(t.v)) return { t: 'prim', name: t.v, nullable };
    if (t.t === 'id') return { t: 'expr', e: { k: 'id', name: t.v } };
    throw new MSyntaxError('Type name expected.', t.s);
  }

  typeExpr(): TypeExpr {
    if (this.eatKw('nullable')) { const inner = this.typeExpr(); if (inner.t === 'prim') inner.nullable = true; return inner; }
    const t = this.peek();
    if (t.t === 'id' && t.v === 'table') {
      this.next();
      this.skipWs();
      if (this.src[this.pos] === '[') return { t: 'table', cols: this.typeFields() };
      if (this.isKw('type')) { this.next(); const r = this.typeExpr(); return r.t === 'record' ? { t: 'table', cols: r.cols } : r; }
      return { t: 'prim', name: 'table' };
    }
    if (t.t === 'op' && t.v === '[') return { t: 'record', cols: this.typeFields() };
    if (t.t === 'op' && t.v === '{') { this.next(); const item = this.typeExpr(); this.expectOp('}'); return { t: 'list', item }; }
    if (t.t === 'id' && PRIM_TYPES.has(t.v)) { this.next(); return { t: 'prim', name: t.v }; }
    if (t.t === 'id' && t.v === 'function') { this.next(); this.skipParens(); return { t: 'prim', name: 'function' }; }
    return { t: 'expr', e: this.postfix(this.primary()) };
  }

  skipParens() {
    this.skipWs(); if (this.src[this.pos] !== '(') return;
    let depth = 0;
    do { const c = this.src[this.pos++]; if (c === '(') depth++; if (c === ')') depth--; } while (depth > 0 && this.pos < this.src.length);
    if (this.eatKw('as')) this.typeExpr();
  }

  typeFields(): { name: string; type: TypeExpr }[] {
    this.expectOp('[');
    const cols: { name: string; type: TypeExpr }[] = [];
    this.skipWs();
    if (this.src[this.pos] === ']') { this.pos++; return cols; }
    for (;;) {
      this.eatKw('optional');
      const name = this.fieldName('=,]');
      let type: TypeExpr = { t: 'prim', name: 'any' };
      if (this.eatOp('=')) type = this.typeExpr();
      cols.push({ name, type });
      if (this.eatOp(',')) continue;
      break;
    }
    this.expectOp(']');
    return cols;
  }
}

// ---------- helpers for the Applied Steps model ----------

/** Quote a name the way Power Query writes step and column identifiers. */
export function mId(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name) && !KEYWORDS.has(name) ? name : `#"${name.replace(/"/g, '""')}"`;
}
export function mStr(s: string) { return `"${s.replace(/"/g, '""').replace(/\r/g, '#(cr)').replace(/\n/g, '#(lf)').replace(/\t/g, '#(tab)')}"`; }
export function mField(name: string) { return /^[^\]\[#"=,]+$/.test(name) && name.trim() === name && name ? `[${name}]` : `[#"${name.replace(/"/g, '""')}"]`; }

export interface Step { name: string; code: string }

/** Split a query's `let … in …` expression into Applied Steps. */
export function splitSteps(code: string): { steps: Step[]; result: string } | null {
  let node: Node;
  try { node = Parser.parse(code); } catch { return null; }
  if (node.k !== 'let') return null;
  const steps = node.binds.map(b => ({ name: b.name, code: code.slice(b.start, b.end).trim() }));
  return { steps, result: code.slice(node.bodyStart).trim() };
}

export function joinSteps(steps: Step[], result?: string): string {
  if (!steps.length) return 'let\nin\n    null';
  const body = steps.map(s => `    ${mId(s.name)} = ${s.code.replace(/\n/g, '\n    ')}`).join(',\n');
  return `let\n${body}\nin\n    ${result ?? mId(steps[steps.length - 1].name)}`;
}
