import { useState } from 'react';
import { Archive, Calculator, Gauge, KeyRound, ShieldCheck, SlidersHorizontal, Trash2, UserRoundPlus, Wallet, Zap } from 'lucide-react';
import * as action from '../db/actions.js';
import { allocateRefill, formatDay, formatMoney, sum, toCents } from '../lib/ledger.js';
import { useWorkspace } from '../lib/workspace.js';
import { ActionForm, Avatar, Drawer, Field, SelectField } from './ui.jsx';

function TokenForm({ close, done }) {
  const { data, day } = useWorkspace();
  const active = data.roommates.filter((person) => !person.archived);
  const [ids, setIds] = useState(() => active.map((person) => person.id));
  const [mode, setMode] = useState('equal');
  const [split, setSplit] = useState(Boolean(active.length));
  const [amount, setAmount] = useState('');
  let preview = [];
  try { if (split && amount) preview = allocateRefill(toCents(amount), active.filter((person) => ids.includes(person.id)), mode); } catch { /* An incomplete input has no preview. */ }
  return <ActionForm label="Log token purchase" cancel={close} done={() => done('Token purchase added to your ledger.')} submit={(fields) => {
    if (split && !ids.length) throw new Error('Choose at least one roommate or turn off splitting.');
    return action.addToken({ ...fields, memberIds: split ? ids : [], mode });
  }}>
    <div className="form-grid">
      <Field label="Amount paid (KES)" name="amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <Field label="Units received (kWh)" name="units" inputMode="decimal" placeholder="0.0" required />
    </div>
    <Field label="Purchase date" name="date" type="date" defaultValue={day} max={day} min="2000-01-01" required />
    <Field label="Note (optional)" name="note" maxLength={160} placeholder="e.g. Monthly top-up" />
    {active.length > 0 && <div className="form-inset">
      <label className="checkbox-label"><input type="checkbox" checked={split} onChange={(event) => setSplit(event.target.checked)} /> Split this purchase with roommates</label>
      {split && <>
        <SelectField label="Split method" value={mode} onChange={(event) => setMode(event.target.value)}><option value="equal">Equal shares</option><option value="weighted">Proportional by roommate weight</option></SelectField>
        <fieldset className="checkbox-list"><legend>Include roommates</legend>{active.map((person) => <label className="checkbox-label split-option" key={person.id}>
          <input type="checkbox" checked={ids.includes(person.id)} onChange={(event) => setIds((prev) => event.target.checked ? [...prev, person.id] : prev.filter((id) => id !== person.id))} />
          <span>{person.name}</span>{preview.find((part) => part.memberId === person.id) && <small>{formatMoney(preview.find((part) => part.memberId === person.id).amountCents)}</small>}
        </label>)}</fieldset>
      </>}
    </div>}
  </ActionForm>;
}

function ReadingForm({ close, done }) {
  const { data, day } = useWorkspace();
  const [date, setDate] = useState(day);
  const existing = data.readings.find((reading) => reading.date === date);
  return <ActionForm submit={action.saveReading} done={() => done('Meter reading saved. Forecast updated.')} label="Save meter reading" cancel={close}>
    <Field label="Reading date" name="date" type="date" max={day} min="2000-01-01" required value={date} onChange={(e) => setDate(e.target.value)} />
    <div className="form-grid" key={date}>
      <Field label="Usage that day (kWh)" name="usedUnits" inputMode="decimal" defaultValue={existing?.usedUnits ?? ''} placeholder="e.g. 3.2" />
      <Field label="Meter balance (kWh)" name="balanceUnits" inputMode="decimal" defaultValue={existing?.balanceUnits ?? ''} placeholder="e.g. 24.8" />
    </div>
    <p className="field-hint">Enter one or both values. A reported balance replaces the estimate for that date.{existing && ' Saving overwrites the existing reading for this date.'}</p>
  </ActionForm>;
}

function RoommateForm({ props, close, done }) {
  const { show } = useWorkspace();
  const person = props.person;
  return <ActionForm submit={(input) => action.saveRoommate(input, person?.id)} done={() => done(person ? 'Roommate updated.' : 'Roommate added.')} label={person ? 'Save roommate' : 'Add roommate'} cancel={close}>
    <Field label="Full name" name="name" defaultValue={person?.name} maxLength={48} required placeholder="e.g. Amina Wanjiku" />
    <Field label="Profile label" name="label" defaultValue={person?.label ?? 'Resident'} maxLength={32} />
    <Field label="Share weight" name="weight" inputMode="decimal" defaultValue={person?.weight ?? 1} required hint="Used for proportional splits. Weight 2 means twice the share of weight 1." />
    {person && <button type="button" className="button button-quiet inline-action" onClick={() => show('archive', { person })}><Archive size={16} />{person.archived ? 'Restore profile' : 'Archive profile'}</button>}
  </ActionForm>;
}

function PaymentForm({ props, close, done }) {
  const { data, day, totals, isAdmin, member } = useWorkspace();
  const eligible = data.roommates.filter((person) => (isAdmin || person.id === member?.id) && (totals.members.get(person.id)?.outstanding ?? 0) > 0);
  const [memberId, setMemberId] = useState(props.memberId ?? eligible[0]?.id ?? '');
  const [date, setDate] = useState(day);
  const [tokenId, setTokenId] = useState(props.tokenId ?? '');
  const [amount, setAmount] = useState('');
  const dueTokens = data.tokens.filter((token) => token.date <= date).map((token) => ({ ...token, due: (token.shares.find((part) => part.memberId === memberId)?.amountCents ?? 0) - (totals.paidByToken.get(token.id)?.get(memberId) ?? 0) })).filter((token) => token.due > 0);
  const outstanding = tokenId ? (dueTokens.find((token) => token.id === tokenId)?.due ?? 0) : sum(dueTokens.map((token) => token.due));
  return <ActionForm submit={(fields) => action.addContribution({ ...fields, memberId, tokenId, date })} done={() => done('Contribution saved. Balance updated.')} label="Record contribution" cancel={close} disabled={!memberId || !outstanding}>
    {isAdmin ? <SelectField label="Roommate" value={memberId} onChange={(event) => { setMemberId(event.target.value); setTokenId(''); setAmount(''); }}><option value="" disabled>Choose a roommate</option>{eligible.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectField> : <div className="form-inset form-person">{member && <><Avatar person={member} />{member.name}</>}</div>}
    <Field label="Payment date" type="date" max={day} min="2000-01-01" value={date} onChange={(e) => { setDate(e.target.value); setTokenId(''); }} required />
    <SelectField label="Apply to" value={tokenId} onChange={(e) => { setTokenId(e.target.value); setAmount(''); }}><option value="">Oldest outstanding shares first</option>{dueTokens.map((token) => <option key={token.id} value={token.id}>{formatDay(token.date)} · {formatMoney(token.due)} due</option>)}</SelectField>
    <Field label="Contribution (KES)" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
    <div className="form-inline-note"><span>{formatMoney(outstanding)} available to settle</span>{outstanding > 0 && <button onClick={() => setAmount((outstanding / 100).toFixed(2))} className="text-button" type="button">Use full balance</button>}</div>
    <Field label="Note (optional)" name="note" maxLength={160} placeholder="e.g. Cash or transfer reference" />
  </ActionForm>;
}

function SharesForm({ props, close, done }) {
  const { data, totals } = useWorkspace();
  const token = data.tokens.find((row) => row.id === props.tokenId);
  const visible = data.roommates.filter((person) => !person.archived || token?.shares.some((part) => part.memberId === person.id));
  if (!token) return <p className="field-hint">This refill is no longer in the ledger.</p>;
  return <ActionForm submit={(input) => action.editRefillShares(token.id, input)} done={() => done('Refill shares updated.')} label="Save shares" cancel={close}>
    <div className="form-inline-note"><strong>Refill amount</strong><strong>{formatMoney(token.amountCents)}</strong></div>
    <p className="field-hint">Enter exact KES amounts that add up to the refill cost. All zeroes leave the refill unassigned if nothing has been paid.</p>
    {visible.map((person) => {
      const part = token.shares.find((item) => item.memberId === person.id);
      const floor = totals.paidByToken.get(token.id)?.get(person.id) ?? 0;
      return <Field key={person.id} label={`${person.name} (KES)`} name={person.id} inputMode="decimal" defaultValue={part ? (part.amountCents / 100).toFixed(2) : ''} placeholder="0.00" hint={floor > 0 ? `Already paid ${formatMoney(floor)}` : undefined} />;
    })}
  </ActionForm>;
}

function CalculateForm({ close }) {
  const { data, isAdmin, member } = useWorkspace();
  const active = data.roommates.filter((person) => !person.archived);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('equal');
  let parts = [];
  let error = '';
  if (amount) {
    try { parts = allocateRefill(toCents(amount), active, mode); }
    catch (err) { error = err.message; }
  }
  return <div className="action-form">
    <Field label="Hypothetical refill (KES)" inputMode="decimal" placeholder="e.g. 1200" value={amount} onChange={(event) => setAmount(event.target.value)} />
    <SelectField label="Split method" value={mode} onChange={(event) => setMode(event.target.value)}><option value="equal">Equal shares</option><option value="weighted">Proportional by roommate weight</option></SelectField>
    {error && <p className="field-hint text-danger" role="status">{error}</p>}
    {!active.length && <p className="field-hint">Add roommates before calculating a split.</p>}
    {parts.length > 0 && <div className="form-inset" aria-live="polite">{parts.filter((part) => isAdmin || part.memberId === member?.id).map((part) => <div className="form-inline-note" key={part.memberId}><span>{isAdmin ? active.find((p) => p.id === part.memberId)?.name : 'Your estimated share'}</span><strong>{formatMoney(part.amountCents)}</strong></div>)}</div>}
    <div className="form-actions"><button className="button button-primary" onClick={close}>Done</button></div>
  </div>;
}

function EnterMember({ close, done }) {
  const { data } = useWorkspace();
  const active = data.roommates.filter((p) => !p.archived);
  return <ActionForm submit={(fields) => action.switchRole('member', fields)} done={() => done('Switched to Resident Member.')} label="Enter member mode" cancel={close} disabled={!active.length}>
    <SelectField label="Resident profile" name="memberId" defaultValue={active.find((p) => p.id === data.settings.activeMemberId)?.id ?? active.find((p) => p.label.toLowerCase() !== 'apartment head')?.id ?? active[0]?.id} required>
      {active.length ? active.map((person) => <option key={person.id} value={person.id}>{person.name}</option>) : <option value="">No active profiles</option>}
    </SelectField>
    <p className="field-hint">{active.length ? 'Member mode shows this resident’s share and settlement history only.' : 'Add an active roommate in the Bill Splitter before entering member mode.'}</p>
  </ActionForm>;
}

function UnlockAdmin({ close, done }) {
  const { data } = useWorkspace();
  return <ActionForm submit={(fields) => action.switchRole('admin', fields)} done={() => done('Apartment Head mode is active.')} label={data.settings.pin ? 'Unlock admin mode' : 'Enter admin mode'} cancel={close}>
    {data.settings.pin ? <Field label="Admin passcode" name="pin" type="password" inputMode="numeric" autoComplete="current-password" minLength={6} maxLength={12} pattern="[0-9]{6,12}" required /> : <p className="field-hint">No local passcode has been set. You can set one in Settings to protect this switch.</p>}
  </ActionForm>;
}

function PinForm({ props, close, done }) {
  const { data } = useWorkspace();
  const remove = props.remove;
  return <ActionForm submit={(fields) => action.setAdminPin({ ...fields, remove })} done={() => done(remove ? 'Admin passcode removed.' : 'Admin passcode saved.')} label={remove ? 'Remove passcode' : 'Save passcode'} cancel={close} variant={remove ? 'danger' : 'primary'}>
    {data.settings.pin && <Field label="Current passcode" name="current" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6,12}" maxLength={12} required />}
    {!remove && <>
      <Field label="New passcode" name="next" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,12}" maxLength={12} hint="Use 6–12 digits. Save it somewhere safe; there is no account recovery." required />
      <Field label="Confirm new passcode" name="confirm" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,12}" maxLength={12} required />
    </>}
  </ActionForm>;
}

function ApplianceForm({ props, close, done }) {
  const appliance = props.appliance;
  const { data } = useWorkspace();
  const owner = action.estimatorOwner(data.settings);
  return <ActionForm submit={(fields) => action.saveEstimator({ ...fields, owner, key: appliance?.key ?? crypto.randomUUID(), enabled: appliance?.enabled ?? true, custom: appliance?.custom ?? true })} done={() => done(appliance ? 'Appliance updated.' : 'Custom appliance added.')} cancel={close} label={appliance ? 'Save appliance' : 'Add appliance'}>
    <Field label="Appliance name" name="name" defaultValue={appliance?.name} maxLength={44} required placeholder="e.g. Water heater" />
    <div className="form-grid">
      <Field label="Power rating (W)" name="watts" inputMode="decimal" defaultValue={appliance?.watts ?? '100'} required />
      <Field label="Hours per day" name="hours" inputMode="decimal" defaultValue={appliance?.hours ?? '1'} required />
    </div>
    <Field label="Quantity" name="quantity" inputMode="numeric" defaultValue={appliance?.quantity ?? '1'} required />
  </ActionForm>;
}

export default function LedgerDialogs({ modal, close, done }) {
  const { data } = useWorkspace();
  const props = modal.props ?? {};
  const definitions = {
    token: ['Log token purchase', 'Add a refill to your electricity ledger.', Zap, TokenForm],
    reading: ['Log meter reading', 'Improve the balance estimate with a reading from your meter.', Gauge, ReadingForm],
    roommate: [props.person ? 'Edit roommate' : 'Add a roommate', 'Set a profile and share weight for household refills.', UserRoundPlus, RoommateForm],
    payment: ['Record contribution', 'Log a payment you received or made outside VoltFlow.', Wallet, PaymentForm],
    shares: ['Edit refill shares', 'Adjust how this specific refill is divided.', SlidersHorizontal, SharesForm],
    calculate: ['Calculate a share', 'Preview a split without adding a refill to the ledger.', Calculator, CalculateForm],
    member: ['Switch to Resident Member', 'Choose which roommate this device is acting as.', UserRoundPlus, EnterMember],
    admin: ['Switch to Apartment Head', 'Unlock household management and backups.', ShieldCheck, UnlockAdmin],
    pin: [props.remove ? 'Remove admin passcode' : 'Admin passcode', 'Protect the switch from Member to Apartment Head on this device.', KeyRound, PinForm],
    appliance: [props.appliance ? 'Edit appliance' : 'Add custom appliance', 'Use the rated watts and your typical run time.', SlidersHorizontal, ApplianceForm],
  };
  const confirmations = {
    archive: [props.person?.archived ? 'Restore roommate?' : 'Archive roommate?', props.person?.archived ? 'This roommate can be included in new refills again.' : 'Existing shares and payments stay in your ledger. This roommate won’t be included in new splits.', Archive, () => action.setRoommateArchived(props.person.id, !props.person.archived), props.person?.archived ? 'Restore' : 'Archive', props.person?.archived ? 'Roommate restored.' : 'Roommate archived.'],
    paymentDelete: ['Delete this contribution?', 'The amount will be returned to the outstanding share. This cannot be undone.', Trash2, () => action.removePayment(props.id), 'Delete contribution', 'Contribution removed.'],
    clearPayments: ['Clear all contributions?', 'This permanently deletes every settlement record. Refill shares will be marked as unpaid.', Trash2, action.clearPayments, 'Clear all contributions', 'Contribution history cleared.'],
    reset: [data.settings.sample ? 'Start with a fresh ledger?' : 'Clear this device’s ledger?', 'This deletes all tokens, meter readings, roommates, contributions, and appliance estimates. Export the ledger first if you need a copy. The theme and admin passcode are kept.', Trash2, action.resetWorkspace, 'Clear ledger', 'You’re ready to start a new ledger.'],
    applianceDelete: ['Remove custom appliance?', 'It will no longer count toward your energy estimate.', Trash2, () => action.removeEstimator({ owner: action.estimatorOwner(data.settings), key: props.key }), 'Remove appliance', 'Custom appliance removed.'],
  };
  if (definitions[modal.type]) {
    const [title, description, icon, Content] = definitions[modal.type];
    return <Drawer title={title} description={description} icon={icon} onClose={close}><Content props={props} close={close} done={done} /></Drawer>;
  }
  if (confirmations[modal.type]) {
    const [title, description, icon, submit, label, message] = confirmations[modal.type];
    return <Drawer title={title} description={description} icon={icon} onClose={close}><ActionForm submit={submit} done={() => done(message)} label={label} variant={label === 'Restore' ? 'primary' : 'danger'} cancel={close} /></Drawer>;
  }
  return null;
}
