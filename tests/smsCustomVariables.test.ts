import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySmsCustomVariables,
  validateSmsToken,
  type SmsOrderSnapshot,
} from '../supabase/functions/_shared/smsCustomVariables';

// پرداختی که امروز (۲۲ آبان ۱۴۰۵) ثبت شده ولی تاریخ واریزش ۱۰ روز قبل (۱۲ آبان ۱۴۰۵) است
const snapshot: SmsOrderSnapshot = {
  order: { total_price: 10_000_000, total_paid: 7_000_000, created_at: '2026-10-01T08:00:00Z' },
  payments: [
    { amount: 3_000_000, payment_date: '2026-10-10T08:00:00Z', created_at: '2026-10-10T08:05:00Z' },
    { amount: 4_000_000, payment_date: '2026-11-03T08:00:00Z', created_at: '2026-11-13T09:00:00Z' },
  ],
  renewals: [],
  collection: null,
};

describe('custom SMS elements', () => {
  test('deposit date uses the date chosen when registering the payment, not the day it was entered', () => {
    const out = applySmsCustomVariables('واریز: {تاریخ_واریز}', [
      { token: 'تاریخ_واریز', source_key: 'payment_latest_deposit_date', format: 'date' },
    ], snapshot);
    assert.equal(out, 'واریز: 1405/08/12');
  });

  test('registration date shows the day the payment was entered in the site', () => {
    const out = applySmsCustomVariables('{ثبت}', [
      { token: 'ثبت', source_key: 'payment_latest_registered_at', format: 'date' },
    ], snapshot);
    assert.equal(out, '1405/08/22');
  });

  test('latest payment amount is the most recently registered payment', () => {
    const out = applySmsCustomVariables('{مبلغ}', [
      { token: 'مبلغ', source_key: 'payment_latest_amount', format: 'toman' },
    ], snapshot);
    assert.equal(out, '۴٬۰۰۰٬۰۰۰ تومان');
  });

  test('remaining amount is total price minus all payments', () => {
    const out = applySmsCustomVariables('{مانده}', [
      { token: 'مانده', source_key: 'order_remaining', format: 'number' },
    ], snapshot);
    assert.equal(out, '۳٬۰۰۰٬۰۰۰');
  });

  test('missing data shows the fallback text', () => {
    const out = applySmsCustomVariables('{جمع}', [
      { token: 'جمع', source_key: 'collection_requested_date', fallback: 'هنوز ثبت نشده' },
    ], snapshot);
    assert.equal(out, 'هنوز ثبت نشده');
  });

  test('a disabled element writes only its fallback text, never the raw name', () => {
    const out = applySmsCustomVariables('{x1}', [
      { token: 'x1', source_key: 'payment_latest_amount', enabled: false, fallback: '-' },
    ], snapshot);
    assert.equal(out, '-');
  });

  test('names of built-in variables cannot be reused', () => {
    assert.notEqual(validateSmsToken('paymentDate'), null);
    assert.equal(validateSmsToken('{تاریخ واریز}'), null);
  });
});
