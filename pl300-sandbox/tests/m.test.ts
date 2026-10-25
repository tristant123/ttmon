import { describe, it, expect } from 'vitest';
import { MEngine } from '../src/m/engine';
import { setSourceHost } from '../src/m/sources';
import { MTable, MError } from '../src/core/values';

const csv = 'OrderID,Date,Product,Qty,Price\n1,2023-01-05,Bike,2,100.5\n2,2023-01-06, helmet ,1,abc\n3,2023-02-01,Bike,,100.5\n';
setSourceHost({ files: () => [{ name: 'Sales.csv', folder: 'C:\\Sandbox\\Files', bytes: new TextEncoder().encode(csv), modified: 0 }], parquet: () => undefined });

function run(code: string, others: Record<string, string> = {}) {
  const qs = [{ id: 'q', name: 'Q', code, load: true, refresh: true }, ...Object.entries(others).map(([n, c]) => ({ id: n, name: n, code: c, load: true, refresh: true }))];
  return new MEngine(qs).evaluateQuery('Q');
}

describe('M engine', () => {
  it('loads csv and transforms', () => {
    const t: MTable = run(`let
    Source = Csv.Document(File.Contents("C:\\Users\\me\\Sales.csv"),[Delimiter=",", Columns=5, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"OrderID", Int64.Type}, {"Date", type date}, {"Product", type text}, {"Qty", Int64.Type}, {"Price", type number}}),
    #"Trimmed Text" = Table.TransformColumns(#"Changed Type",{{"Product", Text.Trim, type text}}),
    #"Capitalized" = Table.TransformColumns(#"Trimmed Text",{{"Product", Text.Proper, type text}}),
    #"Added Custom" = Table.AddColumn(Capitalized, "Line Total", each [Qty] * [Price], type number)
in
    #"Added Custom"`);
    expect(t.names).toEqual(['OrderID', 'Date', 'Product', 'Qty', 'Price', 'Line Total']);
    expect(t.rows[1][2]).toBe('Helmet');
    expect(t.rows[1][4]).toBeInstanceOf(MError);
    expect(t.rows[0][5]).toBe(201);
    expect(t.rows[2][3]).toBe(null);
    expect(t.rows[2][5]).toBe(null);
  });
  it('group, merge, unpivot, pivot', () => {
    const t: MTable = run(`let
      A = #table({"K","V"}, {{1,10},{1,5},{2,7}}),
      G = Table.Group(A, {"K"}, {{"Total", each List.Sum([V]), type number}, {"Rows", each Table.RowCount(_), Int64.Type}}),
      B = #table({"K","Name"}, {{1,"one"},{3,"three"}}),
      J = Table.NestedJoin(G, {"K"}, B, {"K"}, "B", JoinKind.LeftOuter),
      E = Table.ExpandTableColumn(J, "B", {"Name"}, {"B.Name"})
    in E`);
    expect(t.rows).toEqual([[1, 15, 2, 'one'], [2, 7, 1, null]]);
    const u: MTable = run(`let W = #table({"Region","Jan","Feb"}, {{"N",1,2},{"S",3,null}}),
      U = Table.UnpivotOtherColumns(W, {"Region"}, "Attribute", "Value"),
      P = Table.Pivot(U, List.Distinct(U[Attribute]), "Attribute", "Value", List.Sum) in P`);
    expect(u.rows).toEqual([['N', 1, 2], ['S', 3, null]]);
    expect(run(`let a = Table.NestedJoin(#table({"k"},{{1},{2}}), "k", #table({"k"},{{2},{3}}), "k", "x", JoinKind.RightAnti) in Table.RowCount(a)`)).toBe(1);
  });
  it('language features', () => {
    expect(run(`let f = (x as number, optional y) => x + (y ?? 1), r = [a = 1, b = a + 1] in f(r[b]) * 2`)).toBe(6);
    expect(run(`try 1/0 otherwise 5`)).toBe(Infinity);
    expect(run(`try error "x" otherwise 5`)).toBe(5);
    expect(run(`List.Sum({1..4})`)).toBe(10);
    expect(run(`Text.Combine({"a","b"}, "-") & Text.From(3)`)).toBe('a-b3');
    expect(run(`if 1 > 2 then "a" else if 2 > 1 then "b" else "c"`)).toBe('b');
    expect(run(`Date.Year(#date(2024,3,1))`)).toBe(2024);
    expect(run(`Query2 + 1`, { Query2: '41' })).toBe(42);
    expect(run(`{1,2,3}{1}`)).toBe(2);
    expect(run(`Table.SelectRows(#table({"Sales Amount"},{{1},{5}}), each [Sales Amount] > 2)[Sales Amount]`)).toEqual([5]);
    expect(run(`"Sample" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]`)).toBe('Sample');
    expect(run(`Text.BeforeDelimiter("a-b-c", "-", 1)`)).toBe('a-b');
  });
});
