import { test } from 'node:test';
import assert from 'node:assert/strict';

const origin = process.env.SEPARATED_TEST_ORIGIN;
const key = process.env.SEPARATED_TEST_KEY;
const token = process.env.SEPARATED_TEST_TOKEN;
const orderId = process.env.SEPARATED_TEST_ORDER;

async function read(path: string) {
  if (!origin || !key || !token) throw new Error('Missing authenticated test session');
  const response = await fetch(`${origin}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('separated order rental starts at first selected month and ends at last selected month', { skip: !token || !orderId }, async () => {
  const orders = await read(`projects_v3?id=eq.${orderId}&select=id,rental_start_date,rental_end_date,billing_only,payment_amount`);
  assert.equal(orders.length, 1);
  const renewals = await read(`order_renewals?billing_order_id=eq.${orderId}&status=eq.approved&select=new_start_date,new_end_date`);
  assert.ok(renewals.length > 0);
  const starts = renewals.map((r: { new_start_date: string }) => Date.parse(r.new_start_date));
  const ends = renewals.map((r: { new_end_date: string }) => Date.parse(r.new_end_date));
  assert.equal(Date.parse(orders[0].rental_start_date), Math.min(...starts));
  assert.equal(Date.parse(orders[0].rental_end_date), Math.max(...ends));
});

test('separated order has its own code, inherited dimensions and zero duplicate base charge', { skip: !token || !orderId }, async () => {
  const [order] = await read(`projects_v3?id=eq.${orderId}&select=id,code,notes,payment_amount,original_order_id`);
  const notes = JSON.parse(order.notes);
  const [mother] = await read(`projects_v3?id=eq.${notes.billing_source_order_id}&select=id,code,notes`);
  assert.notEqual(order.code, mother.code);
  assert.deepEqual(notes.dimensions, JSON.parse(mother.notes).dimensions);
  assert.equal(Number(order.payment_amount), 0);
});