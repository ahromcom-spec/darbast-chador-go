import { test } from 'node:test';
import assert from 'node:assert/strict';

const token = process.env.ACTIVITY_TEST_TOKEN;
const apiKey = process.env.ACTIVITY_TEST_API_KEY;
const origin = process.env.ACTIVITY_TEST_ORIGIN;
const ownOrder = process.env.ACTIVITY_TEST_OWN_ORDER;
const otherOrder = process.env.ACTIVITY_TEST_OTHER_ORDER;

async function activities(orderId: string) {
  if (!token || !apiKey || !origin) throw new Error('Missing integration test session');
  const response = await fetch(`${origin}/rest/v1/rpc/get_order_report_activity`, {
    method: 'POST',
    headers: { apikey: apiKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_order_id: orderId }),
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<Array<{ order_id: string; activity_description: string }>>;
}

test('customer can read saved daily activity for their own order', { skip: !ownOrder || !token }, async () => {
  if (!ownOrder) return;
  const rows = await activities(ownOrder);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.order_id === ownOrder));
  assert.ok(rows.some(row => Boolean(row.activity_description?.trim())));
});

test('customer cannot read daily activity belonging to another customer', { skip: !otherOrder || !token }, async () => {
  if (!otherOrder) return;
  assert.deepEqual(await activities(otherOrder), []);
});