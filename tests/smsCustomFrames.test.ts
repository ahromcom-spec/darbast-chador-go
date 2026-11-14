import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frameAppliesTo, resolveFrameRecipients, parseCustomPhones, validateCustomFrame, CUSTOM_FRAME_STAGE_KEYS,
  isCustomFrameKey, makeCustomFrameKey, MAX_CUSTOM_PHONES,
} from '../supabase/functions/_shared/smsCustomFrames';

const WITH_MATERIALS = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d';
const CARPET = 'da5fb7be-e703-4dc1-87e8-2386eb1697b9';

const frame = (over: Record<string, unknown> = {}) => ({
  key: 'custom_abc123', scope: 'custom', stage_key: 'paid', enabled: true,
  service_subcategory_ids: [], excluded_subcategory_ids: [],
  recipient_kinds: ['customer'], recipient_roles: [], recipient_phones: [],
  ...over,
});

describe('custom frame stage and service matching', () => {
  test('covers every order stage including rejection', () => {
    for (const s of ['submitted', 'approved', 'rejected', 'in_progress', 'executed', 'rental_started', 'awaiting_payment', 'paid', 'awaiting_collection', 'in_collection', 'collected', 'completed']) {
      assert.ok(CUSTOM_FRAME_STAGE_KEYS.includes(s), s);
    }
  });
  test('a frame for all services applies to any service at its stage only', () => {
    assert.equal(frameAppliesTo(frame(), 'paid', CARPET), true);
    assert.equal(frameAppliesTo(frame(), 'executed', CARPET), false);
  });
  test('a frame targeted at a service skips other services', () => {
    const f = frame({ service_subcategory_ids: [WITH_MATERIALS] });
    assert.equal(frameAppliesTo(f, 'paid', WITH_MATERIALS), true);
    assert.equal(frameAppliesTo(f, 'paid', CARPET), false);
  });
  test('excluded services and disabled frames never send', () => {
    assert.equal(frameAppliesTo(frame({ excluded_subcategory_ids: [CARPET] }), 'paid', CARPET), false);
    assert.equal(frameAppliesTo(frame({ enabled: false }), 'paid', CARPET), false);
    assert.equal(frameAppliesTo(frame({ scope: 'customer' }), 'paid', CARPET), false);
  });
});

describe('custom frame recipients', () => {
  const ctx = {
    customerPhone: '۰۹۱۲۱۱۱۱۱۱۱',
    collaboratorPhones: ['09122222222', '+989122222222'],
    rolePhones: { finance_manager: ['09123333333'], ceo: ['09125511494', '09123333333'] },
  };
  test('customer, collaborators, management sections and custom phones, without duplicates', () => {
    const f = frame({ recipient_kinds: ['customer', 'collaborators', 'roles', 'phones'], recipient_roles: ['finance_manager', 'ceo'], recipient_phones: ['09124444444', '09125511494'] });
    const r = resolveFrameRecipients(f, ctx);
    assert.deepEqual(r.map((x) => x.phone), ['09121111111', '09122222222', '09123333333', '09125511494', '09124444444']);
    assert.deepEqual(r.map((x) => x.audience), ['customer', 'customer', 'staff', 'staff', 'staff']);
  });
  test('customer who turned off SMS, or a stage change marked "do not notify customer", gets nothing', () => {
    assert.equal(resolveFrameRecipients(frame(), { ...ctx, customerSmsDisabled: true }).length, 0);
    assert.equal(resolveFrameRecipients(frame(), { ...ctx, skipCustomer: true }).length, 0);
  });
  test('the customer number is never reached through a staff route', () => {
    const f = frame({ recipient_kinds: ['phones'], recipient_phones: ['09121111111'] });
    assert.equal(resolveFrameRecipients(f, { ...ctx, customerSmsDisabled: true }).length, 0);
  });
  test('only the roles chosen in the frame receive it', () => {
    const f = frame({ recipient_kinds: ['roles'], recipient_roles: ['finance_manager'] });
    assert.deepEqual(resolveFrameRecipients(f, ctx).map((x) => x.phone), ['09123333333']);
  });
});

describe('custom frame validation', () => {
  test('custom phones are normalised and invalid ones reported', () => {
    const r = parseCustomPhones('۰۹۱۲۱۲۳۴۵۶۷\n+98 935 123 4567, 12345');
    assert.deepEqual(r.valid, ['09121234567', '09351234567']);
    assert.deepEqual(r.invalid, ['12345']);
    const many = Array.from({ length: 25 }, (_, i) => `0912${String(1000000 + i)}`).join('\n');
    assert.equal(parseCustomPhones(many).valid.length, MAX_CUSTOM_PHONES);
  });
  test('a frame needs a title, stage, text and at least one recipient', () => {
    assert.ok(validateCustomFrame({ ...frame({ recipient_kinds: [] }), title: 'x', template: 'y' }).length > 0);
    assert.ok(validateCustomFrame({ ...frame({ recipient_kinds: ['roles'] }), title: 'x', template: 'y' }).length > 0);
    assert.ok(validateCustomFrame({ ...frame({ stage_key: 'unknown' }), title: 'x', template: 'y' }).length > 0);
    assert.deepEqual(validateCustomFrame({ ...frame(), title: 'x', template: 'y' }), []);
  });
  test('only custom frame keys are accepted by the sender', () => {
    assert.equal(isCustomFrameKey(makeCustomFrameKey()), true);
    assert.equal(isCustomFrameKey('paid'), false);
    assert.equal(isCustomFrameKey('custom_x; drop'), false);
  });
});
