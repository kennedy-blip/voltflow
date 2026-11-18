import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, Calculator, ChevronDown, ClipboardList, Coins, History, Pencil, Plus, ReceiptText, Trash2, UserRoundPlus, UsersRound, Wallet } from 'lucide-react';
import { formatDay, formatMoney, formatUnits, sum } from '../lib/ledger.js';
import { useWorkspace } from '../lib/workspace.js';
import { Avatar, EmptyState, IconBox, PageHeading, PanelHeading, spring } from './ui.jsx';

const splitLabels = { none: 'Not assigned', equal: 'Equal split', weighted: 'Weighted split', custom: 'Custom split' };
const zero = { due: 0, paid: 0, outstanding: 0 };

function SplitMetrics() {
  const { isAdmin, totals, member } = useWorkspace();
  const own = totals.members.get(member?.id) ?? zero;
  const metrics = [
    { title: isAdmin ? 'Total assigned' : 'My assigned share', amount: isAdmin ? totals.assigned : own.due, icon: ReceiptText, tone: 'sky', detail: 'From shared token refills' },
    { title: isAdmin ? 'Collected' : 'My contributions', amount: isAdmin ? totals.collected : own.paid, icon: Coins, tone: 'mint', detail: 'Payments recorded in the ledger' },
    { title: isAdmin ? 'Outstanding' : 'I still owe', amount: isAdmin ? totals.outstanding : own.outstanding, icon: Wallet, tone: 'amber', detail: 'Remaining amount to settle' },
  ];
  return <div className="split-metrics">{metrics.map(({ title, amount, icon, tone, detail }) => <section className="glass-panel split-metric" key={title}>
    <div><IconBox icon={icon} tone={tone} /><h2 className="metric-label">{title}</h2></div><strong>{formatMoney(amount)}</strong><p>{detail}</p>
  </section>)}</div>;
}

function Roommates() {
  const { data, totals, show, isAdmin, member } = useWorkspace();
  const visible = isAdmin ? data.roommates : member ? [member] : [];
  if (!visible.length) return <EmptyState icon={UsersRound} title="No roommates yet" description="Add your co-tenants to start sharing the cost of refills.">{isAdmin && <button className="button button-secondary" onClick={() => show('roommate')}><UserRoundPlus size={16} /> Add roommate</button>}</EmptyState>;
  return <div className="roommate-list">{visible.map((person) => {
    const amounts = totals.members.get(person.id) ?? zero;
    const percent = amounts.due ? Math.round(amounts.paid / amounts.due * 100) : 0;
    return <article className="roommate-line" key={person.id}>
      <div className="roommate-identity"><Avatar person={person} /><div><h3>{person.name}</h3><p>{person.archived ? 'Archived' : person.label}{isAdmin && ` · Weight ${person.weight}`}</p></div></div>
      <div className="roommate-paid"><div><span>Paid {formatMoney(amounts.paid)}</span><strong>{formatMoney(amounts.due)}</strong></div><div className="progress-track" role="progressbar" aria-label={`${person.name} paid share`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div></div>
      <div className="roommate-actions">
        <span className={`pill ${amounts.outstanding ? 'pill-amber' : 'pill-green'}`}>{amounts.outstanding ? `${formatMoney(amounts.outstanding)} due` : 'Settled'}</span>
        {amounts.outstanding > 0 && <button type="button" className="icon-button bordered" aria-label={`Record ${person.name}’s contribution`} title="Record contribution" onClick={() => show('payment', { memberId: person.id })}><Plus size={17} /></button>}
        {isAdmin && <button type="button" className="icon-button bordered" aria-label={`Edit ${person.name}`} title="Edit roommate" onClick={() => show('roommate', { person })}><Pencil size={16} /></button>}
      </div>
    </article>;
  })}</div>;
}

function Refills() {
  const { data, isAdmin, show, member, totals } = useWorkspace();
  const [open, setOpen] = useState(null);
  const tokens = isAdmin ? data.tokens : data.tokens.filter((token) => token.shares.some((part) => part.memberId === member?.id));
  if (!tokens.length) return <EmptyState icon={ReceiptText} title="No refill splits yet" description={isAdmin ? 'Log a top-up and choose the roommates who will share it.' : 'Shared refills assigned to you will appear here.'}>{isAdmin && <button className="button button-secondary" onClick={() => show('token')}><Plus size={17} /> Log token</button>}</EmptyState>;
  return <div className="refill-list">{tokens.map((token) => {
    const expanded = open === token.id;
    const parts = token.shares.filter((share) => isAdmin || share.memberId === member?.id);
    const applied = totals.paidByToken.get(token.id);
    const outstanding = sum(parts.map((part) => part.amountCents - (applied?.get(part.memberId) ?? 0)));
    return <article className={`refill-card${expanded ? ' refill-open' : ''}`} key={token.id}>
      <button className="refill-control" type="button" aria-expanded={expanded} aria-controls={`refill-${token.id}`} onClick={() => setOpen(expanded ? null : token.id)}>
        <IconBox icon={ReceiptText} /><span className="refill-name"><strong>{formatDay(token.date)} refill</strong><small>{formatUnits(token.units)} kWh · {splitLabels[token.splitMode]}</small></span>
        <span className={`pill ${outstanding ? 'pill-amber' : 'pill-green'}`}>{!parts.length ? 'Unassigned' : outstanding ? `${formatMoney(outstanding)} due` : 'Settled'}</span>
        <ChevronDown className="refill-chevron" size={19} />
      </button>
      <AnimatePresence initial={false}>{expanded && <motion.div id={`refill-${token.id}`} className="refill-content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
        <div className="refill-inner">
          {!parts.length && <p className="field-hint">{data.roommates.some((person) => !person.archived) ? 'Use Edit shares to assign this refill.' : 'Add a roommate before assigning this refill.'}</p>}
          {parts.map((part) => {
            const person = data.roommates.find((row) => row.id === part.memberId);
            const paid = applied?.get(part.memberId) ?? 0;
            return <div className="refill-person" key={part.memberId}>{person && <Avatar person={person} />}<div><strong>{person?.name ?? 'Roommate'}</strong><small>{formatMoney(paid)} of {formatMoney(part.amountCents)} paid</small></div>
              {part.amountCents > paid && <button className="button button-quiet" onClick={() => show('payment', { memberId: part.memberId, tokenId: token.id })}>Record payment <Plus size={15} /></button>}
            </div>;
          })}
          {isAdmin && <button className="button button-secondary" onClick={() => show('shares', { tokenId: token.id })}><Pencil size={15} /> Edit shares</button>}
        </div>
      </motion.div>}</AnimatePresence>
    </article>;
  })}</div>;
}

function Settlements() {
  const { data, isAdmin, member, show } = useWorkspace();
  const payments = data.payments.filter((payment) => isAdmin || payment.memberId === member?.id);
  if (!payments.length) return <EmptyState icon={History} title="No settlements yet" description="Recorded contributions appear here, including partial payments." />;
  return <div className="data-table-wrap"><table className="data-table settlement-table"><thead><tr><th scope="col">Contribution</th><th scope="col">Date</th><th className="numeric" scope="col">Amount</th>{isAdmin && <th className="numeric" scope="col">Action</th>}</tr></thead>
    <tbody>{payments.map((payment) => <tr key={payment.id}><td><div className="table-activity"><IconBox icon={ArrowDownLeft} size={16} /><div><strong>{data.roommates.find((person) => person.id === payment.memberId)?.name ?? 'Roommate'}</strong><small>{payment.note || `${payment.applications.length} ${payment.applications.length === 1 ? 'refill' : 'refills'} settled in part or full`}</small></div></div></td><td>{formatDay(payment.date)}</td><td className="numeric table-money">{formatMoney(payment.amountCents)}</td>{isAdmin && <td className="numeric"><button className="icon-button" title="Delete contribution" aria-label={`Delete contribution of ${formatMoney(payment.amountCents)} on ${formatDay(payment.date)}`} onClick={() => show('paymentDelete', { id: payment.id })}><Trash2 size={16} /></button></td>}</tr>)}</tbody>
  </table></div>;
}

const views = [
  { name: 'Roommates', mine: 'My share', icon: UsersRound, description: 'See contributions and remaining balances for each roommate.', own: 'See what you’ve paid and what’s still due.', component: Roommates },
  { name: 'Refill splits', icon: ClipboardList, description: 'Expand a refill to see how it was divided.', component: Refills },
  { name: 'Settlements', icon: History, description: 'A record of every contribution logged on this device.', own: 'Your recorded contributions, newest first.', component: Settlements },
];

export default function BillSplitter() {
  const { totals, member, isAdmin, show } = useWorkspace();
  const [active, setActive] = useState(0);
  const current = views[active];
  const Content = current.component;
  const owes = isAdmin ? totals.outstanding : (totals.members.get(member?.id)?.outstanding ?? 0);
  return <div className="page-flow">
    <PageHeading eyebrow="HOUSEHOLD LEDGER" title="Bill splitter" description="Share electricity fairly and see exactly who’s settled up." actions={<>
      <button className="button button-secondary" onClick={() => show('calculate')}><Calculator size={17} /> Calculate share</button>
      {isAdmin ? <button className="button button-primary" onClick={() => show('roommate')}><UserRoundPlus size={17} /> Add roommate</button> : owes > 0 && <button className="button button-primary" onClick={() => show('payment')}><Plus size={18} /> Record contribution</button>}
    </>} />
    <SplitMetrics />
    <section className="glass-panel splitter-panel">
      <div className="splitter-navigation"><div className="tab-list" aria-label="Bill splitter views">{views.map(({ name, mine, icon: Icon }, index) => <button type="button" key={name} className="inner-tab" aria-pressed={index === active} onClick={() => setActive(index)}><Icon size={16} /><span>{!isAdmin && mine ? mine : name}</span>{active === index && <motion.span layoutId="splitter-active" className="tab-indicator" transition={spring} />}</button>)}</div>
        {isAdmin && owes > 0 && <button className="button button-secondary split-record" onClick={() => show('payment')}><Plus size={17} /> <span>Record contribution</span></button>}
      </div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={active} initial={{ opacity: 0, x: 7 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -7 }} transition={spring}>
        <PanelHeading icon={current.icon} title={!isAdmin && current.mine ? current.mine : current.name} description={!isAdmin && current.own ? current.own : current.description} />
        <Content />
      </motion.div></AnimatePresence>
    </section>
  </div>;
}
