const DAY = 86_400_000;
const money = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const units = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const localDay = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;
export const daysBetween = (a, b) => dayNumber(b) - dayNumber(a);
export function offsetDay(date, days) {
  return new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);
}
export function formatDay(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
export const formatMoney = (cents) => `KES ${money.format(cents / 100)}`;
export const formatUnits = (value) => units.format(Math.max(0, value));
export const formatKilowattHours = (value) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 3 }).format(Math.max(0, value));
export const byNewest = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
export const sum = (values) => values.reduce((acc, value) => acc + value, 0);

export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(dayNumber(value)) || offsetDay(value, 0) !== value || value < '2000-01-01' || value > localDay()) {
    throw new Error('Enter a valid date from 2000 through today.');
  }
  return value;
}

export function decimal(value, label, { min = 0, max = 100_000, places = 2 } = {}) {
  const text = String(value ?? '').trim();
  const pattern = places === 0 ? /^\d+$/ : new RegExp(`^(?:\\d+(?:\\.\\d{0,${places}})?|\\.\\d{1,${places}})$`);
  const number = Number(text);
  if (!pattern.test(text) || !Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}, with up to ${places} decimal places.`);
  }
  return number;
}
export const toCents = (value, label = 'Amount', min = 0.01) => Math.round(decimal(value, label, { min, max: 10_000_000 }) * 100);
export function cleanText(value, max, required = false) {
  const text = String(value ?? '').trim();
  if (text.length > max || (required && !text)) throw new Error(`Enter ${required ? '1 to' : 'up to'} ${max} characters.`);
  return text;
}

export function allocateRefill(total, members, mode = 'equal') {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('A refill must have a valid amount.');
  if (mode !== 'equal' && mode !== 'weighted') throw new Error('Choose an equal or weighted split.');
  if (!members.length) return [];
  const weights = members.map((member) => mode === 'weighted' ? Math.round(member.weight * 100) : 1);
  if (weights.some((weight) => !Number.isSafeInteger(weight) || weight <= 0)) throw new Error('Each roommate must have a positive share weight.');
  const divisor = sum(weights);
  const split = members.map((member, index) => ({ memberId: member.id, amountCents: Math.floor(total * weights[index] / divisor), fraction: (total * weights[index]) % divisor }));
  const pennies = total - sum(split.map((part) => part.amountCents));
  const priority = [...split].sort((a, b) => b.fraction - a.fraction || a.memberId.localeCompare(b.memberId));
  for (let i = 0; i < pennies; i++) priority[i].amountCents++;
  return split.map(({ memberId, amountCents }) => ({ memberId, amountCents }));
}

export function ledgerTotals(tokens, payments) {
  const paidByToken = new Map();
  const members = new Map();
  const forMember = (memberId) => {
    if (!members.has(memberId)) members.set(memberId, { due: 0, paid: 0, outstanding: 0 });
    return members.get(memberId);
  };
  for (const token of tokens) for (const part of token.shares) forMember(part.memberId).due += part.amountCents;
  for (const payment of payments) {
    forMember(payment.memberId).paid += payment.amountCents;
    for (const part of payment.applications) {
      if (!paidByToken.has(part.tokenId)) paidByToken.set(part.tokenId, new Map());
      const split = paidByToken.get(part.tokenId);
      split.set(payment.memberId, (split.get(payment.memberId) ?? 0) + part.amountCents);
    }
  }
  for (const member of members.values()) member.outstanding = Math.max(0, member.due - member.paid);
  const totals = [...members.values()];
  return { members, paidByToken, assigned: sum(totals.map((m) => m.due)), collected: sum(totals.map((m) => m.paid)), outstanding: sum(totals.map((m) => m.outstanding)) };
}

export function applyContribution(tokens, payments, memberId, amountCents, tokenId) {
  const { paidByToken } = ledgerTotals(tokens, payments);
  const unpaid = tokens.filter((token) => !tokenId || token.id === tokenId).sort((a, b) => byNewest(b, a)).map((token) => ({
    tokenId: token.id,
    amountCents: (token.shares.find((part) => part.memberId === memberId)?.amountCents ?? 0) - (paidByToken.get(token.id)?.get(memberId) ?? 0),
  })).filter((part) => part.amountCents > 0);
  const outstanding = sum(unpaid.map((part) => part.amountCents));
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Enter a positive contribution.');
  if (amountCents > outstanding) throw new Error(outstanding ? `The outstanding balance is ${formatMoney(outstanding)}.` : 'There is no outstanding share for this selection.');
  let remaining = amountCents;
  return unpaid.flatMap((part) => {
    const applied = Math.min(part.amountCents, remaining);
    remaining -= applied;
    return applied ? [{ tokenId: part.tokenId, amountCents: applied }] : [];
  });
}

export function usageSeries(readings, days, today = localDay()) {
  const byDate = new Map(readings.map((reading) => [reading.date, reading.usedUnits]));
  return Array.from({ length: days }, (_, i) => {
    const date = offsetDay(today, i - days + 1);
    return { date, value: byDate.get(date) ?? null };
  });
}

export function forecast(tokens, readings, settings, today = localDay()) {
  const recent = usageSeries(readings, 7, today).filter((point) => point.value !== null);
  const daily = recent.length ? sum(recent.map((point) => point.value)) / recent.length : settings.manualDaily;
  const eligibleTokens = tokens.filter((token) => token.date <= today).sort(byNewest);
  const eligibleReadings = readings.filter((reading) => reading.date <= today).sort(byNewest);
  const anchor = eligibleReadings.find((reading) => reading.balanceUnits != null);
  const openingDay = anchor?.date ?? eligibleTokens.at(-1)?.date;
  if (!openingDay) return { hasBalance: false, low: false, balance: 0, daily, days: null, percent: 0, recentCount: recent.length };
  const byDay = new Map();
  const eventFor = (date) => {
    if (!byDay.has(date)) byDay.set(date, { added: 0, used: null });
    return byDay.get(date);
  };
  for (const token of eligibleTokens) {
    if (!anchor || token.date > anchor.date || (token.date === anchor.date && token.createdAt > (anchor.balanceAt ?? anchor.createdAt))) eventFor(token.date).added += token.units;
  }
  for (const reading of eligibleReadings) {
    if (reading.usedUnits != null && (anchor ? reading.date > openingDay : reading.date >= openingDay)) eventFor(reading.date).used = reading.usedUnits;
  }
  let balance = anchor?.balanceUnits ?? 0;
  let target = Math.max(balance, eligibleTokens[0]?.units ?? 0);
  let cursor = anchor ? offsetDay(openingDay, 1) : openingDay;
  for (const [date, event] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    balance = Math.max(0, balance - Math.max(0, daysBetween(cursor, date)) * daily);
    if (event.added > 0) { balance += event.added; target = balance; }
    if (date >= cursor) {
      balance = Math.max(0, balance - (event.used ?? (date < today ? daily : 0)));
      cursor = offsetDay(date, 1);
    }
  }
  balance = Math.max(0, balance - Math.max(0, daysBetween(cursor, today)) * daily);
  const days = daily > 0 ? balance / daily : null;
  return {
    hasBalance: true, balance, daily, days, recentCount: recent.length, anchor,
    low: balance < 0.005 || balance <= settings.lowThreshold + 1e-8 || (days != null && days <= 2),
    percent: target ? Math.min(100, Math.round(balance / target * 100)) : 0,
  };
}

export function estimateAppliance({ watts, hours, quantity, enabled }) {
  return enabled ? watts * hours * quantity / 1000 : 0;
}

export const initials = (name) => name.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase();
