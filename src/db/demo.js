import { allocateRefill, localDay, offsetDay } from '../lib/ledger.js';
import { defaults } from './schema.js';

export function demoWorkspace(today = localDay()) {
  const now = Date.now();
  const roommates = [
    { id: 'amina', name: 'Amina Wanjiku', label: 'Apartment head', color: 'mint', weight: 1 },
    { id: 'brian', name: 'Brian Otieno', label: 'Resident', color: 'violet', weight: 1 },
    { id: 'chloe', name: 'Chloe Mwangi', label: 'Resident', color: 'amber', weight: 1 },
  ].map((row, i) => ({ ...row, archived: false, createdAt: now + i }));
  const tokens = [
    { id: 'demo-1', offset: -8, units: 40, amountCents: 120000, note: 'Shared apartment refill' },
    { id: 'demo-2', offset: -16, units: 22.4, amountCents: 70000, note: 'Mid-month top-up' },
    { id: 'demo-3', offset: -24, units: 17.6, amountCents: 55000, note: 'Electricity top-up' },
    { id: 'demo-4', offset: -32, units: 33.2, amountCents: 100000, note: 'Shared apartment refill' },
  ].map(({ offset, ...row }) => ({ ...row, date: offsetDay(today, offset), createdAt: now + offset, shares: allocateRefill(row.amountCents, roommates), splitMode: 'equal', recordedBy: 'Amina Wanjiku' }));
  const previous = [2.87, 3.73, 2.56, 3.31, 2.41, 4.02, 3.59, 2.27, 3.62, 4.31, 3.52, 2.9, 3.77, 4.1, 2.66, 3.52, 3.01, 2.26, 3.47, 4.32, 3.92, 3.04, 2.69];
  const readings = [...previous, 2.15, 2.95, 2.5, 3.85, 3.17, 4.25, 3.53].map((usedUnits, i) => ({
    date: offsetDay(today, i - 29), usedUnits, balanceUnits: i === 29 ? 24.8 : null, balanceAt: i === 29 ? now : null, createdAt: now + i - 29,
  }));
  const makePayment = (token, memberId, amountCents, index) => ({ id: `${token.id}-${memberId}`, memberId, amountCents, applications: [{ tokenId: token.id, amountCents }], date: offsetDay(token.date, index + 1), createdAt: now + index, note: 'Demo contribution' });
  const payments = [makePayment(tokens[0], 'amina', 40000, 0), makePayment(tokens[0], 'chloe', 15000, 1), ...tokens.slice(1).flatMap((token) => token.shares.map((part, i) => makePayment(token, part.memberId, part.amountCents, i)))];
  return { settings: { ...defaults, activeMemberId: 'brian', sample: true }, roommates, tokens, readings, payments };
}
