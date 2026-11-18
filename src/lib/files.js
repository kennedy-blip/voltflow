import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function saveJson(name, value) {
  const text = JSON.stringify(value, null, 2);
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({ path: name, data: text, encoding: Encoding.UTF8, directory: Directory.Cache });
    await Share.share({ title: 'VoltFlow ledger export', files: [written.uri], dialogTitle: 'Save or share your ledger' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
