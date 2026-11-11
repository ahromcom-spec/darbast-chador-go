import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executionMarkerStatuses } from '../src/lib/executionMarkerStatuses';

test('a location retains all three waiting categories across its orders', () => {
  assert.deepEqual(executionMarkerStatuses([
    { id: 'approval', status: 'pending' },
    { id: 'execution', status: 'pending_execution' },
    { id: 'collection', status: 'in_progress', execution_stage: 'awaiting_collection' },
  ]), { pending: 1, pending_execution: 1, awaiting_collection: 1 });
});
test('collapsed groups count repeated orders only once and omit archived orders', () => {
  assert.deepEqual(executionMarkerStatuses([
    { id: 'a', status: 'pending' }, { id: 'a', status: 'pending' },
    { id: 'b', status: 'pending', is_archived: true },
    { id: 'c', status: 'pending', is_deep_archived: true },
  ]), { pending: 1, pending_execution: 0, awaiting_collection: 0 });
});
test('collection and completed installation are not misclassified as waiting execution', () => {
  assert.deepEqual(executionMarkerStatuses([
    { id: 'a', status: 'approved' },
    { id: 'b', status: 'approved', execution_stage: 'awaiting_collection' },
    { id: 'c', status: 'approved', execution_stage: 'awaiting_payment' },
    { id: 'd', status: 'approved', execution_stage: 'in_collection' },
  ]), { pending: 0, pending_execution: 1, awaiting_collection: 1 });
});