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
import { orderStatementCost } from '../src/lib/statementTotals';

describe('order cost read by statements', () => {
  test('Hosseini order 1000225 priced only in payment_amount counts 16,065,000', () => {
    assert.equal(orderStatementCost({ total_price: 0, payment_amount: 16_065_000 }), 16_065_000);
  });
  test('total_price wins when set (includes renewals)', () => {
    assert.equal(orderStatementCost({ total_price: 31_500_000, payment_amount: 10_000_000 }), 31_500_000);
  });
  test('billing-only shell stays zero', () => {
    assert.equal(orderStatementCost({ total_price: 0, payment_amount: 5_000_000, billing_only: true }), 0);
  });
  test('fully discounted order stays zero', () => {
    assert.equal(orderStatementCost({ total_price: 0, payment_amount: 5_000_000, discount_amount: 5_000_000 }), 0);
  });
});
