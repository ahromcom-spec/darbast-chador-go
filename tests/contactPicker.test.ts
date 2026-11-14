import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractContactFields, normalizeContactPhone } from '../src/lib/contactPicker';

describe('phone contact picker', () => {
  test('converts +98 numbers to 09 format', () => {
    assert.equal(normalizeContactPhone('+98 912 551 1652'), '09125511652');
  });
  test('converts Persian digits', () => {
    assert.equal(normalizeContactPhone('۰۹۱۲۵۵۱۱۶۵۲'), '09125511652');
  });
  test('prefers the mobile number over a landline', () => {
    const picked = extractContactFields({ name: ['علی رضایی'], tel: ['021-88776655', '0098 919 984 2554'] });
    assert.deepEqual(picked, { name: 'علی رضایی', phone: '09199842554' });
  });
  test('returns null when nothing was chosen', () => {
    assert.equal(extractContactFields(undefined), null);
  });
});
