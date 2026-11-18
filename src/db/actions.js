import { db, settingsId, defaults, colors, themeIds } from './schema.js';
import { demoWorkspace } from './demo.js';
import { allocateRefill, applyContribution, byNewest, cleanText, decimal, ledgerTotals, sum, toCents, validDay } from '../lib/ledger.js';

const allTables = [db.settings, db.roommates, db.tokens, db.readings, db.payments, db.estimates];
const adminOnly = (settings) => {
  if (settings?.role !== 'admin') throw new Error('Only the Apartment Head can make this change.');
};
const inLedger = (tables, fn, admin = false) => db.transaction('rw', [db.settings, ...tables], async () => {
  const settings = await db.settings.get(settingsId);
  if (!settings) throw new Error('The ledger is still starting.');
  if (admin) adminOnly(settings);
  return fn(settings);
});

export function initializeWorkspace() {
  return db.transaction('rw', allTables, async () => {
    if (await db.settings.get(settingsId)) return;
    const sample = demoWorkspace();
    await Promise.all(allTables.slice(1, -1).map((table) => table.bulkAdd(sample[table.name])));
    await db.settings.add(sample.settings);
  });
}

export async function readWorkspace() {
  return db.transaction('r', allTables, async () => {
    const [settings, roommates, tokens, readings, payments, estimates] = await Promise.all(allTables.map((table) => table.toArray()));
    return { settings: settings[0], roommates: roommates.sort((a, b) => a.createdAt - b.createdAt), tokens: tokens.sort(byNewest), readings: readings.sort(byNewest), payments: payments.sort(byNewest), estimates };
  });
}

export function updateTheme(theme) {
  if (!themeIds.includes(theme)) throw new Error('Choose a valid theme.');
  return inLedger([], () => db.settings.update(settingsId, { theme }));
}

export function saveUtility(input) {
  return inLedger([], () => db.settings.update(settingsId, {
    name: cleanText(input.name, 48, true),
    rateCents: toCents(input.rate, 'Utility rate', 0),
    manualDaily: decimal(input.manualDaily, 'Daily consumption', { max: 1000, places: 3 }),
    lowThreshold: decimal(input.lowThreshold, 'Low-balance threshold', { max: 10000, places: 3 }),
  }), true);
}

export function saveRoommate(input, id) {
  return inLedger([db.roommates], async () => {
    const name = cleanText(input.name, 48, true);
    const label = cleanText(input.label, 32) || 'Resident';
    const weight = decimal(input.weight, 'Share weight', { min: 0.01, max: 100 });
    const all = await db.roommates.toArray();
    if (all.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) throw new Error('A roommate with that name already exists.');
    if (id) {
      if (!(await db.roommates.update(id, { name, label, weight }))) throw new Error('Roommate not found.');
      return id;
    }
    if (all.length >= 100) throw new Error('This household already has 100 roommate profiles.');
    const memberId = crypto.randomUUID();
    await db.roommates.add({ id: memberId, name, label, weight, color: colors[all.length % colors.length], archived: false, createdAt: Date.now() });
    return memberId;
  }, true);
}

export function setRoommateArchived(id, archived) {
  return inLedger([db.roommates], async (settings) => {
    if (!(await db.roommates.update(id, { archived: Boolean(archived) }))) throw new Error('Roommate not found.');
    if (archived && settings.activeMemberId === id) await db.settings.update(settingsId, { activeMemberId: null });
  }, true);
}

export function addToken(input) {
  return inLedger([db.tokens, db.roommates], async (settings) => {
    const amountCents = toCents(input.amount, 'Amount paid');
    const units = decimal(input.units, 'Units received', { min: 0.001, places: 3 });
    const date = validDay(input.date);
    const all = await db.roommates.toArray();
    const selected = [...new Set(input.memberIds ?? [])];
    const members = all.filter((person) => selected.includes(person.id) && !person.archived);
    if (members.length !== selected.length) throw new Error('Select active roommates for this refill.');
    const mode = members.length ? input.mode : 'none';
    const shares = members.length ? allocateRefill(amountCents, members, mode) : [];
    const id = crypto.randomUUID();
    await db.tokens.add({ id, units, amountCents, date, shares, splitMode: mode, note: cleanText(input.note, 160), createdAt: Date.now(), recordedBy: all.find((r) => !r.archived && /^apartment head$/i.test(r.label))?.name ?? (settings.sample ? 'Amina Wanjiku' : 'Apartment Head') });
    return id;
  }, true);
}

export function saveReading(input) {
  return inLedger([db.readings], async () => {
    const date = validDay(input.date);
    const usedUnits = String(input.usedUnits ?? '').trim() === '' ? null : decimal(input.usedUnits, 'Daily consumption', { places: 3 });
    const balanceUnits = String(input.balanceUnits ?? '').trim() === '' ? null : decimal(input.balanceUnits, 'Meter balance', { places: 3 });
    if (usedUnits == null && balanceUnits == null) throw new Error('Enter consumption, a remaining meter balance, or both.');
    const previous = await db.readings.get(date);
    const createdAt = previous?.createdAt ?? Date.now();
    const balanceAt = balanceUnits == null ? null : balanceUnits === previous?.balanceUnits ? previous?.balanceAt ?? createdAt : Date.now();
    return db.readings.put({ date, usedUnits, balanceUnits, balanceAt, createdAt });
  }, true);
}

export function editRefillShares(id, amounts) {
  return inLedger([db.tokens, db.roommates, db.payments], async () => {
    const token = await db.tokens.get(id);
    if (!token) throw new Error('Refill not found.');
    const roommates = await db.roommates.toArray();
    const allowedIds = new Set(roommates.filter((m) => !m.archived || token.shares.some((s) => s.memberId === m.id)).map((m) => m.id));
    const shares = Object.entries(amounts).map(([memberId, input]) => {
      if (!allowedIds.has(memberId)) throw new Error('One of those roommate profiles is unavailable.');
      const amountCents = toCents(input === '' ? '0' : input, 'Share', 0);
      return { memberId, amountCents };
    }).filter((part) => part.amountCents > 0);
    const assigned = sum(shares.map((part) => part.amountCents));
    if (assigned !== 0 && assigned !== token.amountCents) throw new Error('Assigned shares must add up to the original refill cost.');
    const { paidByToken } = ledgerTotals([token], await db.payments.toArray());
    for (const [memberId, paid] of paidByToken.get(id) ?? []) {
      const part = shares.find((share) => share.memberId === memberId);
      if (!part || part.amountCents < paid) throw new Error('A share cannot go below the amount already paid.');
    }
    return db.tokens.update(id, { shares, splitMode: assigned ? 'custom' : 'none' });
  }, true);
}

export function addContribution(input) {
  return inLedger([db.roommates, db.tokens, db.payments], async (settings) => {
    const memberId = input.memberId;
    if (settings.role !== 'admin' && memberId !== settings.activeMemberId) throw new Error('You can only record your own contributions.');
    if (!(await db.roommates.get(memberId))) throw new Error('Choose a valid roommate profile.');
    const amountCents = toCents(input.amount, 'Contribution');
    const date = validDay(input.date);
    const [tokens, payments] = await Promise.all([db.tokens.toArray(), db.payments.toArray()]);
    const applications = applyContribution(tokens.filter((token) => token.date <= date), payments, memberId, amountCents, input.tokenId || undefined);
    const id = crypto.randomUUID();
    await db.payments.add({ id, memberId, date, amountCents, applications, note: cleanText(input.note, 160), createdAt: Date.now() });
    return id;
  });
}

export function clearPayments() {
  return inLedger([db.payments], () => db.payments.clear(), true);
}
export function removePayment(id) {
  return inLedger([db.payments], () => db.payments.delete(id), true);
}
export function resetWorkspace() {
  return inLedger(allTables.slice(1), async (settings) => {
    await Promise.all(allTables.slice(1).map((table) => table.clear()));
    await db.settings.put({ ...defaults, theme: settings.theme, pin: settings.pin });
  }, true);
}

const pinPattern = /^\d{6,12}$/;
async function derivePin(pin, salt) {
  if (!crypto.subtle) throw new Error('A secure origin is required for the admin passcode.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 250_000, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(result)];
}
async function verifyPin(record, provided) {
  if (!record) return;
  if (!pinPattern.test(provided)) throw new Error('Enter the 6–12 digit admin passcode.');
  const attempt = await derivePin(provided, record.salt);
  if (attempt.reduce((diff, value, i) => diff | (value ^ record.hash[i]), 0)) throw new Error('That admin passcode is incorrect.');
}

export async function setAdminPin(input) {
  const previous = await db.settings.get(settingsId);
  adminOnly(previous);
  await verifyPin(previous.pin, input.current);
  let pin = null;
  if (!input.remove) {
    if (!pinPattern.test(input.next)) throw new Error('Use a passcode containing 6–12 digits.');
    if (input.next !== input.confirm) throw new Error('The new passcodes do not match.');
    const salt = [...crypto.getRandomValues(new Uint8Array(16))];
    pin = { salt, hash: await derivePin(input.next, salt) };
  }
  return inLedger([], (settings) => {
    if (JSON.stringify(settings.pin) !== JSON.stringify(previous.pin)) throw new Error('The passcode just changed. Try again.');
    return db.settings.update(settingsId, { pin });
  }, true);
}

export async function switchRole(role, options = {}) {
  if (!['admin', 'member'].includes(role)) throw new Error('Unknown role.');
  const previous = await db.settings.get(settingsId);
  if (!previous) throw new Error('The ledger is still starting.');
  if (role === 'admin' && previous.role !== 'admin') await verifyPin(previous.pin, options.pin);
  return inLedger([db.roommates], async (settings) => {
    if (settings.role !== previous.role || JSON.stringify(settings.pin) !== JSON.stringify(previous.pin)) throw new Error('The selected role changed in another window. Try again.');
    if (role === 'admin') return db.settings.update(settingsId, { role });
    adminOnly(settings);
    const person = await db.roommates.get(options.memberId);
    if (!person || person.archived) throw new Error('Choose an active resident profile.');
    return db.settings.update(settingsId, { role, activeMemberId: person.id });
  });
}

export const estimatorOwner = (settings) => settings.role === 'admin' ? 'head' : `resident:${settings.activeMemberId}`;
export function saveEstimator(input) {
  return inLedger([db.estimates], (settings) => {
    const owner = estimatorOwner(settings);
    if (input.owner !== owner) throw new Error('The active role changed. Try again.');
    const key = cleanText(input.key, 80, true);
    return db.estimates.put({ id: `${owner}:${key}`, owner, key, name: cleanText(input.name, 44, true), watts: decimal(input.watts, 'Power rating', { max: 20000, places: 2 }), hours: decimal(input.hours, 'Hours per day', { max: 24, places: 2 }), quantity: decimal(input.quantity, 'Quantity', { min: 1, max: 50, places: 0 }), enabled: Boolean(input.enabled), custom: Boolean(input.custom) });
  });
}
export function removeEstimator(input) {
  return inLedger([db.estimates], async (settings) => {
    const owner = estimatorOwner(settings);
    const id = `${owner}:${input.key}`;
    const entry = await db.estimates.get(id);
    if (input.owner !== owner || !entry?.custom) throw new Error('Only your own custom appliances can be removed.');
    return db.estimates.delete(id);
  });
}
export async function exportLedger() {
  const { settings, ...data } = await readWorkspace();
  adminOnly(settings);
  const { pin: _pin, activeMemberId: _member, role: _role, ...preferences } = settings;
  return { app: 'VoltFlow', schema: 1, exportedAt: new Date().toISOString(), preferences, ...data };
}
