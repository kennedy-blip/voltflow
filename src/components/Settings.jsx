import { useEffect, useState } from 'react';
import { Archive, Database, Download, HardDrive, LockKeyhole, Settings2, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { exportLedger, saveUtility } from '../db/actions.js';
import { formatBytes, saveJson } from '../lib/files.js';
import { formatMoney } from '../lib/ledger.js';
import { useWorkspace } from '../lib/workspace.js';
import { APKLink } from './DownloadAPKModal.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { ActionForm, Field, IconBox, PageHeading, PanelHeading } from './ui.jsx';

function UtilitySettings() {
  const { data, isAdmin, notice } = useWorkspace();
  const { name, rateCents, manualDaily, lowThreshold } = data.settings;
  return <section className="glass-panel settings-panel"><PanelHeading icon={Settings2} title="Utility settings" description="Set the rate and forecasting defaults for your apartment." />
    {isAdmin ? <ActionForm key={`${name}-${rateCents}-${manualDaily}-${lowThreshold}`} submit={saveUtility} done={() => notice('Utility settings saved.')} footerClass="align-left">
      <Field label="Workspace name" name="name" maxLength={48} defaultValue={name} required />
      <div className="form-grid"><Field label="Utility rate (KES / kWh)" name="rate" inputMode="decimal" defaultValue={(rateCents / 100).toFixed(2)} required /><Field label="Fallback usage (kWh / day)" name="manualDaily" inputMode="decimal" defaultValue={manualDaily} required /></div>
      <Field label="Low-balance threshold (kWh)" name="lowThreshold" inputMode="decimal" defaultValue={lowThreshold} hint="An alert also appears when the forecast has two days or less remaining." required />
    </ActionForm> : <><dl className="settings-readonly"><div><dt>Utility rate</dt><dd>{formatMoney(rateCents)} / kWh</dd></div><div><dt>Fallback usage</dt><dd>{manualDaily} kWh / day</dd></div><div><dt>Low-balance alert</dt><dd>{lowThreshold} kWh</dd></div></dl><div className="settings-inline"><LockKeyhole size={16} /><p>Only the Apartment Head can change these settings.</p></div></>}
  </section>;
}

function AndroidCenter() {
  const { native, show } = useWorkspace();
  const [result, setResult] = useState(() => ({ state: native ? 'installed' : 'loading', release: null }));
  useEffect(() => {
    if (native) return;
    const controller = new AbortController();
    fetch('/downloads/manifest.json', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('No release manifest');
      const payload = await response.json();
      const release = payload.release;
      const valid = typeof release?.url === 'string' && (release.url === '/downloads/voltflow.apk' || release.url.startsWith('https://')) && typeof release?.version === 'string';
      setResult({ state: valid ? 'published' : 'unavailable', release: valid ? release : null });
    }).catch((error) => { if (error.name !== 'AbortError') setResult({ state: 'unreachable', release: null }); });
    return () => controller.abort();
  }, [native]);
  const { release, state } = result;
  return <section className="glass-panel settings-panel android-card">
    <div className="android-decoration" aria-hidden="true"><Smartphone size={136} strokeWidth={0.75} /></div>
    <PanelHeading icon={Smartphone} title="VoltFlow for Android" description="APK CENTER" />
    <p>Keep your power ledger in your pocket. The Android app includes the estimator, splitter, and offline token tracking.</p>
    <div className="android-actions">
      {release && <APKLink release={release} />}
      {!native && <button className={`button button-${release ? 'quiet' : 'secondary'}`} type="button" onClick={() => show('apk', { release })}><Download size={16} /> {release ? 'Installation guide' : 'Android install details'}</button>}
    </div>
    <div className="android-release"><span className={`status-dot${release || native ? '' : ' dot-muted'}`} />{native ? 'Android app installed · Offline-ready' : release ? `Version ${release.version} · ${release.channel === 'release' ? 'Signed release' : 'Preview APK'}${release.bytes ? ` · ${formatBytes(release.bytes)}` : ''}` : state === 'loading' ? 'Checking for an Android build…' : state === 'unreachable' ? 'Download information is unavailable offline.' : 'No Android build published for this deployment.'}</div>
  </section>;
}

function StoragePanel() {
  const { data, day, isAdmin, notice } = useWorkspace();
  const [storage, setStorage] = useState({ persistent: false, usage: null });
  const [requesting, setRequesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
  useEffect(() => {
    let mounted = true;
    const api = navigator.storage;
    if (api) Promise.all([api.persisted?.(), api.estimate?.()]).then(([persistent, metrics]) => {
      if (mounted) setStorage({ persistent: Boolean(persistent), usage: metrics?.usage ?? null });
    }).catch(() => {});
    return () => { mounted = false; };
  }, [bytes]);
  async function requestPersistence() {
    setRequesting(true);
    try {
      const persistent = await navigator.storage.persist();
      setStorage((current) => ({ ...current, persistent }));
      notice(persistent ? 'This browser has granted persistent storage.' : 'This browser did not grant persistent storage. Export a copy to be safe.', persistent ? 'success' : 'error');
    } catch { notice('Persistent storage could not be requested.', 'error'); }
    finally { setRequesting(false); }
  }
  async function downloadExport() {
    setExporting(true);
    try { await saveJson(`voltflow-ledger-${day}.json`, await exportLedger()); notice('Ledger export is ready.'); }
    catch (error) { notice(error.message || 'Could not export your ledger.', 'error'); }
    finally { setExporting(false); }
  }
  return <section className="glass-panel settings-panel"><PanelHeading icon={Database} tone="sky" title="Local storage" description="Your records are stored on this device, not in the cloud." />
    {isAdmin ? <><div className="storage-metrics"><div><strong>{data.tokens.length}</strong><span>Token logs</span></div><div><strong>{data.readings.length}</strong><span>Meter readings</span></div><div><strong>{data.payments.length}</strong><span>Contributions</span></div></div>
      <div className="settings-inline"><HardDrive size={18} /><p>Ledger size: {formatBytes(bytes)}{storage.usage != null && ` · Site data: ${formatBytes(storage.usage)}`}</p></div></> : <div className="settings-inline"><LockKeyhole size={17} /><p>Only the Apartment Head can export or clear household records.</p></div>}
    {isAdmin && <div className="storage-actions"><button className="button button-secondary" disabled={exporting} onClick={downloadExport}><Archive size={16} /> {exporting ? 'Exporting…' : 'Export ledger'}</button>
      {navigator.storage?.persist && !storage.persistent && <button className="button button-quiet" disabled={requesting} onClick={requestPersistence}><ShieldCheck size={16} />{requesting ? 'Requesting…' : 'Protect local storage'}</button>}
      {storage.persistent && <span className="pill pill-green"><i /> Persistent storage</span>}
    </div>}
  </section>;
}

function Maintenance() {
  const { data, show } = useWorkspace();
  return <section className="glass-panel settings-panel maintenance-card"><PanelHeading icon={Trash2} tone="rose" title="Ledger maintenance" description="These actions cannot be undone." />
    <div className="maintenance-row"><div><strong>Clear contributions</strong><small>Remove payments while keeping refill shares.</small></div><button className="button button-danger-outline" disabled={!data.payments.length} onClick={() => show('clearPayments')}>Clear payments</button></div>
    <div className="maintenance-row"><div><strong>{data.settings.sample ? 'Start with your own data' : 'Clear local ledger'}</strong><small>{data.settings.sample ? 'Remove sample data before you enter real records.' : 'Remove the records stored on this device.'}</small></div><button className="button button-danger-outline" onClick={() => show('reset')}>{data.settings.sample ? 'Start fresh' : 'Clear ledger'}</button></div>
  </section>;
}

export default function Settings() {
  const { isAdmin, data, show } = useWorkspace();
  return <div className="page-flow">
    <PageHeading eyebrow="WORKSPACE PREFERENCES" title="Settings" description="Manage access, make VoltFlow your own, and take it with you." actions={<button className="button button-secondary" onClick={() => show(isAdmin ? 'member' : 'admin')}><ShieldCheck size={17} /> Switch role</button>} />
    <div className="settings-grid">
      <div className="settings-stack"><RoleSwitcher /><ThemeToggle /><UtilitySettings /></div>
      <div className="settings-stack"><AndroidCenter /><StoragePanel />{isAdmin && <Maintenance />}</div>
    </div>
    {data.settings.sample && <div className="info-note"><IconBox icon={Database} /><p>This workspace starts with sample data. The Apartment Head can clear it in Ledger maintenance when you’re ready to set up your own apartment.</p></div>}
  </div>;
}
