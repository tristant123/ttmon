import { describe, it, expect } from 'vitest';
import { analyseFolding, directQueryProblem } from '../src/m/folding';

const sql = `let
    Source = Sql.Database("localhost", "ContosoDW"),
    dbo_FactSales = Source{[Schema="dbo",Item="FactSales"]}[Data],
    #"Filtered Rows" = Table.SelectRows(dbo_FactSales, each [OrderQuantity] > 2 and [UnitPrice] <> null),
    #"Removed Other Columns" = Table.SelectColumns(#"Filtered Rows",{"SalesOrderNumber", "SalesAmount"}),
    #"Added Index" = Table.AddIndexColumn(#"Removed Other Columns", "Index", 1, 1, Int64.Type),
    #"Sorted Rows" = Table.Sort(#"Added Index",{{"SalesAmount", Order.Descending}})
in
    #"Sorted Rows"`;

describe('query folding', () => {
  it('folds until a step that can\'t fold', () => {
    const f = analyseFolding(sql);
    expect(f.map(x => x.status)).toEqual(['folds', 'folds', 'folds', 'folds', 'notfolds', 'notfolds']);
    expect(f[3].sql).toContain('where ([OrderQuantity] > 2 AND [UnitPrice] IS NOT NULL)');
    expect(f[3].sql).toContain('[SalesOrderNumber]');
    expect(f[4].reason).toMatch(/AddIndexColumn/);
  });
  it('reports DirectQuery problems', () => {
    expect(directQueryProblem(sql)?.name).toBe('Added Index');
    expect(directQueryProblem('let Source = Csv.Document(File.Contents("a.csv")) in Source')?.status).toBe('na');
    expect(directQueryProblem(sql.replace(/\n.*Added Index.*\n/, '\n').replace('#"Added Index"', '#"Removed Other Columns"'))).toBeNull();
  });
  it('translates text and list filters', () => {
    const f = analyseFolding(`let Source = Sql.Database("localhost", "ContosoDW"), t = Source{[Schema="dbo",Item="DimProduct"]}[Data], f = Table.SelectRows(t, each Text.StartsWith([Category], "Bik") or List.Contains({"Red","Blue"}, [Color])) in f`);
    expect(f[2].sql).toContain(`([Category] LIKE 'Bik%' OR [Color] IN ('Red', 'Blue'))`);
  });
});
