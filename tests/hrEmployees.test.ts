import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hrStaffCode, isPersonnelCode, matchesHRSearch, normalizeHRPhone, resolveHRStatus } from '../src/lib/hrEmployees';

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

describe('HR personnel code', () => {
  test('staff without a phone use their 8-digit personnel code in reports', () => {
    assert.equal(hrStaffCode({ id: 'abc123456', phone_number: null, personnel_code: '37631919' }), '37631919');
  });
  test('staff with a phone and no personnel code use the phone', () => {
    assert.equal(hrStaffCode({ id: 'x', phone_number: '09125511652', personnel_code: null }), '09125511652');
  });
  test('staff who later get a phone use the phone instead of their personnel code', () => {
    assert.equal(hrStaffCode({ id: 'x', phone_number: '09199842554', personnel_code: '97527557' }), '09199842554');
  });
  test('a personnel code is exactly 8 digits', () => {
    assert.equal(isPersonnelCode('37631919'), true);
    assert.equal(isPersonnelCode('3763191'), false);
    assert.equal(isPersonnelCode('HR-d36ed0'), false);
  });
  test('staff can be found by personnel code', () => {
    assert.equal(matchesHRSearch({ full_name: 'متین قاسمی', phone_number: null, personnel_code: '97527557', position: null, department: null }, '۹۷۵۲'), true);
  });
});
