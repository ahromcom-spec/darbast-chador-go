import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { partitionLocationOrders } from '../src/lib/locationDeletionRules';

describe('partitionLocationOrders', () => {
  test('awaiting-approval orders are removed with the address', () => {
    const r = partitionLocationOrders([{ id: 'a', status: 'pending' }]);
    assert.deepEqual(r, { removable: ['a'], blocking: [] });
  });

  test('an approved order blocks deleting the address', () => {
    const r = partitionLocationOrders([{ id: 'a', status: 'pending' }, { id: 'b', status: 'pending_execution' }]);
    assert.deepEqual(r.blocking, ['b']);
  });

  test('an archived awaiting-approval order is never removed and blocks deletion', () => {
    const r = partitionLocationOrders([{ id: 'a', status: 'pending', is_archived: true }]);
    assert.deepEqual(r, { removable: [], blocking: ['a'] });
  });
});
