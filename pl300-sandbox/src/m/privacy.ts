// Data sources, privacy levels and the Power Query formula firewall.
// Two rules from Power Query are modelled:
//  1. Data combination (partitioning): a query can't both access a data source directly and reference another
//     query that accesses a data source. "Formula.Firewall: … Please rebuild this data combination."
//  2. Privacy levels: combining sources needs their privacy levels. Unset levels prompt "Information is required
//     about data privacy". Private data can't be sent to another source, and Organizational data can't be sent
//     to a Public source; the sandbox treats SQL and web sources as the ones data could be sent to (folding).
import { MError } from '../core/values';
import { paramInfo, Query } from './engine';
import { splitSteps } from './parser';

export type Privacy = 'None' | 'Public' | 'Organizational' | 'Private';
export type Credential = { kind: 'Windows' | 'Database' | 'Microsoft account' | 'Anonymous'; user?: string };
export interface SourceSettings { privacy?: Privacy; credential?: Credential | null; encrypt?: boolean }
export interface PrivacyConfig { levels: Record<string, SourceSettings>; ignore: boolean }

export interface SourceRef { fn: string; key: string; label: string; kind: 'File' | 'Folder' | 'SQL' | 'Web' | 'Other'; args: string[]; foldable: boolean }

const SRC = /\b(File\.Contents|Folder\.Files|Folder\.Contents|Sql\.Database|Sql\.Databases|Web\.Contents|OData\.Feed|SharePoint\.Files|SharePoint\.Contents|Lakehouse\.Contents)\(\s*((?:"(?:[^"]|"")*"|[A-Za-z_#][\w."# ]*?)(?:\s*&\s*(?:"(?:[^"]|"")*"|[A-Za-z_#][\w."# ]*?))*)\s*(?:,\s*("(?:[^"]|"")*"))?/g;

const unq = (x: string) => x.replace(/^"|"$/g, '').replace(/""/g, '"');

/** Literal parameter values, used to resolve paths like FolderPath & "Sales.csv". */
export function paramValues(queries: Query[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const q of queries) {
    if (!paramInfo(q.code)) continue;
    const m = /^\s*("(?:[^"]|"")*"|[^\s]+)\s+meta/.exec(q.code);
    if (m) out.set(q.name, unq(m[1]));
  }
  return out;
}

function resolve(expr: string, params: Map<string, string>): string | null {
  const parts = expr.split(/\s*&\s*/);
  let s = '';
  for (const p of parts) {
    const t = p.trim();
    if (t.startsWith('"')) s += unq(t);
    else { const name = t.replace(/^#"|"$/g, ''); const v = params.get(name); if (v === undefined) return null; s += v; }
  }
  return s;
}

/** Data source calls written directly in a query. */
export function directSources(code: string, params: Map<string, string> = new Map()): SourceRef[] {
  const out: SourceRef[] = [];
  for (const m of code.matchAll(SRC)) {
    const fn = m[1];
    const a1 = resolve(m[2], params);
    if (a1 === null) continue;
    const a2 = m[3] ? unq(m[3]) : undefined;
    const kind: SourceRef['kind'] = fn.startsWith('File') ? 'File' : fn.startsWith('Folder') || fn.startsWith('SharePoint') ? 'Folder' : fn.startsWith('Sql') || fn.startsWith('Lakehouse') ? 'SQL' : fn.startsWith('Web') || fn.startsWith('OData') ? 'Web' : 'Other';
    const key = kind === 'SQL' ? `sql:${a1.toLowerCase()};${(a2 ?? '').toLowerCase()}` : `${kind.toLowerCase()}:${a1.toLowerCase()}`;
    const label = kind === 'SQL' ? `${a1};${a2 ?? ''}` : a1;
    if (!out.some(x => x.key === key)) out.push({ fn, key, label, kind, args: a2 === undefined ? [a1] : [a1, a2], foldable: kind === 'SQL' || kind === 'Web' });
  }
  return out;
}

const isFunctionQuery = (code: string) => /^\s*(\(|let\s+Source\s*=\s*\()/.test(code) && /=>/.test(code.split('\n').slice(0, 3).join(' '));

/** Other queries a query references by name. */
export function referencedQueries(q: Query, queries: Query[]): Query[] {
  return queries.filter(o => o.name !== q.name && new RegExp(`(?<![\\w."])${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w"])|#"${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '""')}"`).test(q.code));
}

/** Every data source a query reaches, directly or through the queries it references. */
export function allSources(q: Query, queries: Query[], params = paramValues(queries), seen = new Set<string>()): SourceRef[] {
  if (seen.has(q.name)) return [];
  seen.add(q.name);
  const out = [...directSources(q.code, params)];
  for (const r of referencedQueries(q, queries)) for (const s of allSources(r, queries, params, seen)) if (!out.some(x => x.key === s.key)) out.push(s);
  return out;
}

/** Throws the error Power Query would raise for this query, or returns quietly. */
export function checkFirewall(q: Query, queries: Query[], cfg: PrivacyConfig) {
  if (paramInfo(q.code) || isFunctionQuery(q.code)) return;
  const params = paramValues(queries);
  for (const src of directSources(q.code, params)) {
    if (cfg.levels[src.key]?.credential === null) throw new MError('DataSource.Error', `Credentials are required to connect to the SQL source. (Source at ${src.label}.)`, { credentials: src.key, label: src.label });
  }
  if (cfg.ignore) return;
  // a step that reads a data source and also uses another query that reads a data source
  const steps = splitSteps(q.code)?.steps ?? [{ name: 'Source', code: q.code }];
  for (const st of steps) {
    if (!/\b(File\.Contents|Folder\.Files|Folder\.Contents|Sql\.Databases?|Web\.Contents|OData\.Feed|SharePoint\.(Files|Contents)|Lakehouse\.Contents)\s*\(/.test(st.code)) continue;
    const refs = referencedQueries({ ...q, code: st.code }, queries).filter(r => !paramInfo(r.code) && !isFunctionQuery(r.code));
    if (refs.some(r => allSources(r, queries, params).length > 0)) {
      throw new MError('Formula.Firewall', `Query '${q.name}' (step '${st.name}') references other queries or steps, so it may not directly access a data source. Please rebuild this data combination.`,
        'Move the data source access into its own query (for example a staging query with Enable load off), and reference both queries from a third query that combines them.');
    }
  }
  const stepName = steps[steps.length - 1]?.name ?? 'Source';
  const all = allSources(q, queries, params);
  if (all.length < 2) return;
  const lvl = (s: SourceRef) => cfg.levels[s.key]?.privacy ?? 'None';
  const unset = all.filter(s => lvl(s) === 'None');
  if (unset.length) throw new MError('Privacy.Required', 'Information is required about data privacy.', { sources: unset.map(s => s.key) });
  for (const target of all.filter(s => s.foldable)) {
    for (const src of all) {
      if (src.key === target.key) continue;
      const a = lvl(src), b = lvl(target);
      if (a === 'Private' || (a === 'Organizational' && b === 'Public')) {
        throw new MError('Formula.Firewall', `Query '${q.name}' (step '${stepName}') is accessing data sources that have privacy levels which cannot be used together. Please rebuild this data combination.`,
          `${src.label} is ${a}${a === 'Private' ? ', so its data can\'t be sent to any other source' : ''}, and ${target.label} is ${b}. Change the privacy levels (File › Options and settings › Data source settings › Edit Permissions), or ignore privacy levels for this file in Options › Privacy.`);
      }
    }
  }
}
