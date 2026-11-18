import 'fake-indexeddb/auto';
import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/schema.js';
import * as actions from '../src/db/actions.js';
import { forecast, ledgerTotals, localDay } from '../src/lib/ledger.js';

const tokenData = { amount: '1200.05', units: '40.123', date: localDay(), memberIds: ['amina', 'brian', 'chloe'], mode: 'equal' };
const utilityData = { name: 'Unit 2', rate: '31.40', manualDaily: '3.2', lowThreshold: '8.0' };

beforeEach(async () => { await db.delete(); await db.open(); await actions.initializeWorkspace(); });
after(() => db.delete());

test('seeding is idempotent, gives consistent sample metrics and reset stays empty', async () => {
  await Promise.all([actions.initializeWorkspace(), actions.initializeWorkspace()]);
  const data = await actions.readWorkspace();
  assert.equal(data.tokens.length, 4);
  assert.equal(data.settings.sample, true);
  const model = forecast(data.tokens, data.readings, data.settings);
  assert.equal(model.balance, 24.8);
  assert.ok(Math.abs(model.daily - 3.2) < 1e-9);
  assert.equal(ledgerTotals(data.tokens, data.payments).outstanding, 65000);
  await actions.updateTheme('matrix');
  await actions.resetWorkspace();
  await actions.initializeWorkspace();
  const clean = await actions.readWorkspace();
  assert.equal(clean.tokens.length, 0);
  assert.equal(clean.roommates.length, 0);
  assert.equal(clean.settings.sample, false);
  assert.equal(clean.settings.theme, 'matrix');
});

test('member mutations are scoped to own identity; changing roles honors the local passcode', async () => {
  await actions.setAdminPin({ next: '123456', confirm: '123456' });
  await actions.switchRole('member', { memberId: 'brian' });
  await assert.rejects(actions.addToken(tokenData), /Apartment Head/);
  await assert.rejects(actions.saveUtility(utilityData), /Apartment Head/);
  await assert.rejects(actions.editRefillShares('demo-1', { brian: '1200' }), /Apartment Head/);
  await assert.rejects(actions.clearPayments(), /Apartment Head/);
  await assert.rejects(actions.resetWorkspace(), /Apartment Head/);
  await assert.rejects(actions.exportLedger(), /Apartment Head/);
  await assert.rejects(actions.addContribution({ memberId: 'chloe', amount: '10', date: localDay() }), /own contributions/);
  await assert.rejects(actions.switchRole('admin', { pin: '234567' }), /incorrect/);
  await actions.addContribution({ memberId: 'brian', amount: '25', date: localDay() });
  const memberState = await actions.readWorkspace();
  assert.equal(ledgerTotals(memberState.tokens, memberState.payments).members.get('brian').outstanding, 37500);
  await actions.switchRole('admin', { pin: '123456' });
  await actions.saveUtility(utilityData);
  const backup = await actions.exportLedger();
  assert.equal(backup.preferences.rateCents, 3140);
  assert.equal(Object.hasOwn(backup.preferences, 'pin'), false);
});

test('refill shares are snapshots; debt cannot be edited below settled amounts', async () => {
  const id = await actions.addToken(tokenData);
  const added = await db.tokens.get(id);
  assert.equal(added.shares.reduce((total, part) => total + part.amountCents, 0), 120005);
  await actions.saveRoommate({ name: 'Brian Otieno', label: 'Resident', weight: '3' }, 'brian');
  assert.deepEqual((await db.tokens.get(id)).shares, added.shares);
  await assert.rejects(actions.editRefillShares('demo-1', { brian: '1200' }), /below the amount already paid/);
  await actions.editRefillShares('demo-1', { amina: '400', brian: '500', chloe: '300' });
  assert.equal((await db.tokens.get('demo-1')).splitMode, 'custom');
  await actions.clearPayments();
  assert.equal(await db.payments.count(), 0);
});

test('meter readings upsert by date and estimator entries cannot cross profiles', async () => {
  const date = localDay();
  await actions.saveReading({ date, balanceUnits: '2.25', usedUnits: '0' });
  assert.equal((await db.readings.get(date)).balanceUnits, 2.25);
  const item = { owner: 'head', key: 'test', name: 'Lamp', watts: 80, hours: 2, quantity: 1, enabled: true, custom: true };
  await actions.saveEstimator(item);
  await actions.switchRole('member', { memberId: 'brian' });
  await assert.rejects(actions.saveEstimator(item), /active role changed/);
  await actions.saveEstimator({ ...item, owner: 'resident:brian' });
  assert.equal(await db.estimates.count(), 2);
  await assert.rejects(actions.removeEstimator(item), /own custom appliances/);
});
