import { describe, it, expect } from 'vitest';
import { Lattice } from '../src/report/visualcalc';
import { DaxEngine } from '../src/dax/engine';
import '../src/dax/functions';
import { FieldRef } from '../src/model/types';

const Y: FieldRef = { table: 'D', column: 'Year' }, M: FieldRef = { table: 'D', column: 'Month' };
const data = [[2023, 1, 10], [2023, 2, 20], [2024, 1, 30], [2024, 2, 40]];
const base = (gs: FieldRef[]) => {
  const useY = gs.includes(Y), useM = gs.includes(M);
  const map = new Map<string, any[]>();
  for (const [y, m, v] of data) { const k = [useY ? y : null, useM ? m : null].join('|'); const r = map.get(k) ?? [...(useY ? [y] : []), ...(useM ? [m] : []), 0]; r[r.length - 1] += v; map.set(k, r); }
  return { names: ['Sales'], rows: [...map.values()] };
};
const eng = new DaxEngine({ tables: [], measures: [], relationships: [], hierarchies: [], roles: [] });
const lat = (expr: string) => new Lattice(eng, [Y, M], [], [0, 1, 2], [0], base, f => f.column!, [{ name: 'C', expr }]);

describe('visual calculations', () => {
  it('running sum continues across the hierarchy', () => {
    expect(lat('RUNNINGSUM([Sales])').level(2, 0).rows.map(r => r[3])).toEqual([10, 30, 60, 100]);
    expect(lat('RUNNINGSUM([Sales])').level(1, 0).rows.map(r => r[2])).toEqual([30, 100]);
  });
  it('resets by parent', () => {
    expect(lat('RUNNINGSUM([Sales], HIGHESTPARENT)').level(2, 0).rows.map(r => r[3])).toEqual([10, 30, 30, 70]);
  });
  it('percent of parent and of grand total', () => {
    expect(lat('DIVIDE([Sales], COLLAPSE([Sales], ROWS))').level(2, 0).rows.map(r => r[3])).toEqual([10 / 30, 20 / 30, 30 / 70, 40 / 70]);
    expect(lat('DIVIDE([Sales], COLLAPSEALL([Sales], ROWS))').level(1, 0).rows.map(r => r[2])).toEqual([0.3, 0.7]);
  });
  it('previous, first, moving average and average of children', () => {
    expect(lat('[Sales] - PREVIOUS([Sales])').level(2, 0).rows.map(r => r[3])).toEqual([10, 10, 10, 10]);
    expect(lat('FIRST([Sales])').level(2, 0).rows.map(r => r[3])).toEqual([10, 10, 10, 10]);
    expect(lat('MOVINGAVERAGE([Sales], 2)').level(2, 0).rows.map(r => r[3])).toEqual([10, 15, 25, 35]);
    expect(lat('EXPAND(AVERAGE([Sales]), ROWS)').level(1, 0).rows.map(r => r[2])).toEqual([15, 35]);
    expect(lat('IF(ISATLEVEL([Month]), "month", "year")').level(1, 0).rows.map(r => r[2])).toEqual(['year', 'year']);
  });
});
