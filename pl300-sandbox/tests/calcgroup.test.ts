import { describe, it, expect } from 'vitest';
import { DaxEngine } from '../src/dax/engine';
import '../src/dax/functions';
import { Model } from '../src/model/types';
import { recalc } from '../src/model/refresh';

const d = (y: number, m: number, dd: number) => new Date(y, m - 1, dd);
function model(): Model {
  const dates: any[][] = [];
  for (let x = d(2023, 1, 1); x <= d(2024, 12, 31); x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) dates.push([x, x.getFullYear(), x.getMonth() + 1]);
  return {
    tables: [
      { name: 'Sales', columns: [{ name: 'Date', dataType: 'date' }, { name: 'Amount', dataType: 'decimal' }, { name: 'Cost', dataType: 'decimal' }],
        rows: [[d(2023, 1, 5), 200, 100], [d(2023, 2, 7), 50, 20], [d(2024, 1, 9), 300, 120], [d(2024, 2, 2), 25, 5]] },
      { name: 'Date', columns: [{ name: 'Date', dataType: 'date' }, { name: 'Year', dataType: 'int' }, { name: 'Month', dataType: 'int' }], rows: dates, dateColumn: 'Date' },
      { name: 'Time Intelligence', columns: [], rows: [], calculationGroup: { precedence: 10, items: [
        { name: 'Current', expression: 'SELECTEDMEASURE()' },
        { name: 'PY', expression: 'CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(\'Date\'[Date]))' },
        { name: 'YTD', expression: 'CALCULATE(SELECTEDMEASURE(), DATESYTD(\'Date\'[Date]))' },
        { name: 'Name', expression: 'SELECTEDMEASURENAME()' },
        { name: 'Only Sales', expression: 'IF(ISSELECTEDMEASURE([Sales]), SELECTEDMEASURE())' },
      ] } },
      { name: 'Scale', columns: [], rows: [], calculationGroup: { precedence: 1, items: [{ name: 'Thousands', expression: 'SELECTEDMEASURE() / 1000' }] } },
    ],
    measures: [
      { name: 'Sales', table: 'Sales', expression: 'SUM(Sales[Amount])' },
      { name: 'Margin', table: 'Sales', expression: '[Sales] - SUM(Sales[Cost])' },
    ],
    relationships: [{ id: 'r', fromTable: 'Sales', fromColumn: 'Date', toTable: 'Date', toColumn: 'Date', cardinality: 'many-one', crossFilter: 'single', active: true }],
    hierarchies: [], roles: [],
  };
}

describe('calculation groups', () => {
  const m = model(); recalc(m);
  const e = new DaxEngine(m);
  const q = (s: string) => e.scalarOf(s);
  it('builds the group table', () => {
    expect(m.tables[2].rows.map(r => r[0])).toEqual(['Current', 'PY', 'YTD', 'Name', 'Only Sales']);
  });
  it('applies the selected item to explicit measures', () => {
    expect(q(`CALCULATE([Sales], 'Time Intelligence'[Name] = "Current")`)).toBe(575);
    expect(q(`CALCULATE([Sales], 'Time Intelligence'[Name] = "PY", 'Date'[Year] = 2024)`)).toBe(250);
    expect(q(`CALCULATE([Margin], 'Time Intelligence'[Name] = "PY", 'Date'[Year] = 2024)`)).toBe(130);
    expect(q(`CALCULATE([Sales], 'Time Intelligence'[Name] = "Name")`)).toBe('Sales');
    expect(q(`CALCULATE([Margin], 'Time Intelligence'[Name] = "Only Sales")`)).toBe(null);
    // no item or several items selected: the measure is unchanged
    expect(q(`[Sales]`)).toBe(575);
    expect(q(`CALCULATE([Sales], 'Time Intelligence'[Name] IN {"PY", "YTD"})`)).toBe(575);
  });
  it('applies groups by precedence', () => {
    expect(q(`CALCULATE([Sales], 'Time Intelligence'[Name] = "PY", Scale[Name] = "Thousands", 'Date'[Year] = 2024)`)).toBe(0.25);
  });
  it('works in SUMMARIZECOLUMNS', () => {
    const t = e.tableOf(`SUMMARIZECOLUMNS('Date'[Year], 'Time Intelligence'[Name], "S", [Sales])`);
    const row = t.rows.find(r => r[0] === 2024 && r[1] === 'YTD');
    expect(row?.[2]).toBe(325);
  });
});
