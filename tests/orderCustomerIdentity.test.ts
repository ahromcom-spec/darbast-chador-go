import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrderCustomerIdentity } from '../src/lib/orderCustomerIdentity';

test('separated order retains original customer name when profile is unavailable', () => {
  assert.equal(resolveOrderCustomerIdentity({ customer_name: 'آقای مرسلی (فردوسی)' }, null).customer_name, 'آقای مرسلی (فردوسی)');
});
test('separated order retains original customer code', () => {
  assert.equal(resolveOrderCustomerIdentity({ customer_code: '2002050' }, { customer_code: null }).customer_code, '2002050');
});
test('authoritative order identity restores phone despite an empty invoice input', () => {
  assert.equal(resolveOrderCustomerIdentity({ customer_name: 'نامشخص' }, { customer_phone: '09121530451' }).customer_phone, '09121530451');
});