import { describe, it, expect } from 'vitest';
import { examBank, isCorrect, credit, SYLLABUS } from '../src/tutorials/exam';

describe('practice exam bank', () => {
  const bank = examBank();
  it('has well-formed answer keys', () => {
    const ids = new Set<string>();
    for (const q of bank) {
      expect(ids.has(q.id), q.id).toBe(false); ids.add(q.id);
      const n = q.options?.length ?? 0;
      if (q.type === 'single') expect((q.answer as number) < n, q.id).toBe(true);
      if (q.type === 'multi') expect((q.answer as number[]).every(i => i < n), q.id).toBe(true);
      if (q.type === 'yesno') expect((q.answer as number[]).length, q.id).toBe(n);
      if (q.type === 'order') expect(new Set(q.answer as number[]).size, q.id).toBe((q.answer as number[]).length);
      if (q.type === 'dropdown') expect(q.blanks!.every(b => b.answer < b.options.length), q.id).toBe(true);
      expect(isCorrect(q, q.type === 'dropdown' ? q.blanks!.map(b => b.answer) : q.answer), q.id).toBe(true);
    }
  });
  it('gives partial credit on Yes/No items', () => {
    const q = bank.find(x => x.type === 'yesno')!;
    const r = [...(q.answer as number[])]; r[0] = 1 - r[0];
    expect(credit(q, r)).toBeCloseTo(1 - 1 / r.length);
    expect(isCorrect(q, r)).toBe(false);
  });
  it('maps bank skills to the syllabus', () => {
    const skills = new Set(SYLLABUS.map(r => r.skill));
    for (const q of bank.filter(x => !x.id.startsWith('t-'))) expect(skills.has(q.skill), q.skill).toBe(true);
  });
});
