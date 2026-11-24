import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventStageFor, applyEventVariables, sanitizeEventVars, renewalMonthLabel, isRecentEvent, eventVariablesFor,
} from '../supabase/functions/_shared/smsOrderEvents';
import {
  CUSTOM_FRAME_STAGE_KEYS, resolveFrameRecipients, validateCustomFrame, recipientKindLabel,
} from '../supabase/functions/_shared/smsCustomFrames';

describe('renewal, repair, discount, transfer and collaborator stages exist', () => {
  test('every new frame stage is selectable', () => {
    for (const s of ['renewal_requested', 'renewal_approved', 'renewal_rejected', 'repair_requested', 'repair_approved',
      'repair_scheduled', 'repair_completed', 'repair_rejected', 'discount_applied', 'transfer_requested',
      'transfer_completed', 'transfer_rejected', 'collaborator_invited', 'collaborator_added']) {
      assert.ok(CUSTOM_FRAME_STAGE_KEYS.includes(s), s);
    }
  });
});

describe('which change triggers which frame stage', () => {
  test('renewals: request, manager-created approval, approval and rejection', () => {
    assert.equal(eventStageFor('order_renewals', 'INSERT', null, 'pending'), 'renewal_requested');
    assert.equal(eventStageFor('order_renewals', 'INSERT', null, 'approved'), 'renewal_approved');
    assert.equal(eventStageFor('order_renewals', 'UPDATE', 'pending', 'approved'), 'renewal_approved');
    assert.equal(eventStageFor('order_renewals', 'UPDATE', 'pending', 'rejected'), 'renewal_rejected');
    assert.equal(eventStageFor('order_renewals', 'UPDATE', 'approved', 'approved'), null);
  });
  test('repairs follow each step of the repair workflow', () => {
    assert.equal(eventStageFor('repair_requests', 'INSERT', null, 'pending'), 'repair_requested');
    assert.equal(eventStageFor('repair_requests', 'UPDATE', 'pending', 'approved'), 'repair_approved');
    assert.equal(eventStageFor('repair_requests', 'UPDATE', 'approved', 'awaiting_repair'), 'repair_scheduled');
    assert.equal(eventStageFor('repair_requests', 'UPDATE', 'awaiting_repair', 'repaired'), 'repair_completed');
    assert.equal(eventStageFor('repair_requests', 'UPDATE', 'pending', 'rejected'), 'repair_rejected');
    assert.equal(eventStageFor('repair_requests', 'UPDATE', 'repaired', 'completed'), null);
  });
  test('transfers message only after manager approval, on completion and on rejection', () => {
    assert.equal(eventStageFor('order_transfer_requests', 'INSERT', null, 'pending_manager'), null);
    assert.equal(eventStageFor('order_transfer_requests', 'UPDATE', 'manager_approved', 'pending_recipient'), 'transfer_requested');
    assert.equal(eventStageFor('order_transfer_requests', 'UPDATE', 'pending_recipient', 'pending_registration'), null);
    assert.equal(eventStageFor('order_transfer_requests', 'UPDATE', 'recipient_accepted', 'completed'), 'transfer_completed');
    assert.equal(eventStageFor('order_transfer_requests', 'UPDATE', 'pending_manager', 'manager_rejected'), 'transfer_rejected');
  });
  test('collaborators: invitation after approval, and staff added directly', () => {
    assert.equal(eventStageFor('order_collaborators', 'INSERT', null, 'pending_manager'), null);
    assert.equal(eventStageFor('order_collaborators', 'UPDATE', 'manager_approved', 'pending'), 'collaborator_invited');
    assert.equal(eventStageFor('order_collaborators', 'UPDATE', 'pending', 'accepted'), 'collaborator_added');
    assert.equal(eventStageFor('order_collaborators', 'INSERT', null, 'accepted'), 'collaborator_added');
  });
  test('discount changes map to the discount stage', () => {
    assert.equal(eventStageFor('projects_v3', 'UPDATE', null, null), 'discount_applied');
  });
});

describe('event person recipient (transfer recipient / collaborator)', () => {
  const frame = (stage: string, kinds: string[]) => ({
    key: 'custom_abc123', scope: 'custom', stage_key: stage, enabled: true, recipient_kinds: kinds,
    recipient_roles: [], recipient_phones: [], title: 't', template: 'x',
  });
  test('the invited collaborator receives the collaboration message', () => {
    const r = resolveFrameRecipients(frame('collaborator_added', ['event_person', 'customer']), {
      customerPhone: '09121111111', eventPersonPhone: '09122222222',
    });
    assert.deepEqual(r.map((x) => x.phone), ['09121111111', '09122222222']);
  });
  test('a person who turned SMS off is skipped', () => {
    const r = resolveFrameRecipients(frame('transfer_completed', ['event_person']), {
      eventPersonPhone: '09122222222', eventPersonSmsDisabled: true,
    });
    assert.equal(r.length, 0);
  });
  test('the event person is not available on stages without one', () => {
    assert.equal(resolveFrameRecipients(frame('renewal_approved', ['event_person']), { eventPersonPhone: '09122222222' }).length, 0);
    assert.ok(validateCustomFrame(frame('renewal_approved', ['event_person'])).length > 0);
    assert.deepEqual(validateCustomFrame(frame('transfer_requested', ['event_person'])), []);
  });
  test('in a completed transfer the customer means the previous owner', () => {
    assert.equal(recipientKindLabel('customer', 'transfer_completed'), 'مالک قبلی سفارش');
    assert.equal(recipientKindLabel('event_person', 'collaborator_added'), 'همکار اضافه‌شده');
  });
});

describe('event variables', () => {
  test('renewal number 1 is the second month', () => {
    assert.equal(renewalMonthLabel(1), 'ماه دوم');
    assert.equal(renewalMonthLabel(2), 'ماه سوم');
  });
  test('filled and missing variables', () => {
    const msg = applyEventVariables('تخفیف {discountAmount} - همکار {personName}', { discountAmount: '۵۰۰٬۰۰۰ تومان' });
    assert.equal(msg, 'تخفیف ۵۰۰٬۰۰۰ تومان - همکار ثبت نشده');
  });
  test('unknown keys are dropped from server-provided variables', () => {
    assert.deepEqual(sanitizeEventVars({ personName: 'علی', code: 'hack', evil: 'x' }), { personName: 'علی' });
  });
  test('only recent events are accepted', () => {
    const now = Date.parse('2026-11-15T00:30:00Z');
    assert.equal(isRecentEvent(['2026-11-15T00:20:00Z'], now), true);
    assert.equal(isRecentEvent(['2026-11-15T00:10:00Z'], now), false);
    assert.equal(isRecentEvent([null], now), false);
  });
  test('each stage group offers its own variables', () => {
    assert.ok(eventVariablesFor('repair').some((v) => v.token === '{repairCost}'));
    assert.ok(!eventVariablesFor('repair').some((v) => v.token === '{personName}'));
    assert.equal(eventVariablesFor('order').length, 0);
  });
});

import { formatAllocation, statementSummary, paymentMethodLabel, STATEMENT_EVENT_STAGE } from '../supabase/functions/_shared/smsStatementEvents';
import { frameAppliesTo, isStatementStage } from '../supabase/functions/_shared/smsCustomFrames';

describe('statement payment, discount and closing messages', () => {
  test('statement stages are selectable frame stages', () => {
    for (const s of Object.values(STATEMENT_EVENT_STAGE)) {
      assert.ok(CUSTOM_FRAME_STAGE_KEYS.includes(s), s);
      assert.ok(isStatementStage(s));
    }
  });
  test('a 12 million payment over two orders lists the share of each order and statement', () => {
    const text = formatAllocation([
      { orderCode: '1000539', statementNumber: 3, amount: 8_000_000 },
      { orderCode: '1000540', statementNumber: 4, amount: 4_000_000 },
    ]);
    assert.equal(text, 'سفارش 1000539 (صورتحساب ۳): ۸٬۰۰۰٬۰۰۰ تومان، سفارش 1000540 (صورتحساب ۴): ۴٬۰۰۰٬۰۰۰ تومان');
  });
  test('remaining subtracts payments and discount, never below zero', () => {
    const orders = [{ total_price: 10_000_000 }, { total_price: 0, payment_amount: 5_000_000 }, { total_price: 9_000_000, status: 'rejected' }];
    assert.deepEqual(statementSummary(orders, 12_000_000, 500_000), { total: 15_000_000, paid: 12_000_000, discount: 500_000, remaining: 2_500_000 });
    assert.equal(statementSummary(orders, 20_000_000, 0).remaining, 0);
  });
  test('payment methods are written in Persian', () => {
    assert.equal(paymentMethodLabel('card_transfer'), 'کارت به کارت');
    assert.equal(paymentMethodLabel('cheque'), 'چک');
  });
  test('statement frames ignore service filters only when untargeted', () => {
    const f = { key: 'custom_abc123', scope: 'custom', stage_key: 'statement_payment', enabled: true };
    assert.equal(frameAppliesTo(f, 'statement_payment', null), true);
  });
  test('statement variables are filled', () => {
    assert.equal(applyEventVariables('صورتحساب {statementNumber}', { statementNumber: '۳' }), 'صورتحساب ۳');
  });
});
