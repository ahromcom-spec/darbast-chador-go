import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteStatement } from '../src/lib/statementDeletion';

describe('statement deletion eligibility', () => {
  test('a closed statement with no orders can be deleted', () => {
    assert.equal(canDeleteStatement('closed', 0), true);
  });
  test('an open statement cannot be deleted even when empty', () => {
    assert.equal(canDeleteStatement('open', 0), false);
  });
  test('a closed statement with any linked order cannot be deleted', () => {
    assert.equal(canDeleteStatement('closed', 1), false);
  });
});