import { describe, it, expect } from 'vitest';
import { checkFirewall, directSources } from '../src/m/privacy';
import { Query } from '../src/m/engine';

const q = (name: string, code: string): Query => ({ id: name, name, code, load: true, refresh: true });
const sales = q('Sales', 'let\n    Source = Csv.Document(File.Contents("C:\\\\Sandbox\\\\Files\\\\Sales.csv"))\nin\n    Source');
const prod = q('Product', 'let\n    Source = Sql.Database("localhost", "ContosoDW"),\n    P = Source{[Schema="dbo",Item="DimProduct"]}[Data]\nin\n    P');
const merge = q('Merge1', 'let\n    Source = Table.NestedJoin(Sales, {"ProductKey"}, Product, {"ProductKey"}, "P", JoinKind.LeftOuter)\nin\n    Source');
const bad = q('Bad', 'let\n    Source = Csv.Document(File.Contents(Product{0}[Path]))\nin\n    Source');
const all = [sales, prod, merge, bad];
const cfg = (levels: Record<string, any>, ignore = false) => ({ levels, ignore });
const keys = { file: directSources(sales.code)[0].key, sql: directSources(prod.code)[0].key };

describe('privacy levels and the firewall', () => {
  it('asks for privacy levels when combining sources', () => {
    expect(() => checkFirewall(merge, all, cfg({}))).toThrow(/Information is required about data privacy/);
    expect(() => checkFirewall(sales, all, cfg({}))).not.toThrow();
  });
  it('blocks Private data flowing to another source', () => {
    expect(() => checkFirewall(merge, all, cfg({ [keys.file]: { privacy: 'Private' }, [keys.sql]: { privacy: 'Organizational' } }))).toThrow(/privacy levels which cannot be used together/);
    expect(() => checkFirewall(merge, all, cfg({ [keys.file]: { privacy: 'Organizational' }, [keys.sql]: { privacy: 'Organizational' } }))).not.toThrow();
    expect(() => checkFirewall(merge, all, cfg({ [keys.file]: { privacy: 'Organizational' }, [keys.sql]: { privacy: 'Public' } }))).toThrow(/cannot be used together/);
    expect(() => checkFirewall(merge, all, cfg({}, true))).not.toThrow();
  });
  it('enforces the data combination rule', () => {
    expect(() => checkFirewall(bad, all, cfg({}))).toThrow(/references other queries or steps, so it may not directly access a data source/);
  });
  it('requires credentials after they are cleared', () => {
    expect(() => checkFirewall(prod, all, cfg({ [keys.sql]: { credential: null } }))).toThrow(/Credentials are required/);
  });
});
