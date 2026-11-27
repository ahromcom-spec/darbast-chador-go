import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyReportMediaScope } from '../src/lib/dailyReportMediaScope';

const rowId = '12345678-1234-4123-8123-123456789abc';
describe('daily report media belongs to one row', () => {
  test('new rows without saved IDs cannot synchronize the entire report', () => {
    assert.equal(dailyReportMediaScope(0), 'row_index.eq.0');
    assert.equal(dailyReportMediaScope(3), 'row_index.eq.3');
    assert.notEqual(dailyReportMediaScope(0), dailyReportMediaScope(3));
  });
  test('saved row fallback only accepts legacy media without an index', () => {
    assert.equal(dailyReportMediaScope(2, rowId), `row_index.eq.2,and(row_index.is.null,daily_report_order_id.eq.${rowId})`);
  });
  test('aggregated rows follow their source ID instead of another reports position', () => {
    assert.equal(dailyReportMediaScope(7, rowId, true), `daily_report_order_id.eq.${rowId}`);
  });
  test('temporary IDs never widen the row scope', () => {
    assert.equal(dailyReportMediaScope(1, 'temporary-row'), 'row_index.eq.1');
  });
});