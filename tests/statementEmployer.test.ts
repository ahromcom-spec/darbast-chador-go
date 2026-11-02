import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderStatementEmployer, statementEmployers } from '../src/lib/statementEmployer';

const override = { invoice_override: { employer_name: 'شرکت امیر تجارت سپنتا', employer_phone: '09129175809' } };
const order = { raw: { notes: override } };
test('statement uses employer configured for the order invoice', () => {
  assert.equal(statementEmployers([order], 'اقای محمد لایزال', '09186917619').name, 'شرکت امیر تجارت سپنتا');
  assert.equal(statementEmployers([order], 'اقای محمد لایزال', '09186917619').phone, '09129175809');
});
test('JSON notes preserve configured employer', () => {
  assert.equal(orderStatementEmployer({ raw: { notes: JSON.stringify(override) } }, null, null).name, 'شرکت امیر تجارت سپنتا');
});
test('mixed employers are retained rather than assigning all orders to one employer', () => {
  const result = statementEmployers([order, { raw: {} }], 'اقای محمد لایزال', '09186917619');
  assert.equal(result.name, 'شرکت امیر تجارت سپنتا / اقای محمد لایزال');
  assert.equal(result.multiple, true);
});
test('cleared or malformed settings restore original customer', () => {
  for (const notes of [null, 'not JSON', { invoice_override: { employer_name: ' ' } }]) {
    assert.equal(orderStatementEmployer({ raw: { notes } }, 'اقای محمد لایزال', null).name, 'اقای محمد لایزال');
  }
});
test('display resolution leaves financial and ownership data unchanged', () => {
  const source = { ...order, customer_id: 'original', paid: 50000000, total: 49120000 };
  const before = JSON.stringify(source);
  statementEmployers([source], null, null);
  assert.equal(JSON.stringify(source), before);
});