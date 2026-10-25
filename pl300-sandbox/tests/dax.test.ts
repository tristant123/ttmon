import { describe, it, expect } from 'vitest';
import { DaxEngine, emptyCtx, VTable } from '../src/dax/engine';
import '../src/dax/functions';
import { Model } from '../src/model/types';

const d = (y: number, m: number, dd: number) => new Date(y, m - 1, dd);
function model(): Model {
  const dates: any[][] = [];
  for (let x = d(2023, 1, 1); x <= d(2024, 12, 31); x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) dates.push([x, x.getFullYear(), x.getMonth() + 1]);
  return {
    tables: [
      { name: 'Sales', columns: [{ name: 'Date', dataType: 'date' }, { name: 'ProductKey', dataType: 'int' }, { name: 'Qty', dataType: 'int' }, { name: 'Amount', dataType: 'decimal' }, { name: 'ShipDate', dataType: 'date' }],
        rows: [[d(2023, 1, 5), 1, 2, 200, d(2023, 2, 1)], [d(2023, 2, 7), 2, 1, 50, d(2023, 2, 10)], [d(2024, 1, 9), 1, 3, 300, d(2024, 3, 1)], [d(2024, 2, 2), 3, 5, 25, d(2024, 2, 3)]] },
      { name: 'Product', columns: [{ name: 'ProductKey', dataType: 'int' }, { name: 'Color', dataType: 'text' }, { name: 'Category', dataType: 'text' }],
        rows: [[1, 'Red', 'Bikes'], [2, 'Blue', 'Bikes'], [3, 'Red', 'Helmets'], [4, 'Black', 'Helmets']] },
      { name: 'Date', columns: [{ name: 'Date', dataType: 'date' }, { name: 'Year', dataType: 'int' }, { name: 'Month', dataType: 'int' }], rows: dates, dateColumn: 'Date' },
    ],
    measures: [
      { name: 'Total Sales', table: 'Sales', expression: 'SUM(Sales[Amount])' },
      { name: 'Red Sales', table: 'Sales', expression: 'CALCULATE([Total Sales], Product[Color] = "Red")' },
      { name: 'All Sales', table: 'Sales', expression: 'CALCULATE([Total Sales], ALL(Product))' },
      { name: 'YTD', table: 'Sales', expression: 'TOTALYTD([Total Sales], \'Date\'[Date])' },
      { name: 'PY', table: 'Sales', expression: 'CALCULATE([Total Sales], SAMEPERIODLASTYEAR(\'Date\'[Date]))' },
      { name: 'Ship Sales', table: 'Sales', expression: 'CALCULATE([Total Sales], USERELATIONSHIP(Sales[ShipDate], \'Date\'[Date]))' },
      { name: 'Pct', table: 'Sales', expression: 'DIVIDE([Total Sales], CALCULATE([Total Sales], ALLSELECTED(Product)))' },
    ],
    relationships: [
      { id: 'r1', fromTable: 'Sales', fromColumn: 'ProductKey', toTable: 'Product', toColumn: 'ProductKey', cardinality: 'many-one', crossFilter: 'single', active: true },
      { id: 'r2', fromTable: 'Sales', fromColumn: 'Date', toTable: 'Date', toColumn: 'Date', cardinality: 'many-one', crossFilter: 'single', active: true },
      { id: 'r3', fromTable: 'Sales', fromColumn: 'ShipDate', toTable: 'Date', toColumn: 'Date', cardinality: 'many-one', crossFilter: 'single', active: false },
    ],
    hierarchies: [], roles: [],
  };
}
const e = new DaxEngine(model());
const q = (s: string) => e.scalarOf(s);
const grid = (vt: VTable) => vt.rows;

describe('DAX', () => {
  it('basics', () => {
    expect(q('[Total Sales]')).toBe(575);
    expect(q('[Red Sales]')).toBe(525);
    expect(q('SUMX(Sales, Sales[Qty] * 2)')).toBe(22);
    expect(q('COUNTROWS(FILTER(Product, Product[Color] = "red"))')).toBe(2);
    expect(q('VAR x = 2 RETURN x * 3')).toBe(6);
    expect(q('DIVIDE(1, 0)')).toBe(null);
    expect(q('BLANK() + 1')).toBe(1);
    expect(q('IF(1 > 2, "a")')).toBe(null);
    expect(q('SWITCH(TRUE(), 1 > 2, "a", 3 > 2, "b", "c")')).toBe('b');
    expect(q('FORMAT(1234.5, "#,##0.00")')).toBe('1,234.50');
    expect(q('FORMAT(DATE(2024,3,5), "mmm yyyy")')).toBe('Mar 2024');
    expect(q('CALCULATE(COUNTROWS(Product), Product[Color] IN {"Red", "Blue"})')).toBe(3);
    expect(() => q('Sales[Amount] + 1')).toThrow(/single value/);
  });
  it('relationships & context', () => {
    const t = e.tableOf('SUMMARIZECOLUMNS(Product[Color], "S", [Total Sales], "All", [All Sales], "Pct", [Pct])');
    expect(grid(t)).toEqual([['Red', 525, 575, 525 / 575], ['Blue', 50, 575, 50 / 575], ['Black', null, 575, null]]);
    const t2 = e.tableOf('SUMMARIZECOLUMNS(\'Date\'[Year], "S", [Total Sales], "YTD", [YTD], "PY", [PY], "Ship", [Ship Sales])');
    expect(grid(t2)).toEqual([[2023, 250, 250, null, 250], [2024, 325, 325, 250, 325]]);
    const t3 = e.tableOf('SUMMARIZECOLUMNS(\'Date\'[Year], \'Date\'[Month], "S", [Total Sales], "Ship", [Ship Sales], "YTD", [YTD])');
    expect(grid(t3).filter(r => r[2] !== null || r[3] !== null)).toEqual([[2023, 1, 200, null, 200], [2023, 2, 50, 250, 250], [2024, 1, 300, null, 300], [2024, 2, 25, 25, 325], [2024, 3, null, 300, 325]]);
  });
  it('calculated column style', () => {
    const tab = e.table('Product');
    const vals = tab.rows.map((_r, i) => e.scalar(e.parse('CALCULATE(SUM(Sales[Amount]))'), { ...emptyCtx(), rows: [{ vt: e.baseTable('Product', emptyCtx()), i }] }));
    expect(vals).toEqual([500, 50, 25, null]);
    const rel = e.table('Sales').rows.map((_r, i) => e.scalar(e.parse('RELATED(Product[Color])'), { ...emptyCtx(), rows: [{ vt: e.baseTable('Sales', emptyCtx()), i }] }));
    expect(rel).toEqual(['Red', 'Blue', 'Red', 'Red']);
    expect(q('RANKX(ALL(Product[Color]), [Total Sales])')).toBe(1);
    expect(q('CONCATENATEX(VALUES(Product[Category]), Product[Category], ", ")')).toBe('Bikes, Helmets');
    expect(grid(e.tableOf('TOPN(1, VALUES(Product[Color]), [Total Sales])'))).toEqual([['Red']]);
    expect(q('COUNTROWS(CALENDAR(DATE(2024,1,1), DATE(2024,1,31)))')).toBe(31);
  });
});
