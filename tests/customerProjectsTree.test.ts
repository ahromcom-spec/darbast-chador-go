import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerProjectsTree,
  filterCustomerProjectsTree,
  actionableOrders,
  collaboratorTargets,
  type TreeOrderInput,
} from '../src/lib/customerProjectsTree';

const order = (id: string, hier: string, extra: Partial<TreeOrderInput> = {}): TreeOrderInput => ({
  id, code: `100${id}`, customer_id: 'c1', hierarchy_project_id: hier, status: 'approved',
  execution_stage: null, is_archived: false, address: 'قم، شیخ آباد', detailed_address: 'انبار',
  created_at: `2026-01-0${id}T00:00:00Z`, ...extra,
});

const customers = new Map([['c1', { full_name: 'رضا محمدی', phone_number: '09120000000', customer_code: '1000', user_id: 'u1' }]]);
const projects = new Map([
  ['h1', { id: 'h1', location_id: 'L1', title: '', service_label: 'داربست فلزی - فروش اجناس' }],
  ['h2', { id: 'h2', location_id: 'L1', title: '', service_label: 'داربست فلزی - اجرای داربست به همراه اجناس' }],
  ['h3', { id: 'h3', location_id: 'L2', title: '', service_label: 'خدمات متفرقه' }],
]);
const locations = new Map([
  ['L1', { id: 'L1', title: 'انبار', address_line: 'قم، شیخ آباد، معصومیه' }],
  ['L2', { id: 'L2', title: 'منزل', address_line: 'قم، توحید' }],
]);

describe('customer projects tree', () => {
  const tree = buildCustomerProjectsTree(
    [order('1', 'h1'), order('2', 'h2'), order('3', 'h2', { is_archived: true }), order('4', 'h3')],
    customers, projects, locations,
  );

  test('groups customer → address → project', () => {
    assert.equal(tree.length, 1);
    assert.equal(tree[0].addresses.length, 2);
    const anbar = tree[0].addresses.find((a) => a.locationId === 'L1')!;
    assert.equal(anbar.projects.length, 2);
  });

  test('whole-address action targets only active orders of all its projects', () => {
    const anbar = tree[0].addresses.find((a) => a.locationId === 'L1')!;
    assert.deepEqual(actionableOrders(anbar.projects).map((o) => o.id).sort(), ['1', '2']);
  });

  test('a single chosen project in an address leaves the other project untouched', () => {
    const anbar = tree[0].addresses.find((a) => a.locationId === 'L1')!;
    const sale = anbar.projects.filter((p) => p.id === 'h1');
    assert.deepEqual(actionableOrders(sale).map((o) => o.id), ['1']);
  });

  test('search by address keeps the address, by service keeps only that project', () => {
    assert.equal(filterCustomerProjectsTree(tree, 'توحید')[0].addresses.length, 1);
    const bySvc = filterCustomerProjectsTree(tree, 'فروش اجناس');
    assert.equal(bySvc[0].addresses.length, 1);
    assert.equal(bySvc[0].addresses[0].projects.length, 1);
    assert.equal(filterCustomerProjectsTree(tree, '۰۹۱۲').length, 1);
  });

  test('collaborator is not added twice nor to an order owned by that phone', () => {
    const r = collaboratorTargets(
      ['1', '2', '4'],
      '09300000000',
      [{ order_id: '2', invitee_phone_number: '09300000000', status: 'accepted' },
       { order_id: '4', invitee_phone_number: '09300000000', status: 'exited' }],
      new Map([['1', '09300000000']]),
    );
    assert.deepEqual(r, { add: ['4'], alreadyCollaborator: ['2'], owner: ['1'] });
  });
});
