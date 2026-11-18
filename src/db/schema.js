import Dexie from 'dexie';

export const db = new Dexie('voltflow-ledger');
db.version(1).stores({
  settings: 'id',
  tokens: 'id, date',
  roommates: 'id, createdAt',
  readings: 'date',
  payments: 'id, date, memberId',
  estimates: 'id, owner',
});

export const settingsId = 'household';
export const themeIds = ['electric', 'solar', 'matrix'];
export const colors = ['mint', 'violet', 'amber', 'sky', 'rose'];
export const defaults = {
  id: settingsId, name: 'The Apartment', role: 'admin', activeMemberId: null, theme: 'electric',
  rateCents: 3000, manualDaily: 3.2, lowThreshold: 8, pin: null, sample: false,
};
