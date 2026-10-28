import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { billingOwner, transferPreview } from '../src/lib/orderChargeBilling';

const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });

describe('independent renewal and repair billing', () => {
  test('three subsequent months transfer together without charging the base twice', () => {
    const months = [8500000, 8500000, 8500000];
    const preview = transferPreview(34000000, 8500000, months.reduce((s, n) => s + n, 0));
    expect(preview.sourceTotal).toBe(8500000);
    expect(preview.targetTotal).toBe(25500000);
    expect(preview.sourceRemaining).toBe(0);
    expect(preview.sourceTotal + preview.targetTotal).toBe(34000000);
  });
  test('repair cost moves independently to an existing order', () => {
    const preview = transferPreview(49540000, 0, 2500000, 8500000);
    expect(preview.sourceTotal).toBe(47040000);
    expect(preview.targetTotal).toBe(11000000);
  });
  test('financial ownership can move repeatedly while operational ownership remains', () => {
    const row = { order_id: 'mother', billing_order_id: 'second' };
    expect(billingOwner(row)).toBe('second');
    expect(billingOwner({ ...row, billing_order_id: 'third' })).toBe('third');
    expect(row.order_id).toBe('mother');
    expect(billingOwner({ order_id: 'mother' })).toBe('mother');
  });
  test('settled original month remains settled when later unpaid charges move', () => {
    const preview = transferPreview(25500000, 8500000, 17000000);
    expect(preview.sourceRemaining).toBe(0);
    expect(preview.targetRemaining).toBe(17000000);
    expect(preview.sourceOverpaid).toBe(0);
  });
  test('prior payments are not silently copied to a new invoice', () => {
    const preview = transferPreview(25500000, 25500000, 17000000);
    expect(preview.sourceOverpaid).toBe(17000000);
    expect(preview.targetRemaining).toBe(17000000);
  });
});