import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStatementTotals } from '../src/lib/statementTotals';

const orders = [
  { total: 11_700_000, paid: 11_700_000 },
  { total: 11_700_000, paid: 11_700_000 },
  { total: 8_500_000, paid: 8_500_000 },
  { total: 17_220_000, paid: 18_100_000 },
  { total: 3_200_000, paid: 0 },
];

describe('actual statement receipts and changing costs', () => {
  test('Morsali statement 6 preserves 50,000,000 rather than capping at 49,120,000', () => {
    assert.deepEqual(calculateStatementTotals(orders), {
      total: 52_320_000, paid: 50_000_000, remaining: 2_320_000, credit: 0,
    });
  });
  test('a cost increase changes the balance but never changes receipts', () => {
    const result = calculateStatementTotals([...orders, { total: 1_000_000, paid: 0 }]);
    assert.equal(result.paid, 50_000_000);
    assert.equal(result.remaining, 3_320_000);
  });
  test('a cost reduction retains excess receipts as credit', () => {
    assert.deepEqual(calculateStatementTotals(orders.slice(0, -1)), {
      total: 49_120_000, paid: 50_000_000, remaining: 0, credit: 880_000,
    });
  });
  test('discount affects debt and credit without altering received payments', () => {
    const result = calculateStatementTotals(orders, 3_000_000);
    assert.equal(result.paid, 50_000_000);
    assert.equal(result.remaining, 0);
    assert.equal(result.credit, 680_000);
  });
});