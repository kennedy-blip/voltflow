import { useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Calculator, CircleHelp, CookingPot, Flame, Laptop, Pencil, Plug, Plus, Refrigerator, Trash2, Wifi, Zap } from 'lucide-react';
import { estimatorOwner, saveEstimator } from '../db/actions.js';
import { estimateAppliance, formatKilowattHours, formatMoney, sum } from '../lib/ledger.js';
import { useWorkspace } from '../lib/workspace.js';
import { IconBox, PageHeading, PanelHeading, spring } from './ui.jsx';

const presets = [
  { key: 'fridge', name: 'Refrigerator', watts: 120, hours: 8, icon: Refrigerator, tone: 'sky' },
  { key: 'plate', name: 'Electric hot plate', watts: 1500, hours: 1, icon: CookingPot, tone: 'amber' },
  { key: 'induction', name: 'Induction cooker', watts: 1800, hours: 0.5, icon: Flame, tone: 'rose' },
  { key: 'laptop', name: 'Laptop', watts: 65, hours: 5, icon: Laptop, tone: 'violet' },
  { key: 'wifi', name: 'Wi-Fi router', watts: 12, hours: 24, icon: Wifi, tone: 'mint' },
].map((item) => ({ ...item, quantity: 1, enabled: true, custom: false }));

function ApplianceRow({ item, onChange }) {
  const id = useId();
  const { show } = useWorkspace();
  return <article className={`appliance-row${item.enabled ? '' : ' appliance-disabled'}`}>
    <header><IconBox icon={item.icon} tone={item.tone} size={19} /><div><h3>{item.name}</h3><p>{item.watts} W per device · {item.quantity} {item.quantity === 1 ? 'device' : 'devices'}</p></div>
      <span className="units-tag appliance-kwh">{formatKilowattHours(estimateAppliance(item))} kWh</span>
      <label className="switch-control"><input type="checkbox" role="switch" aria-label={`Include ${item.name}`} checked={item.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span aria-hidden="true" /></label>
    </header>
    <div className="appliance-controls"><label htmlFor={id}>Hours / day <strong>{item.hours} h</strong></label><input id={id} type="range" min="0" max="24" step="0.25" value={item.hours} style={{ '--range': `${item.hours / 24 * 100}%` }} onChange={(event) => onChange({ hours: Number(event.target.value) })} />
      <button type="button" className="icon-button bordered" aria-label={`Edit ${item.name}`} title="Edit appliance" onClick={() => show('appliance', { appliance: item })}><Pencil size={15} /></button>
      {item.custom && <button type="button" className="icon-button bordered" aria-label={`Remove ${item.name}`} title="Remove appliance" onClick={() => show('applianceDelete', { key: item.key })}><Trash2 size={15} /></button>}
    </div>
  </article>;
}

function EstimateSummary({ items, rate }) {
  const active = items.filter((item) => estimateAppliance(item) > 0);
  const total = sum(active.map(estimateAppliance));
  const biggest = [...active].sort((a, b) => estimateAppliance(b) - estimateAppliance(a)).slice(0, 5);
  return <div className="estimator-summary">
    <section className="glass-panel estimate-totals"><PanelHeading icon={Zap} title="Daily energy estimate" description="Based on selected appliances" />
      <div className="estimate-reading"><strong>{formatKilowattHours(total)}</strong><span>kWh / day</span></div>
      <dl><div><dt>Daily cost</dt><dd>{formatMoney(Math.round(total * rate))}</dd></div><div><dt>30-day cost</dt><dd>{formatMoney(Math.round(total * rate * 30))}</dd></div><div><dt>Utility rate</dt><dd>{formatMoney(rate)} / kWh</dd></div></dl>
    </section>
    <section className="glass-panel breakdown"><PanelHeading icon={Activity} tone="sky" title="Largest loads" description="Share of daily energy" />
      {biggest.length ? <ul>{biggest.map((item) => {
        const percentage = Math.round(estimateAppliance(item) / total * 100);
        return <li className={`tone-${item.tone}`} key={item.key}><div><span>{item.name}</span><strong>{percentage}%</strong></div><div className="progress-track"><motion.span initial={false} animate={{ width: `${percentage}%` }} transition={spring} /></div></li>;
      })}</ul> : <p className="field-hint">Turn on an appliance and set its run time to see the breakdown.</p>}
    </section>
    <div className="info-note"><CircleHelp size={18} /><p>These are estimates. For cycling appliances, use the total time the motor or heating element runs, not the time it’s plugged in.</p></div>
  </div>;
}

function EstimatorBody({ owner }) {
  const { data, show, notice } = useWorkspace();
  const persisted = data.estimates.filter((entry) => entry.owner === owner);
  const [drafts, setDrafts] = useState({});
  const edits = useRef(new Map());
  const items = [
    ...presets.map((item) => ({ ...item, ...persisted.find((entry) => entry.key === item.key) })),
    ...persisted.filter((entry) => entry.custom).map((entry) => ({ ...entry, icon: Plug, tone: 'sky' })),
  ].map((item) => ({ ...item, ...(drafts[item.key]?.fields ?? {}) }));

  async function update(item, fields) {
    const previous = edits.current.get(item.key);
    const entry = { fields: { ...previous?.fields, ...fields }, id: Symbol() };
    edits.current.set(item.key, entry);
    setDrafts((current) => ({ ...current, [item.key]: entry }));
    try { await saveEstimator({ ...item, ...entry.fields, owner }); }
    catch (error) { if (edits.current.get(item.key) === entry) notice(error.message, 'error'); }
    finally {
      setTimeout(() => {
        if (edits.current.get(item.key) === entry) {
          edits.current.delete(item.key);
          setDrafts((current) => {
            const next = { ...current }; delete next[item.key]; return next;
          });
        }
      }, 140);
    }
  }
  return <div className="page-flow">
    <PageHeading eyebrow="USAGE CALCULATOR" title="Appliance estimator" description="See how the things you use every day add up on your power bill." actions={<button className="button button-primary" onClick={() => show('appliance')}><Plus size={18} /> Add appliance</button>} />
    <div className="estimator-grid">
      <section className="glass-panel appliance-panel"><PanelHeading icon={Calculator} title="Your appliances" description="Adjust run times and turn appliances on or off to compare." /><div className="appliance-list">{items.map((item) => <ApplianceRow item={item} key={item.key} onChange={(fields) => update(item, fields)} />)}</div></section>
      <EstimateSummary items={items} rate={data.settings.rateCents} />
    </div>
  </div>;
}

export default function ApplianceEstimator() {
  const { data } = useWorkspace();
  const owner = estimatorOwner(data.settings);
  return <EstimatorBody key={owner} owner={owner} />;
}
