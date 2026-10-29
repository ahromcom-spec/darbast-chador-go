import { describe, it, expect } from 'bun:test';
import { describeRowPeriod } from '../src/lib/statementRowPeriod';
const ren = (m: number, s: string, e: string) => ({ id: String(m), kind: 'renewal' as const, title: '', amount: 1, start: s, end: e, monthNumber: m });
describe('statement row period', () => {
  it('separated order with months 2 and 3', () => {
    const p = describeRowPeriod([ren(2, '2026-09-23', '2026-10-23'), ren(3, '2026-10-23', '2026-11-22')], { hasBaseMonth: false });
    expect(p.label).toBe('ماه دوم و ماه سوم');
    expect(p.start).toBe('2026-09-23');
    expect(p.end).toBe('2026-11-22');
  });
  it('base order plus repair', () => {
    const p = describeRowPeriod([{ id: 'r', kind: 'repair', title: '', amount: 1, start: '2026-09-01', end: null }], { hasBaseMonth: true, rentalStart: '2026-08-23', rentalEnd: '2026-09-22' });
    expect(p.label).toBe('ماه اول + تعمیرات');
    expect(p.end).toBe('2026-09-22');
  });
});
