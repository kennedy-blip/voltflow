import { Download, Fingerprint, Smartphone } from 'lucide-react';
import { useWorkspace } from '../lib/workspace.js';
import { formatBytes } from '../lib/files.js';
import { Drawer } from './ui.jsx';

export function APKLink({ release }) {
  return <a className="button button-primary" href={release.url} download={release.url.startsWith('/') ? 'voltflow.apk' : undefined}><Download size={18} /> Download Android APK</a>;
}

export default function DownloadAPKModal({ release, close }) {
  const { notice } = useWorkspace();
  return <Drawer title="Install VoltFlow on Android" description="The Android app includes the full workspace and runs without a connection." icon={Smartphone} onClose={close}>
    <div className="action-form">
      {release ? <>
        <div className="form-inset form-inline-note"><strong>VoltFlow v{release.version}</strong><span>{release.channel === 'preview' ? 'Preview build' : 'Signed release'}{release.bytes ? ` · ${formatBytes(release.bytes)}` : ''}</span></div>
        <ol className="install-steps"><li>Download the APK on an Android 6.0 or later device.</li><li>Open the file from Downloads. If prompted, allow installs for this browser or file manager.</li><li>Tap Install, then open VoltFlow. The app starts with its own local ledger.</li></ol>
        {release.sha256 && <div className="checksum"><Fingerprint size={17} aria-hidden="true" /><div><strong>SHA-256 checksum</strong><code>{release.sha256}</code></div><button type="button" className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(release.sha256); notice('Checksum copied.'); } catch { notice('Clipboard access is unavailable. Select the checksum to copy it.', 'error'); } }}>Copy</button></div>}
        {release.channel === 'preview' && <p className="field-hint">This preview APK is not a production-signed release. Export any records you want to keep before replacing it with a differently signed build.</p>}
        <div className="form-actions"><APKLink release={release} /></div>
      </> : <><p className="field-hint">No APK is published on this deployment yet. You can continue to use VoltFlow offline in your browser after its first successful load.</p><div className="form-actions"><button className="button button-primary" onClick={close}>Got it</button></div></>}
    </div>
  </Drawer>;
}
