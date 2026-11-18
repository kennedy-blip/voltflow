import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, Building2, Calculator, ChevronDown, ChevronRight, ChevronsUpDown, CircleCheck, Database, Gauge, LayoutGrid, Settings2, ShieldCheck, UserRound, UsersRound, WifiOff, Zap } from 'lucide-react';
import { useWorkspace } from '../lib/workspace.js';
import { formatUnits } from '../lib/ledger.js';
import { IconBox } from './ui.jsx';

const tabs = [
  { path: '/', name: 'Overview', mobile: 'Overview', icon: LayoutGrid },
  { path: '/splitter', name: 'Bill Splitter', mobile: 'Splitter', icon: UsersRound },
  { path: '/estimator', name: 'Estimator', mobile: 'Estimator', icon: Calculator },
  { path: '/settings', name: 'Settings', mobile: 'Settings', icon: Settings2 },
];

function Brand() {
  return <Link to="/" className="brand" aria-label="VoltFlow overview">
    <span className="brand-mark"><Zap size={23} fill="currentColor" strokeWidth={1.5} /></span>
    <span><strong>Volt<span>Flow</span></strong><small>UTILITY LEDGER</small></span>
  </Link>;
}

function Navigation({ mobile }) {
  return <nav className={mobile ? 'bottom-nav' : 'side-nav'} aria-label={mobile ? 'Mobile navigation' : 'Workspace navigation'}>
    {tabs.map(({ path, name, mobile: short, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-link${isActive ? ' nav-active' : ''}`}>
      <Icon aria-hidden="true" size={mobile ? 19 : 18} strokeWidth={1.85} /><span>{mobile ? short : name}</span>{!mobile && <ChevronRight aria-hidden="true" className="nav-chevron" size={15} />}
    </NavLink>)}
  </nav>;
}

function Notifications() {
  const { model, online } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState('');
  const root = useRef(null);
  const trigger = useRef(null);
  const code = model.low ? 'low' : 'ready';
  useEffect(() => {
    if (!open) return;
    function close(event) { if (!root.current?.contains(event.target)) setOpen(false); }
    function escape(event) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="notifications" ref={root}>
    <button ref={trigger} type="button" className="icon-button notify-button" aria-label={`Notifications${seen !== code ? ' (unread)' : ''}`} aria-expanded={open} aria-controls={open ? 'notification-panel' : undefined} onClick={() => { setOpen(!open); setSeen(code); }}>
      <Bell size={19} strokeWidth={1.8} />{seen !== code && <span data-low={model.low} />}
    </button>
    {open && <section id="notification-panel" className="notification-popover glass-panel" aria-label="Notifications">
      <h2>Notifications</h2>
      {model.low ? <div className="notification-item"><IconBox icon={AlertTriangle} tone="amber" /><div><strong>Low token balance</strong><p>About {formatUnits(model.balance)} kWh remain. Plan your next refill soon.</p></div></div> : <div className="notification-item"><IconBox icon={model.hasBalance ? CircleCheck : Activity} /><div><strong>{model.hasBalance ? 'Balance is in good shape' : 'No meter balance yet'}</strong><p>{model.hasBalance ? 'VoltFlow will let you know when it’s time to top up.' : 'Log a refill or meter reading to start forecasting.'}</p></div></div>}
      <div className="notification-item"><IconBox icon={online ? Database : WifiOff} tone="sky" /><div><strong>{online ? 'Offline-ready ledger' : 'You’re offline'}</strong><p>Changes are stored on this device.</p></div></div>
    </section>}
  </div>;
}

export default function AppShell({ children, native }) {
  const { data, isAdmin, member, online } = useWorkspace();
  const location = useLocation();
  const page = tabs.find((tab) => tab.path === location.pathname) ?? tabs[0];
  return <div className={`app-shell${native ? ' native-shell' : ''}`}>
    <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <div className="ambient-mesh" aria-hidden="true"><span className="animate-mesh" /><span /></div>
    <aside className="sidebar">
      <Brand />
      <Link className="workspace-chip" to="/settings">
        <IconBox icon={Building2} size={17} /><span><strong title={data.settings.name}>{data.settings.name}</strong><small>{data.settings.sample ? 'Sample workspace' : 'Local workspace'}</small></span><ChevronsUpDown size={15} className="workspace-chevron" />
      </Link>
      <div className="sidebar-label">WORKSPACE</div>
      <Navigation />
      <div className="sidebar-bottom">
        <div className="offline-card"><span className="status-dot" aria-hidden="true" /><div><strong>{online ? 'Offline-ready' : 'Working offline'}</strong><p>Data stays on this device</p></div></div>
        <Link className="sidebar-account" to="/settings">
          <IconBox icon={isAdmin ? ShieldCheck : UserRound} size={17} /><span><strong>{isAdmin ? 'Apartment Head' : member?.name ?? 'Resident Member'}</strong><small>{isAdmin ? 'Administrator' : 'Resident'}</small></span><ChevronDown size={15} />
        </Link>
      </div>
    </aside>
    <div className="app-body">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="mobile-brand"><Brand /></div>
          <div className="breadcrumbs" aria-label="Current location"><Gauge size={16} aria-hidden="true" /><span>Workspace</span><ChevronRight size={13} aria-hidden="true" /><strong>{page.name}</strong></div>
          <div className="topbar-actions">
            <Link className="role-chip" to="/settings" aria-label={isAdmin ? 'Admin mode settings' : 'Member mode settings'}><ShieldCheck size={15} aria-hidden="true" /><span>{isAdmin ? 'Admin mode' : 'Member mode'}</span></Link>
            <Notifications key={location.pathname} />
          </div>
        </div>
      </header>
      <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
    </div>
    <Navigation mobile />
  </div>;
}
