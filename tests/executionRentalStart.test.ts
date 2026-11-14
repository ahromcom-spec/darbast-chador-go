import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { rentalStartFromExecution } from '../src/lib/executionRentalStart';

describe('execution date becomes rental start date', () => {
  test('moving to "executed" with a date sets the rental start to that date', () => {
    assert.equal(rentalStartFromExecution('order_executed', '2026-11-13T08:30:00.000Z', false), '2026-11-13T08:30:00.000Z');
  });
  test('scaffolding without materials has no rental start', () => {
    assert.equal(rentalStartFromExecution('order_executed', '2026-11-13T08:30:00.000Z', true), null);
  });
  test('other stages never change the rental start', () => {
    assert.equal(rentalStartFromExecution('awaiting_payment', '2026-11-13T08:30:00.000Z', false), null);
  });
  test('no date entered leaves the rental start unchanged', () => {
    assert.equal(rentalStartFromExecution('order_executed', '', false), null);
  });
});
