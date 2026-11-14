import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSmsTemplate, findServiceConflicts } from '../supabase/functions/_shared/smsTemplateSelection';

const WITH_MATERIALS = '3b44e5ee-8a2c-4e50-8f70-df753df8ef3d';
const NO_MATERIALS = '527e9baa-54c6-4131-81cb-32d29ebae91a';
const CARPET = 'da5fb7be-e703-4dc1-87e8-2386eb1697b9';

const general = { key: 'executed', stage_key: 'executed', enabled: true, service_subcategory_ids: [], excluded_subcategory_ids: [CARPET] };
const scaffold = { key: 'executed__svc_a', stage_key: 'executed', enabled: true, service_subcategory_ids: [WITH_MATERIALS] };

describe('which SMS an order receives for its service', () => {
  test('an order of a service with its own message gets that service-specific message', () => {
    const r = selectSmsTemplate([general, scaffold], 'executed', WITH_MATERIALS);
    assert.equal(r.kind, 'specific');
    assert.equal(r.kind !== 'none' && r.template.key, 'executed__svc_a');
  });
  test('an order of another service gets the general message', () => {
    const r = selectSmsTemplate([general, scaffold], 'executed', NO_MATERIALS);
    assert.equal(r.kind, 'general');
  });
  test('a service excluded from the general message receives nothing', () => {
    assert.equal(selectSmsTemplate([general, scaffold], 'executed', CARPET).kind, 'excluded');
  });
  test('a switched-off service-specific message falls back to the general message', () => {
    const r = selectSmsTemplate([general, { ...scaffold, enabled: false }], 'executed', WITH_MATERIALS);
    assert.equal(r.kind, 'general');
  });
  test('when the general message is switched off and no specific one matches, nothing is sent', () => {
    assert.equal(selectSmsTemplate([{ ...general, enabled: false }, scaffold], 'executed', NO_MATERIALS).kind, 'disabled');
  });
  test('an order with unknown service gets the general message', () => {
    assert.equal(selectSmsTemplate([general, scaffold], 'executed', null).kind, 'general');
  });
  test('the same service chosen in two active messages of one stage is reported as a conflict', () => {
    const c = findServiceConflicts([scaffold, { ...scaffold, key: 'executed__svc_b' }]);
    assert.deepEqual(c.get(`executed|${WITH_MATERIALS}`), ['executed__svc_a', 'executed__svc_b']);
  });
});
