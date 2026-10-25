// Evaluator for the M language. Let-bindings are lazy, as in Power Query.
import { Node, Parser, TypeExpr } from './parser';
import {
  MError, MFunction, MRecord, MTable, MType, MTime, MDuration, DataType, compareValues, valuesEqual, valueType,
} from '../core/values';

export class Thunk {
  state: 0 | 1 | 2 = 0; // 0 = pending, 1 = evaluating, 2 = done
  value: any;
  error: any;
  constructor(public node: Node | null, public env: Env | null, value?: any) {
    if (node === null) { this.state = 2; this.value = value; }
  }
  get(): any {
    if (this.state === 2) { if (this.error) throw this.error; return this.value; }
    if (this.state === 1) throw new MError('Expression.Error', 'A cyclic reference was encountered during evaluation.');
    this.state = 1;
    try { this.value = evaluate(this.node!, this.env!); } catch (e) { this.error = e; this.state = 2; throw e; }
    this.state = 2;
    return this.value;
  }
}

export class Env {
  vars = new Map<string, Thunk>();
  constructor(public parent: Env | null = null, public resolver?: (name: string) => any) {}
  lookup(name: string): any {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let e: Env | null = this;
    while (e) {
      const t = e.vars.get(name);
      if (t) return t.get();
      if (e.resolver) { const v = e.resolver(name); if (v !== undefined) return v; }
      e = e.parent;
    }
    throw new MError('Expression.Error', `The name '${name}' wasn't recognized. Make sure it's spelled correctly.`);
  }
  has(name: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let e: Env | null = this;
    while (e) { if (e.vars.has(name)) return true; if (e.resolver && e.resolver(name) !== undefined) return true; e = e.parent; }
    return false;
  }
  set(name: string, v: any) { this.vars.set(name, new Thunk(null, null, v)); }
}

export function err(msg: string, reason = 'Expression.Error'): never { throw new MError(reason, msg); }

export function callFn(f: any, args: any[]): any {
  if (!(f instanceof MFunction)) err(`We cannot convert a value of type ${typeLabel(f)} to type Function.`);
  return f.impl(args);
}

export function typeLabel(v: any): string {
  const t = valueType(v);
  return ({ int: 'Number', decimal: 'Number', text: 'Text', bool: 'Logical', date: 'Date', datetime: 'DateTime', time: 'Time', duration: 'Duration', table: 'Table', record: 'Record', list: 'List', function: 'Function', null: 'Null', type: 'Type', binary: 'Binary' } as any)[t] || 'Any';
}

export function primToType(name: string): DataType {
  return ({ text: 'text', number: 'decimal', logical: 'bool', date: 'date', datetime: 'datetime', datetimezone: 'datetimezone', time: 'time', duration: 'duration', binary: 'binary', table: 'table', record: 'record', list: 'list', function: 'function', type: 'type', null: 'null' } as Record<string, DataType>)[name] || 'any';
}

function evalType(t: TypeExpr, env: Env): MType {
  switch (t.t) {
    case 'prim': return new MType(primToType(t.name), !!t.nullable);
    case 'table': return new MType('table', false, t.cols.map(c => ({ name: c.name, type: evalType(c.type, env).name })));
    case 'record': return new MType('record', false, t.cols.map(c => ({ name: c.name, type: evalType(c.type, env).name })));
    case 'list': return new MType('list', false, evalType(t.item, env));
    case 'expr': {
      const v = evaluate(t.e, env);
      if (v instanceof MType) return v;
      err('Type expected.');
    }
  }
}

export function isType(v: any, t: MType): boolean {
  if (v === null) return t.nullable || t.name === 'any' || t.name === 'null';
  if (t.name === 'any') return true;
  const vt = valueType(v);
  if (['int', 'decimal', 'currency', 'percent'].includes(t.name)) return typeof v === 'number';
  if (t.name === 'datetime') return v instanceof Date;
  if (t.name === 'date') return v instanceof Date;
  return vt === t.name;
}

export function toLogical(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (v instanceof MError) throw v;
  err(`We cannot convert the value ${fmtForError(v)} to type Logical.`);
}

export function fmtForError(v: any) {
  if (typeof v === 'string') return `"${v}"`;
  if (v === null) return 'null';
  if (v instanceof Date) return v.toLocaleDateString();
  return String(v);
}

function arith(op: string, a: any, b: any): any {
  if (a instanceof MError) throw a;
  if (b instanceof MError) throw b;
  if (op === '&') {
    if (a === null || b === null) return null;
    if (typeof a === 'string' && typeof b === 'string') return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
    if (a instanceof MRecord && b instanceof MRecord) {
      const r = new MRecord([...a.names], [...a.values]);
      b.names.forEach((n, i) => r.set(n, b.values[i]));
      return r;
    }
    if (a instanceof MTable && b instanceof MTable) return combineTables([a, b]);
    err(`We cannot apply operator & to types ${typeLabel(a)} and ${typeLabel(b)}.`);
  }
  if (a === null || b === null) return null;
  if (typeof a === 'number' && typeof b === 'number') {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? (a === 0 ? NaN : a > 0 ? Infinity : -Infinity) : a / b;
    }
  }
  if (a instanceof Date && b instanceof MDuration) {
    if (op === '+') return new Date(a.getTime() + b.ms);
    if (op === '-') return new Date(a.getTime() - b.ms);
  }
  if (a instanceof MDuration && b instanceof Date && op === '+') return new Date(b.getTime() + a.ms);
  if (a instanceof Date && b instanceof Date && op === '-') return new MDuration(a.getTime() - b.getTime());
  if (a instanceof MTime && b instanceof MDuration) return new MTime(((a.ms + (op === '-' ? -b.ms : b.ms)) % 86400000 + 86400000) % 86400000);
  if (a instanceof MTime && b instanceof MTime && op === '-') return new MDuration(a.ms - b.ms);
  if (a instanceof MDuration && b instanceof MDuration) {
    if (op === '+') return new MDuration(a.ms + b.ms);
    if (op === '-') return new MDuration(a.ms - b.ms);
  }
  if (a instanceof MDuration && typeof b === 'number') {
    if (op === '*') return new MDuration(a.ms * b);
    if (op === '/') return new MDuration(a.ms / b);
  }
  if (typeof a === 'number' && b instanceof MDuration && op === '*') return new MDuration(a * b.ms);
  err(`We cannot apply operator ${op} to types ${typeLabel(a)} and ${typeLabel(b)}.`);
}

export function combineTables(ts: MTable[]): MTable {
  const cols: { name: string; type: DataType }[] = [];
  for (const t of ts) for (const c of t.columns) {
    const ex = cols.find(x => x.name === c.name);
    if (!ex) cols.push({ ...c }); else if (ex.type !== c.type) ex.type = 'any';
  }
  const rows: any[][] = [];
  for (const t of ts) {
    const map = cols.map(c => t.idx(c.name));
    for (const r of t.rows) rows.push(map.map(i => (i < 0 ? null : r[i])));
  }
  return new MTable(cols, rows);
}

function compare(op: string, a: any, b: any): any {
  if (a instanceof MError) throw a;
  if (b instanceof MError) throw b;
  if (op === '=') return mEquals(a, b);
  if (op === '<>') return !mEquals(a, b);
  if (a === null || b === null) return null;
  const ta = typeof a === 'number' ? 'n' : valueType(a), tb = typeof b === 'number' ? 'n' : valueType(b);
  const same = ta === tb || (a instanceof Date && b instanceof Date);
  if (!same) err(`We cannot apply operator ${op} to types ${typeLabel(a)} and ${typeLabel(b)}.`);
  const c = compareValues(a, b);
  switch (op) {
    case '<': return c < 0;
    case '>': return c > 0;
    case '<=': return c <= 0;
    case '>=': return c >= 0;
  }
}

export function mEquals(a: any, b: any): boolean {
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => mEquals(x, b[i]));
  if (a instanceof MRecord && b instanceof MRecord) return a.names.length === b.names.length && a.names.every((n, i) => b.has(n) && mEquals(a.values[i], b.get(n)));
  return valuesEqual(a, b);
}

export function recordOfRow(t: MTable, row: any[], names?: string[]): MRecord {
  return new MRecord(names ?? t.names, row);
}

export function fieldOf(target: any, name: string, opt: boolean): any {
  if (target instanceof MError) throw target;
  if (target instanceof MRecord) {
    const i = target.names.indexOf(name);
    if (i < 0) { if (opt) return null; err(`The field '${name}' of the record wasn't found.`); }
    const v = target.values[i];
    if (v instanceof MError) throw v;
    if (v instanceof Thunk) return v.get();
    return v;
  }
  if (target instanceof MTable) {
    const i = target.idx(name);
    if (i < 0) { if (opt) return null; err(`The column '${name}' of the table wasn't found.`); }
    return target.rows.map(r => r[i]);
  }
  if (target === null && opt) return null;
  err(`We cannot apply field access to the type ${typeLabel(target)}.`);
}

export function evaluate(n: Node, env: Env): any {
  switch (n.k) {
    case 'num': return n.v;
    case 'str': return n.v;
    case 'bool': return n.v;
    case 'null': return null;
    case 'id': return env.lookup(n.name);
    case 'let': {
      const e = new Env(env);
      for (const b of n.binds) e.vars.set(b.name, new Thunk(b.expr, e));
      return evaluate(n.body, e);
    }
    case 'if': {
      const c = evaluate(n.c, env);
      return toLogical(c) ? evaluate(n.t, env) : evaluate(n.e, env);
    }
    case 'each': {
      const body = n.body;
      return new MFunction('each', (args) => {
        const e = new Env(env); e.set('_', args[0]);
        return evaluate(body, e);
      }, [1, 1], ['_']);
    }
    case 'fn': {
      const { params, body } = n;
      const min = params.filter(p => !p.optional).length;
      return new MFunction('fn', (args) => {
        if (args.length < min) err(`${params.length} arguments were passed to a function which expects ${min}.`);
        const e = new Env(env);
        params.forEach((p, i) => e.set(p.name, args[i] === undefined ? null : args[i]));
        return evaluate(body, e);
      }, [min, params.length], params.map(p => p.name));
    }
    case 'call': {
      const f = evaluate(n.f, env);
      const args = n.args.map(a => evaluate(a, env));
      if (!(f instanceof MFunction)) err(`We cannot convert a value of type ${typeLabel(f)} to type Function.`);
      if (args.length < f.arity[0] || args.length > f.arity[1]) {
        const nm = n.f.k === 'id' ? n.f.name : 'function';
        err(`${args.length} arguments were passed to ${nm}, which expects between ${f.arity[0]} and ${f.arity[1]}.`);
      }
      return f.impl(args);
    }
    case 'field': {
      const target = n.target ? evaluate(n.target, env) : env.lookup('_');
      return fieldOf(target, n.name, n.opt);
    }
    case 'proj': {
      const target = n.target ? evaluate(n.target, env) : env.lookup('_');
      if (target instanceof MRecord) return new MRecord([...n.names], n.names.map(x => fieldOf(target, x, n.opt)));
      if (target instanceof MTable) {
        const idx = n.names.map(x => target.idx(x));
        if (!n.opt && idx.some(i => i < 0)) err(`The column '${n.names[idx.findIndex(i => i < 0)]}' of the table wasn't found.`);
        return new MTable(n.names.map((x, j) => ({ name: x, type: idx[j] < 0 ? 'any' : target.columns[idx[j]].type })), target.rows.map(r => idx.map(i => (i < 0 ? null : r[i]))));
      }
      err('Projection requires a record or table.');
    }
    case 'item': {
      const t = evaluate(n.target, env);
      const ix = evaluate(n.index, env);
      if (Array.isArray(t)) {
        if (typeof ix !== 'number') err('List index must be a number.');
        if (ix < 0 || ix >= t.length) { if (n.opt) return null; err('There weren\'t enough elements in the enumeration to complete the operation.'); }
        return t[ix];
      }
      if (t instanceof MTable) {
        if (typeof ix === 'number') {
          if (ix < 0 || ix >= t.rows.length) { if (n.opt) return null; err('There weren\'t enough elements in the enumeration to complete the operation.'); }
          return recordOfRow(t, t.rows[ix]);
        }
        if (ix instanceof MRecord) {
          const matches = t.rows.filter(r => ix.names.every((nm, i) => mEquals(r[t.col(nm)], ix.values[i])));
          if (matches.length === 1) return recordOfRow(t, matches[0]);
          if (n.opt && matches.length === 0) return null;
          err(matches.length ? 'The key matched more than one row in the table.' : 'The key didn\'t match any rows in the table.');
        }
      }
      err(`We cannot apply indexing to the type ${typeLabel(t)}.`);
    }
    case 'rec': {
      const e = new Env(env);
      const r = new MRecord();
      for (const f of n.fields) { const th = new Thunk(f.expr, e); e.vars.set(f.name, th); r.names.push(f.name); r.values.push(th); }
      r.values = r.values.map(th => { try { return th.get(); } catch (x) { if (x instanceof MError) return x; throw x; } });
      return r;
    }
    case 'list': {
      const out: any[] = [];
      for (const it of n.items) {
        const a = evaluate(it.a, env);
        if (it.b) {
          const b = evaluate(it.b, env);
          if (typeof a === 'number' && typeof b === 'number') for (let i = a; i <= b; i++) out.push(i);
          else if (typeof a === 'string' && typeof b === 'string') for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out.push(String.fromCharCode(c));
          else err('Invalid list range.');
        } else out.push(a);
      }
      return out;
    }
    case 'bin': {
      if (n.op === 'and') { const l = evaluate(n.l, env); if (l === false) return false; const r = evaluate(n.r, env); if (l === null) return r === false ? false : null; return toLogical(l) && (r === null ? null : toLogical(r)); }
      if (n.op === 'or') { const l = evaluate(n.l, env); if (l === true) return true; const r = evaluate(n.r, env); if (l === null) return r === true ? true : null; return r === null ? null : toLogical(r); }
      if (n.op === '??') { const l = evaluate(n.l, env); return l === null ? evaluate(n.r, env) : l; }
      if (n.op === 'is') { const l = evaluate(n.l, env); return isType(l, evaluate(n.r, env)); }
      if (n.op === 'as') {
        const l = evaluate(n.l, env); const t = evaluate(n.r, env);
        if (!isType(l, t)) err(`We cannot convert the value ${fmtForError(l)} to type ${t.name}.`);
        return l;
      }
      const l = evaluate(n.l, env), r = evaluate(n.r, env);
      if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) return compare(n.op, l, r);
      return arith(n.op, l, r);
    }
    case 'un': {
      const v = evaluate(n.e, env);
      if (v instanceof MError) throw v;
      if (n.op === 'not') return v === null ? null : !toLogical(v);
      if (v === null) return null;
      if (n.op === '-') { if (typeof v === 'number') return -v; if (v instanceof MDuration) return new MDuration(-v.ms); }
      if (n.op === '+' && typeof v === 'number') return v;
      err(`We cannot apply operator ${n.op} to type ${typeLabel(v)}.`);
    }
    case 'try': {
      try {
        const v = evaluate(n.e, env);
        if (n.otherwise) return v;
        return MRecord.from({ HasError: false, Value: v });
      } catch (x) {
        if (!(x instanceof MError)) throw x;
        if (n.otherwise) return evaluate(n.otherwise, env);
        return MRecord.from({ HasError: true, Error: MRecord.from({ Reason: x.reason, Message: x.message, Detail: x.detail ?? null }) });
      }
    }
    case 'err': {
      const v = evaluate(n.e, env);
      if (typeof v === 'string') throw new MError('Expression.Error', v);
      if (v instanceof MRecord) throw new MError(String(v.get('Reason') ?? 'Expression.Error'), String(v.get('Message') ?? ''), v.get('Detail'));
      throw new MError('Expression.Error', String(v));
    }
    case 'type': return evalType(n.t, env);
    case 'meta': return evaluate(n.e, env);
  }
}

export function evalSource(src: string, env: Env) {
  return evaluate(Parser.parse(src), env);
}
