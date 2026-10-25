// Evaluates a workbook of Power Query queries that may reference each other by name.
import { Parser, Node, splitSteps } from './parser';
import { Env, evaluate } from './eval';
import { LIB } from './lib';
import './sources';
import { MError, MRecord } from '../core/values';

export interface Query {
  id: string;
  name: string;
  code: string;
  load: boolean;          // "Enable load"
  refresh: boolean;       // "Include in report refresh"
  group?: string;
  description?: string;
}

export interface ParamInfo { type: string; required: boolean; list?: any[] }

export function paramInfo(code: string): ParamInfo | null {
  let n: Node;
  try { n = Parser.parse(code); } catch { return null; }
  if (n.k !== 'meta' || n.m.k !== 'rec') return null;
  const f = Object.fromEntries(n.m.fields.map(x => [x.name, x.expr]));
  const isP = f.IsParameterQuery;
  if (!isP || isP.k !== 'bool' || !isP.v) return null;
  const ty = f.Type && f.Type.k === 'str' ? f.Type.v : 'Any';
  const req = f.IsParameterQueryRequired && f.IsParameterQueryRequired.k === 'bool' ? f.IsParameterQueryRequired.v : false;
  return { type: ty, required: req };
}

export class MEngine {
  cache = new Map<string, { v?: any; e?: any }>();
  evaluating = new Set<string>();
  global: Env;

  constructor(public queries: Query[]) {
    this.global = new Env(null, (name) => {
      if (name in LIB) return LIB[name];
      const q = this.queries.find(x => x.name === name);
      if (q) return this.evaluateQuery(q.name);
      if (name === '#shared') return new MRecord(Object.keys(LIB), Object.values(LIB));
      return undefined;
    });
  }

  evaluateQuery(name: string): any {
    const c = this.cache.get(name);
    if (c) { if (c.e) throw c.e; return c.v; }
    const q = this.queries.find(x => x.name === name);
    if (!q) throw new MError('Expression.Error', `The name '${name}' wasn't recognized.`);
    if (this.evaluating.has(name)) throw new MError('Expression.Error', `A cyclic reference was encountered during evaluation of query '${name}'.`);
    this.evaluating.add(name);
    try {
      const v = evaluate(Parser.parse(q.code), new Env(this.global));
      this.cache.set(name, { v });
      return v;
    } catch (e) {
      this.cache.set(name, { e });
      throw e;
    } finally { this.evaluating.delete(name); }
  }

  /** Value of the query as of one Applied Step (index into the let bindings). */
  evaluateStep(name: string, stepIndex: number): any {
    const q = this.queries.find(x => x.name === name);
    if (!q) throw new MError('Expression.Error', `Query '${name}' not found.`);
    const node = Parser.parse(q.code);
    if (node.k !== 'let') return this.evaluateQuery(name);
    const sp = splitSteps(q.code);
    if (!sp || stepIndex >= node.binds.length || stepIndex < 0) return this.evaluateQuery(name);
    const env = new Env(new Env(this.global));
    // let-bound names are visible to each other (lazy)
    const letNode: Node = { k: 'let', binds: node.binds, body: { k: 'id', name: node.binds[stepIndex].name }, bodyStart: 0 };
    return evaluate(letNode, env);
  }

  /** Evaluate a free-standing expression in the context of a query's steps (formula bar / custom column preview). */
  evaluateIn(name: string, expr: string): any {
    const q = this.queries.find(x => x.name === name);
    const node = q ? Parser.parse(q.code) : null;
    const binds = node && node.k === 'let' ? node.binds : [];
    return evaluate({ k: 'let', binds, body: Parser.parse(expr), bodyStart: 0 }, new Env(this.global));
  }
}

export function friendlyError(e: any): { reason: string; message: string; detail?: string } {
  if (e instanceof MError) return { reason: e.reason, message: e.message, detail: e.detail === undefined || e.detail === null ? undefined : String(e.detail) };
  if (e && e.pos !== undefined) return { reason: 'Expression.SyntaxError', message: e.message };
  return { reason: 'Error', message: String(e?.message ?? e) };
}
