// DAX lexer and parser (expressions plus DAX queries: DEFINE / EVALUATE / ORDER BY).

export type DNode =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'col'; table?: string; col: string }     // 'Table'[Column] or [Column]/[Measure]
  | { k: 'name'; name: string }                   // bare identifier: table name or variable
  | { k: 'call'; fn: string; args: DNode[] }
  | { k: 'bin'; op: string; l: DNode; r: DNode }
  | { k: 'un'; op: string; e: DNode }
  | { k: 'var'; vars: { name: string; expr: DNode }[]; ret: DNode }
  | { k: 'tc'; rows: DNode[][] }                  // table constructor { … }
  | { k: 'empty' };                               // omitted argument, e.g. DATEADD(x,,) or blank in IF(a,,b)

export interface DaxQuery {
  defines: { kind: 'MEASURE' | 'VAR' | 'COLUMN' | 'TABLE'; table?: string; name: string; expr: DNode }[];
  evaluates: { expr: DNode; orderBy: { expr: DNode; desc: boolean }[] }[];
}

export class DaxSyntaxError extends Error {
  constructor(msg: string, public pos: number) { super(msg); }
}

type Tok = { t: 'num' | 'str' | 'id' | 'qtbl' | 'br' | 'op' | 'eof'; v: string; s: number };

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('--', i) || src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    const s = i;
    if (c === '"') {
      let v = ''; i++;
      for (;;) {
        if (i >= src.length) throw new DaxSyntaxError('Unterminated string.', s);
        if (src[i] === '"') { if (src[i + 1] === '"') { v += '"'; i += 2; continue; } i++; break; }
        v += src[i++];
      }
      out.push({ t: 'str', v, s }); continue;
    }
    if (c === "'") {
      let v = ''; i++;
      for (;;) {
        if (i >= src.length) throw new DaxSyntaxError('Unterminated table name.', s);
        if (src[i] === "'") { if (src[i + 1] === "'") { v += "'"; i += 2; continue; } i++; break; }
        v += src[i++];
      }
      out.push({ t: 'qtbl', v, s }); continue;
    }
    if (c === '[') {
      let v = ''; i++;
      for (;;) {
        if (i >= src.length) throw new DaxSyntaxError('Unterminated column reference.', s);
        if (src[i] === ']') { if (src[i + 1] === ']') { v += ']'; i += 2; continue; } i++; break; }
        v += src[i++];
      }
      out.push({ t: 'br', v: v.trim(), s }); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: m[0], s }); i += m[0].length; continue;
    }
    if (/[A-Za-z_À-￿]/.test(c)) {
      const m = /^[A-Za-z_À-￿][A-Za-z0-9_.À-￿]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0], s }); i += m[0].length; continue;
    }
    const ops = ['&&', '||', '<=', '>=', '<>', '==', '=', '<', '>', '+', '-', '*', '/', '^', '&', '(', ')', '{', '}', ','];
    const o = ops.find(x => src.startsWith(x, i));
    if (!o) throw new DaxSyntaxError(`Unexpected character '${c}'.`, i);
    out.push({ t: 'op', v: o, s }); i += o.length;
  }
  out.push({ t: 'eof', v: '', s: src.length });
  return out;
}

const KW = new Set(['VAR', 'RETURN', 'IN', 'NOT', 'DEFINE', 'EVALUATE', 'ORDER', 'BY', 'ASC', 'DESC', 'MEASURE', 'START', 'AT', 'COLUMN', 'TABLE']);

export class DaxParser {
  i = 0;
  constructor(public toks: Tok[]) {}

  static expr(src: string): DNode {
    const p = new DaxParser(lex(src));
    // tolerate a leading '=' (as typed in the formula bar: "Total = SUM(...)" is handled by the caller)
    const e = p.expression();
    if (p.peek().t !== 'eof') throw new DaxSyntaxError(`The syntax for '${p.peek().v}' is incorrect.`, p.peek().s);
    return e;
  }

  static query(src: string): DaxQuery {
    const p = new DaxParser(lex(src));
    const q: DaxQuery = { defines: [], evaluates: [] };
    if (p.kw('DEFINE')) {
      p.next();
      for (;;) {
        if (p.kw('MEASURE') || p.kw('COLUMN')) {
          const kind = p.next().v.toUpperCase() as 'MEASURE' | 'COLUMN';
          const t = p.next();
          let table: string | undefined; let name: string;
          if (t.t === 'br') name = t.v;
          else { table = t.v; const b = p.next(); if (b.t !== 'br') throw new DaxSyntaxError('Expected [Name] after the table name.', b.s); name = b.v; }
          p.expectOp('=');
          q.defines.push({ kind, table, name, expr: p.expression() });
        } else if (p.kw('VAR') || p.kw('TABLE')) {
          const kind = p.next().v.toUpperCase() as 'VAR' | 'TABLE';
          const n = p.next(); p.expectOp('=');
          q.defines.push({ kind, name: n.v, expr: p.expression() });
        } else break;
      }
    }
    while (p.kw('EVALUATE')) {
      p.next();
      const expr = p.expression();
      const orderBy: { expr: DNode; desc: boolean }[] = [];
      if (p.kw('ORDER')) {
        p.next(); if (!p.kw('BY')) throw new DaxSyntaxError('Expected BY after ORDER.', p.peek().s); p.next();
        for (;;) {
          const e = p.expression(); let desc = false;
          if (p.kw('DESC')) { p.next(); desc = true; } else if (p.kw('ASC')) p.next();
          orderBy.push({ expr: e, desc });
          if (!p.isOp(',')) break; p.next();
        }
      }
      if (p.kw('START')) { p.next(); p.next(); while (p.peek().t !== 'eof' && !p.kw('EVALUATE')) p.next(); }
      q.evaluates.push({ expr, orderBy });
    }
    if (p.peek().t !== 'eof') throw new DaxSyntaxError(`Query must start with EVALUATE (or DEFINE). Unexpected '${p.peek().v}'.`, p.peek().s);
    if (!q.evaluates.length) throw new DaxSyntaxError('A DAX query needs at least one EVALUATE statement.', 0);
    return q;
  }

  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  isOp(v: string) { const t = this.peek(); return t.t === 'op' && t.v === v; }
  kw(v: string) { const t = this.peek(); return t.t === 'id' && t.v.toUpperCase() === v; }
  expectOp(v: string) {
    const t = this.next();
    if (t.t !== 'op' || t.v !== v) throw new DaxSyntaxError(`The syntax for '${t.v || 'end of input'}' is incorrect. Expected '${v}'.`, t.s);
  }

  expression(): DNode {
    if (this.kw('VAR')) {
      const vars: { name: string; expr: DNode }[] = [];
      while (this.kw('VAR')) {
        this.next();
        const n = this.next();
        if (n.t !== 'id') throw new DaxSyntaxError('Variable name expected after VAR.', n.s);
        this.expectOp('=');
        vars.push({ name: n.v, expr: this.expression() });
      }
      if (!this.kw('RETURN')) throw new DaxSyntaxError('VAR must be followed by RETURN.', this.peek().s);
      this.next();
      return { k: 'var', vars, ret: this.expression() };
    }
    return this.or();
  }
  or(): DNode { let l = this.and(); while (this.isOp('||')) { this.next(); l = { k: 'bin', op: '||', l, r: this.and() }; } return l; }
  and(): DNode { let l = this.not(); while (this.isOp('&&')) { this.next(); l = { k: 'bin', op: '&&', l, r: this.not() }; } return l; }
  not(): DNode {
    if (this.kw('NOT') && !(this.toks[this.i + 1]?.t === 'op' && this.toks[this.i + 1]?.v === '(')) { this.next(); return { k: 'un', op: 'NOT', e: this.not() }; }
    return this.cmp();
  }
  cmp(): DNode {
    let l = this.concat();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ['=', '==', '<>', '<', '>', '<=', '>='].includes(t.v)) { this.next(); l = { k: 'bin', op: t.v, l, r: this.concat() }; continue; }
      if (this.kw('IN')) { this.next(); l = { k: 'bin', op: 'IN', l, r: this.concat() }; continue; }
      if (this.kw('NOT') && this.toks[this.i + 1]?.t === 'id' && this.toks[this.i + 1].v.toUpperCase() === 'IN') { this.next(); this.next(); l = { k: 'un', op: 'NOT', e: { k: 'bin', op: 'IN', l, r: this.concat() } }; continue; }
      return l;
    }
  }
  concat(): DNode { let l = this.add(); while (this.isOp('&')) { this.next(); l = { k: 'bin', op: '&', l, r: this.add() }; } return l; }
  add(): DNode {
    let l = this.mul();
    for (;;) { const t = this.peek(); if (t.t === 'op' && (t.v === '+' || t.v === '-')) { this.next(); l = { k: 'bin', op: t.v, l, r: this.mul() }; } else return l; }
  }
  mul(): DNode {
    let l = this.unary();
    for (;;) { const t = this.peek(); if (t.t === 'op' && (t.v === '*' || t.v === '/')) { this.next(); l = { k: 'bin', op: t.v, l, r: this.unary() }; } else return l; }
  }
  unary(): DNode {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+')) { this.next(); const e = this.unary(); return t.v === '-' ? { k: 'un', op: '-', e } : e; }
    return this.pow();
  }
  pow(): DNode {
    const l = this.primary();
    if (this.isOp('^')) { this.next(); return { k: 'bin', op: '^', l, r: this.unary() }; }
    return l;
  }

  primary(): DNode {
    const t = this.next();
    switch (t.t) {
      case 'num': return { k: 'num', v: Number(t.v) };
      case 'str': return { k: 'str', v: t.v };
      case 'br': return { k: 'col', col: t.v };
      case 'qtbl': {
        if (this.peek().t === 'br') return { k: 'col', table: t.v, col: this.next().v };
        return { k: 'name', name: t.v };
      }
      case 'id': {
        const up = t.v.toUpperCase();
        if (this.isOp('(')) {
          this.next();
          const args: DNode[] = [];
          if (!this.isOp(')')) {
            for (;;) {
              if (this.isOp(',') || this.isOp(')')) args.push({ k: 'empty' });
              else args.push(this.expression());
              if (this.isOp(',')) { this.next(); continue; }
              break;
            }
          }
          this.expectOp(')');
          return { k: 'call', fn: up, args };
        }
        if (this.peek().t === 'br') return { k: 'col', table: t.v, col: this.next().v };
        if (up === 'TRUE' || up === 'FALSE') return { k: 'bool', v: up === 'TRUE' };
        if (up === 'BLANK') return { k: 'call', fn: 'BLANK', args: [] };
        if (KW.has(up) && up !== 'ASC' && up !== 'DESC') throw new DaxSyntaxError(`The syntax for '${t.v}' is incorrect.`, t.s);
        return { k: 'name', name: t.v };
      }
      case 'op': {
        if (t.v === '(') { const e = this.expression(); this.expectOp(')'); return e; }
        if (t.v === '{') {
          const rows: DNode[][] = [];
          if (!this.isOp('}')) {
            for (;;) {
              if (this.isOp('(')) {
                // could be a row tuple or a parenthesised scalar
                const save = this.i; this.next();
                const items = [this.expression()];
                while (this.isOp(',')) { this.next(); items.push(this.expression()); }
                if (this.isOp(')')) { this.next(); if (items.length > 1 || this.isOp(',') || this.isOp('}')) rows.push(items); else { this.i = save; rows.push([this.expression()]); } }
                else { this.i = save; rows.push([this.expression()]); }
              } else rows.push([this.expression()]);
              if (this.isOp(',')) { this.next(); continue; }
              break;
            }
          }
          this.expectOp('}');
          return { k: 'tc', rows };
        }
        break;
      }
    }
    throw new DaxSyntaxError(t.t === 'eof' ? 'Unexpected end of formula.' : `The syntax for '${t.v}' is incorrect.`, t.s);
  }
}

/** Split "Name = expression" as typed in the Power BI formula bar. */
export function splitDefinition(src: string): { name: string; expr: string } | null {
  const m = /^\s*(?:'([^']+)'|([^=[\]]+?))?\s*(?:\[([^\]]+)\])?\s*=(?!=)([\s\S]*)$/.exec(src);
  if (!m) return null;
  const name = (m[3] ?? m[2] ?? m[1] ?? '').trim();
  if (!name) return null;
  return { name, expr: m[4].trim() };
}

/** Walk every node (used to find dependencies). */
export function walk(n: DNode, f: (n: DNode) => void) {
  f(n);
  switch (n.k) {
    case 'call': n.args.forEach(a => walk(a, f)); break;
    case 'bin': walk(n.l, f); walk(n.r, f); break;
    case 'un': walk(n.e, f); break;
    case 'var': n.vars.forEach(v => walk(v.expr, f)); walk(n.ret, f); break;
    case 'tc': n.rows.forEach(r => r.forEach(x => walk(x, f))); break;
  }
}
