import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertCircle, LoaderCircle, RotateCcw, Zap } from 'lucide-react';
import { initializeWorkspace, readWorkspace } from './db/actions.js';
import { forecast, ledgerTotals, localDay } from './lib/ledger.js';
import { WorkspaceContext } from './lib/workspace.js';
import AppShell from './components/AppShell.jsx';
import TokenTracker from './components/TokenTracker.jsx';
import BillSplitter from './components/BillSplitter.jsx';
import ApplianceEstimator from './components/ApplianceEstimator.jsx';
import Settings from './components/Settings.jsx';
import LedgerDialogs from './components/LedgerDialogs.jsx';
import DownloadAPKModal from './components/DownloadAPKModal.jsx';
import { IconBox, Toast, spring } from './components/ui.jsx';

function Boot({ error, retry }) {
  return <main className="boot-screen"><section className="glass-panel boot-card">
    <IconBox icon={error ? AlertCircle : Zap} tone={error ? 'amber' : 'mint'} size={24} /><h1>{error ? 'Couldn’t open your ledger' : 'VoltFlow'}</h1>
    <p>{error ? 'Check that this browser allows local storage, then try again. VoltFlow does not send your records to a server.' : 'Opening your local workspace…'}</p>
    {error ? <button type="button" className="button button-secondary" onClick={retry}><RotateCcw size={16} /> Try again</button> : <LoaderCircle className="spin boot-loader" aria-label="Loading" size={21} />}
  </section></main>;
}

export class RenderBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Boot error retry={() => window.location.reload()} /> : this.props.children; }
}

const themeColor = { electric: '#080c14', solar: '#eff3f2', matrix: '#03100b' };
const isAdminDialog = new Set(['token', 'reading', 'roommate', 'shares', 'member', 'pin', 'archive', 'paymentDelete', 'clearPayments', 'reset']);

function Workspace({ data, native }) {
  const location = useLocation();
  const [day, setDay] = useState(localDay);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(null);
  const theme = data.settings.theme;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[theme]);
  }, [theme]);
  useEffect(() => {
    const sync = () => { setDay(localDay()); setOnline(navigator.onLine); };
    addEventListener('online', sync); addEventListener('offline', sync); addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    const timer = setInterval(sync, 30_000);
    return () => { removeEventListener('online', sync); removeEventListener('offline', sync); removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); clearInterval(timer); };
  }, []);
  useEffect(() => { setModal(null); window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  const isAdmin = data.settings.role === 'admin';
  const member = data.roommates.find((person) => person.id === data.settings.activeMemberId);
  const model = useMemo(() => forecast(data.tokens, data.readings, data.settings, day), [data.tokens, data.readings, data.settings, day]);
  const totals = useMemo(() => ledgerTotals(data.tokens, data.payments), [data.tokens, data.payments]);
  const notice = useCallback((text, type = 'success') => setMessage({ text, type, id: Symbol() }), []);
  const dismiss = useCallback(() => setMessage(null), []);
  const show = useCallback((type, props) => {
    if (!isAdmin && isAdminDialog.has(type)) return;
    setModal({ type, props, path: location.pathname, id: Symbol() });
  }, [isAdmin, location.pathname]);
  const activeModal = modal?.path === location.pathname && (isAdmin || !isAdminDialog.has(modal.type)) ? modal : null;
  const close = () => setModal((current) => current?.id === activeModal?.id ? null : current);
  const done = (text) => { close(); notice(text); };
  const context = { data, native, day, online, isAdmin, member, model, totals, notice, show };

  return <MotionConfig reducedMotion="user"><WorkspaceContext.Provider value={context}>
    <AppShell native={native}>
      <AnimatePresence mode="wait" initial={false}><motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={spring}>
        <Routes location={location}>
          <Route path="/" element={<TokenTracker />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/splitter" element={<BillSplitter />} />
          <Route path="/estimator" element={<ApplianceEstimator />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div></AnimatePresence>
    </AppShell>
    {activeModal?.type === 'apk' ? <DownloadAPKModal release={activeModal.props?.release} close={close} /> : activeModal && <LedgerDialogs key={activeModal.type} modal={activeModal} close={close} done={done} />}
    <AnimatePresence>{message && <Toast message={message} dismiss={dismiss} />}</AnimatePresence>
  </WorkspaceContext.Provider></MotionConfig>;
}

export default function App({ native }) {
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const result = useLiveQuery(async () => {
    if (state !== 'ready') return null;
    try { return await readWorkspace(); }
    catch (error) { return { error }; }
  }, [state, attempt]);
  useEffect(() => {
    let relevant = true;
    initializeWorkspace().then(() => { if (relevant) setState('ready'); }).catch(() => { if (relevant) setState('error'); });
    return () => { relevant = false; };
  }, [attempt]);
  if (result?.settings && state === 'ready') return <Workspace data={result} native={native} />;
  return <Boot error={state === 'error' || Boolean(result?.error)} retry={() => { setState('loading'); setAttempt((value) => value + 1); }} />;
}
