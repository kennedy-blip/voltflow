import { KeyRound, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useWorkspace } from '../lib/workspace.js';
import { IconBox, PanelHeading } from './ui.jsx';

const choices = [
  { id: 'admin', name: 'Apartment Head', description: 'Manage refills, rates, shares, and exports.', icon: ShieldCheck },
  { id: 'member', name: 'Resident Member', description: 'View your share and log your payments.', icon: UserRound },
];
export default function RoleSwitcher() {
  const { data, member, isAdmin, show } = useWorkspace();
  const hasPin = Boolean(data.settings.pin);
  return <section className="glass-panel settings-panel" id="access">
    <PanelHeading icon={ShieldCheck} title="Access & role" description={isAdmin ? 'Choose how this device accesses the ledger.' : `Viewing as ${member?.name ?? 'a resident'}.`} />
    <div className="role-options" aria-label="Device role">{choices.map(({ id, name, description, icon }) => {
      const selected = data.settings.role === id;
      return <button type="button" key={id} className="option-card" aria-pressed={selected} onClick={() => { if (!selected) show(id); }}>
        <IconBox icon={icon} /><span><strong>{name}</strong><small>{description}</small></span><span className="option-radio" aria-hidden="true" />
      </button>;
    })}</div>
    <div className="settings-inline"><LockKeyhole size={17} /><p>{hasPin ? 'A passcode is required to return to Admin mode.' : 'This device has no admin passcode.'}</p>{isAdmin && <button className="text-button" onClick={() => show('pin')}><KeyRound size={14} />{hasPin ? 'Change passcode' : 'Set passcode'}</button>}</div>
    {isAdmin && hasPin && <button className="text-button muted-link" onClick={() => show('pin', { remove: true })}>Remove passcode</button>}
  </section>;
}
