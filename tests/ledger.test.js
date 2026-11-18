import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateRefill, applyContribution, decimal, estimateAppliance, forecast, ledgerTotals, offsetDay, toCents, usageSeries, validDay } from '../src/lib/ledger.js';

const people = [{ id: 'a', weight: 1 }, { id: 'b', weight: 2 }, { id: 'c', weight: 3 }];
const date = '2025-03-08';
const settings = { manualDaily: 3, lowThreshold: 4 };
const token = (id, day, units, createdAt = 1) => ({ id, date: day, units, createdAt, shares: [{ memberId: 'a', amountCents: 1000 }] });

test('equal and proportional allocation preserve every cent', () => {
  assert.deepEqual(allocateRefill(100, people).map((item) => item.amountCents), [34, 33, 33]);
  assert.deepEqual(allocateRefill(1000, people, 'weighted').map((item) => item.amountCents), [167, 333, 500]);
  assert.deepEqual(allocateRefill(3, people, 'weighted').map((item) => item.amountCents), [1, 1, 1]);
  assert.deepEqual(allocateRefill(7, [{ id: 'a', weight: 0.5 }, { id: 'b', weight: 1.5 }], 'weighted').map((item) => item.amountCents), [2, 5]);
});

test('contributions allocate to oldest unpaid refill, support partial payment, and block overpayment', () => {
  const tokens = [token('new', date, 40), token('old', offsetDay(date, -4), 30)];
  const part = applyContribution(tokens, [], 'a', 1200);
  assert.deepEqual(part, [{ tokenId: 'old', amountCents: 1000 }, { tokenId: 'new', amountCents: 200 }]);
  const payments = [{ memberId: 'a', amountCents: 1200, applications: part }];
  assert.equal(ledgerTotals(tokens, payments).outstanding, 800);
  assert.deepEqual(applyContribution(tokens, payments, 'a', 500, 'new'), [{ tokenId: 'new', amountCents: 500 }]);
  assert.throws(() => applyContribution(tokens, payments, 'a', 1, 'old'), /no outstanding/);
  assert.throws(() => applyContribution(tokens, payments, 'a', 801), /8\.00/);
});

test('forecast anchors to measured balance and includes only later credits', () => {
  const readings = [
    { date: offsetDay(date, -2), balanceUnits: 10, usedUnits: 2, createdAt: 8 },
    { date: offsetDay(date, -1), usedUnits: 4, createdAt: 12 },
  ];
  const tokens = [token('old', offsetDay(date, -2), 100, 2), token('same', offsetDay(date, -2), 2, 9), token('new', date, 7, 13)];
  const result = forecast(tokens, readings, settings, date);
  assert.equal(result.daily, 3);
  assert.equal(result.balance, 15);
  assert.equal(result.days, 5);
  assert.equal(result.low, false);
});

test('forecast never uses a new top-up to pay back historical estimated consumption', () => {
  const result = forecast([token('old', offsetDay(date, -20), 5), token('new', date, 10)], [], settings, date);
  assert.equal(result.balance, 10);
  assert.equal(result.percent, 100);
});

test('forecast estimates missing elapsed days and warns for short runway', () => {
  const readings = [{ date: offsetDay(date, -3), balanceUnits: 8, usedUnits: null, createdAt: 2 }];
  const result = forecast([], readings, settings, date);
  assert.equal(result.balance, 2);
  assert.equal(result.low, true);
  assert.equal(forecast([], [], settings, date).hasBalance, false);
  assert.equal(forecast([token('new', date, 0)], [], { ...settings, manualDaily: 0 }, date).days, null);
});

test('a missing usage reading is not confused with zero usage', () => {
  const readings = [{ date, usedUnits: 0 }];
  assert.deepEqual(usageSeries(readings, 2, date), [{ date: '2025-03-07', value: null }, { date, value: 0 }]);
  assert.equal(forecast([token('new', date, 5)], readings, settings, date).daily, 0);
});

test('validation rejects non-decimal amounts and impossible dates', () => {
  assert.equal(toCents('12.34'), 1234);
  assert.equal(decimal('3', 'Quantity', { places: 0 }), 3);
  for (const invalid of ['3e2', '-0.01', '', '1.009']) assert.throws(() => toCents(invalid));
  assert.throws(() => validDay('2025-02-30'));
  assert.equal(validDay('2024-02-29'), '2024-02-29');
});

test('the appliance estimator scales by hours and quantity and ignores disabled loads', () => {
  assert.equal(estimateAppliance({ watts: 120, hours: 8, quantity: 2, enabled: true }), 1.92);
  assert.equal(estimateAppliance({ watts: 120, hours: 8, quantity: 2, enabled: false }), 0);
});
