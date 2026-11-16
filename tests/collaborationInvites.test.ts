import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPendingInviteStatus } from '../src/lib/collaborationInviteStatus';

describe('collaboration invite preview', () => {
  test('manager-approved invitations awaiting the invitee are previewable', () => {
    assert.equal(isPendingInviteStatus('pending'), true);
    assert.equal(isPendingInviteStatus('manager_approved'), true);
    assert.equal(isPendingInviteStatus('pending_registration'), true);
  });

  test('invitations still awaiting management or already answered are not previews', () => {
    assert.equal(isPendingInviteStatus('pending_manager'), false);
    assert.equal(isPendingInviteStatus('manager_rejected'), false);
    assert.equal(isPendingInviteStatus('accepted'), false);
    assert.equal(isPendingInviteStatus('rejected'), false);
  });
});
