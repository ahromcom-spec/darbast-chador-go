import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { canReuseSmsLog, isSmsLogId } from '../supabase/functions/_shared/smsRetryLog';

const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('one message log per SMS across retries', () => {
  test('a failed attempt for the same recipient is updated instead of adding a new row', () => {
    assert.equal(canReuseSmsLog({ id, recipient: '09190419214', status: 'failed' }, '09190419214'), true);
  });
  test('a message that was already sent is never overwritten by a later send', () => {
    assert.equal(canReuseSmsLog({ id, recipient: '09190419214', status: 'sent' }, '09190419214'), false);
  });
  test('a log of another recipient is never reused', () => {
    assert.equal(canReuseSmsLog({ id, recipient: '09120000000', status: 'failed' }, '09190419214'), false);
  });
  test('without a previous log a new row is created', () => {
    assert.equal(canReuseSmsLog(null, '09190419214'), false);
    assert.equal(isSmsLogId('not-an-id'), false);
    assert.equal(isSmsLogId(id), true);
  });
});
