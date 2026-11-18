import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BatteryCharging, CalendarClock, Flame, Gauge, History, Plus, UsersRound, Zap } from 'lucide-react';
import heroImage from '../assets/energy-field.webp';
import { formatDay, formatMoney, formatUnits } from '../lib/ledger.js';
import { useWorkspace } from '../lib/workspace.js';
import { Avatar, EmptyState, IconBox, PageHeading, PanelHeading, spring } from './ui.jsx';
import UsageChart from './UsageChart.jsx';

function TokenBalance() {
  const { model } = useWorkspace();
  return <section className="glass-panel token-balance" aria-label="Token balance" style={{ '--energy-field': `url(${heroImage})` }}>
    <div className="energy-field" aria-hidden="true" />
    <div className="metric-head"><div><IconBox icon={BatteryCharging} size={21} /><h2 className="metric-label">Token balance</h2></div><span className={`pill ${model.low ? 'pill-amber' : 'pill-green'}`}><i />{model.hasBalance ? (model.low ? 'Low balance' : 'Healthy balance') : 'No reading'}</span></div>
    <div className="balance-reading"><strong>{model.hasBalance ? formatUnits(model.balance) : '—'}</strong><span>kWh</span></div>
    <p className="balance-caption">Estimated units available</p>
    <div className="balance-progress">
      <div className="progress-track" role="progressbar" aria-label="Remaining energy relative to the refill baseline" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.percent}>
        <motion.span initial={false} animate={{ width: `${model.percent}%` }} transition={spring} className={model.low ? 'progress-low' : ''} />
      </div>
      <div><span>0 kWh</span><span>{model.hasBalance ? `${model.percent}% of refill baseline` : 'Add a reading to start'}</span></div>
    </div>
  </section>;
}

function ForecastCards() {
  const { model } = useWorkspace();
  return <div className="forecast-stack">
    <section className="glass-panel mini-metric">
      <div className="metric-head"><div><IconBox icon={CalendarClock} /><h2 className="metric-label">Days remaining</h2></div><span className="metric-tag"><i /> Forecast</span></div>
      <div className="mini-reading"><strong>{model.days == null ? '—' : formatUnits(model.days)}</strong>{model.days != null && <span>days</span>}</div>
      <p>{model.daily > 0 ? 'At your current usage rate' : 'No daily usage to project yet'}</p>
    </section>
    <section className="glass-panel mini-metric burn-card">
      <div className="metric-head"><div><IconBox icon={Flame} tone="amber" /><h2 className="metric-label">Daily burn rate</h2></div><span className="metric-tag burn-tag">{model.recentCount ? '7-day avg' : 'Manual'}</span></div>
      <div className="mini-reading"><strong>{formatUnits(model.daily)}</strong><span>kWh / day</span></div>
      <p>{model.recentCount ? 'From logged meter usage' : 'From your forecast settings'}</p>
    </section>
  </div>;
}

function RoommateSnapshot() {
  const { data, isAdmin, totals, member } = useWorkspace();
  const visible = isAdmin ? data.roommates.filter((person) => !person.archived || totals.members.get(person.id)?.outstanding).slice(0, 3) : member ? [member] : [];
  return <section className="glass-panel roommate-card">
    <PanelHeading icon={UsersRound} title={isAdmin ? 'Roommate balances' : 'My electricity share'} description={isAdmin ? 'Split status at a glance' : 'Your personal settlement status'} />
    {visible.length ? <ul className="snapshot-list">{visible.map((person) => {
      const owing = totals.members.get(person.id)?.outstanding ?? 0;
      return <li key={person.id} className="snapshot-row"><Avatar person={person} /><div className="snapshot-name"><strong>{person.name}</strong><span>{person.archived ? 'Archived profile' : person.label}</span></div><span className={`pill ${owing ? 'pill-amber' : 'pill-green'}`}>{owing ? `${formatMoney(owing)} due` : 'Settled'}</span></li>;
    })}</ul> : <EmptyState icon={UsersRound} title="No roommates yet" description="Set up profiles in the bill splitter." />}
    <Link to="/splitter" className="snapshot-footer">{isAdmin ? 'Open bill splitter' : 'View my contributions'} <ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}

function TokenActivity() {
  const { data, isAdmin, show } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? data.tokens : data.tokens.slice(0, 3);
  return <section className="glass-panel activity-card">
    <PanelHeading icon={History} tone="sky" title="Recent token activity" description="Your electricity top-up history" actions={data.tokens.length > 3 && <button aria-expanded={expanded} type="button" className="button button-quiet activity-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'View all'} <ArrowUpRight size={15} aria-hidden="true" /></button>} />
    {rows.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th scope="col">Activity</th><th scope="col">Date</th><th scope="col">Units</th>{isAdmin && <th scope="col" className="numeric">Amount paid</th>}</tr></thead>
      <tbody>{rows.map((token) => <tr key={token.id}><td><div className="table-activity"><IconBox icon={ArrowDownRight} size={16} /><div><strong>Token purchase</strong>{isAdmin && token.note && <small>{token.note}</small>}</div></div></td><td>{formatDay(token.date)}</td><td><span className="units-tag">+{formatUnits(token.units)} kWh</span></td>{isAdmin && <td className="numeric table-money">{formatMoney(token.amountCents)}</td>}</tr>)}</tbody>
    </table></div> : <EmptyState icon={Zap} title="No token purchases yet" description="Your top-ups will appear here as soon as they’re logged.">{isAdmin && <button className="button button-secondary" onClick={() => show('token')}><Plus size={17} /> Add a token</button>}</EmptyState>}
  </section>;
}

export default function TokenTracker() {
  const { data, day, model, isAdmin, show } = useWorkspace();
  return <div className="page-flow">
    <PageHeading eyebrow="ENERGY WORKSPACE" title="Power overview" description="Track your tokens, monitor usage, and stay ahead of your next refill." actions={isAdmin && <>
      <button type="button" className="button button-secondary" onClick={() => show('reading')}><Gauge size={17} /> Meter reading</button>
      <button type="button" className="button button-primary" onClick={() => show('token')}><Plus size={19} strokeWidth={2.2} /> Log token</button>
    </>} />
    {model.low && <div className="low-banner" role="alert"><IconBox icon={AlertTriangle} tone="amber" /><div><strong>Low token balance</strong><p>About {formatUnits(model.balance)} kWh remain. Plan a refill to avoid running out.</p></div>{isAdmin && <button type="button" className="button button-secondary" onClick={() => show('token')}>Log a refill <ArrowRight size={16} /></button>}</div>}
    <div className="overview-grid overview-top"><TokenBalance /><ForecastCards /></div>
    <div className="overview-grid overview-middle"><UsageChart readings={data.readings} day={day} /><RoommateSnapshot /></div>
    {isAdmin && <TokenActivity />}
    <footer className="page-foot"><span><Zap size={13} /> VoltFlow · Energy, accounted for.</span><span>LOCAL-FIRST UTILITY LEDGER</span></footer>
  </div>;
}
