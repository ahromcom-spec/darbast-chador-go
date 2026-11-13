import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesHRSearch, normalizeHRPhone, resolveHRStatus } from '../src/lib/hrEmployees';

const emp = { full_name: 'علی محمدی', phone_number: '09125511652', position: 'سرپرست،پیمانکار', department: 'فروش' };

describe('HR employee search', () => {
  test('finds an employee by part of the phone number typed in Persian digits', () => {
    assert.equal(matchesHRSearch(emp, '۵۵۱۱'), true);
  });
  test('finds an employee by name', () => {
    assert.equal(matchesHRSearch(emp, 'محمدی'), true);
  });
  test('finds an employee by position', () => {
    assert.equal(matchesHRSearch(emp, 'پیمانکار'), true);
  });
  test('does not match an unrelated query', () => {
    assert.equal(matchesHRSearch(emp, 'راننده'), false);
  });
});

describe('HR employee phone and status after edit', () => {
  test('a Persian-digit +98 phone is normalized to 09...', () => {
    assert.equal(normalizeHRPhone('+۹۸۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  });
  test('removing the phone makes the employee active', () => {
    assert.equal(resolveHRStatus('pending_registration', null, null), 'active');
  });
  test('a new phone without an account waits for registration', () => {
    assert.equal(resolveHRStatus('active', '09123456789', null), 'pending_registration');
  });
  test('a manually deactivated employee stays inactive', () => {
    assert.equal(resolveHRStatus('inactive', '09123456789', 'u1'), 'inactive');
  });
});
