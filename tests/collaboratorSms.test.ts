import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { enabledCollaboratorPhones, isCollaboratorCopyStage } from '../supabase/functions/_shared/collaboratorSms';
import { insertElementAt } from '../src/lib/orderMessageElements';

describe('collaborator SMS switch', () => {
  test('only collaborators whose switch is on receive order messages', () => {
    const phones = enabledCollaboratorPhones([
      { phone: '09121111111', sms_enabled: true },
      { phone: '09122222222', sms_enabled: false },
      { phone: '09123333333', sms_enabled: null },
    ]);
    assert.deepEqual(phones, ['09121111111']);
  });

  test('a collaborator who turned off SMS in their own account gets nothing even when switched on', () => {
    assert.deepEqual(enabledCollaboratorPhones([{ phone: '09121111111', sms_enabled: true, sms_opted_out: true }]), []);
  });

  test('customer phone and duplicates are not sent a second copy', () => {
    const phones = enabledCollaboratorPhones([
      { phone: '+989121111111', sms_enabled: true },
      { phone: '09121111111', sms_enabled: true },
      { phone: '۰۹۱۲۴۴۴۴۴۴۴', sms_enabled: true },
    ], '09124444444');
    assert.deepEqual(phones, ['09121111111']);
  });

  test('stage copies cover main order stages but not renewal/repair events or submission', () => {
    assert.equal(isCollaboratorCopyStage('executed'), true);
    assert.equal(isCollaboratorCopyStage('awaiting_payment'), true);
    assert.equal(isCollaboratorCopyStage('collected'), true);
    assert.equal(isCollaboratorCopyStage('renewal_requested'), false);
    assert.equal(isCollaboratorCopyStage('submitted'), false);
  });
});

describe('manual order message elements', () => {
  test('element is inserted at the cursor with spacing', () => {
    const r = insertElementAt('مانده سفارش:است', '{remainingAmount}', 'مانده سفارش:'.length);
    assert.equal(r.text, 'مانده سفارش: {remainingAmount} است');
    assert.equal(r.cursor, 'مانده سفارش: {remainingAmount}'.length);
  });

  test('selected text is replaced by the element', () => {
    assert.equal(insertElementAt('سلام XX عزیز', '{customerName}', 5, 7).text, 'سلام {customerName} عزیز');
  });
});
