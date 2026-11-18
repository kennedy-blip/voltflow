import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'ANDROID_APK_'), ...process.env };
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const localPath = 'public/downloads/voltflow.apk';
const target = 'public/downloads/manifest.json';
const channel = env.ANDROID_APK_CHANNEL === 'release' ? 'release' : 'preview';
let release = null;

if (env.ANDROID_APK_URL) {
  const remote = new URL(env.ANDROID_APK_URL);
  if (remote.protocol !== 'https:' || remote.username || remote.password) throw new Error('ANDROID_APK_URL must be an HTTPS URL without credentials.');
  release = { url: remote.href, version, channel };
} else if (existsSync(localPath)) {
  const bytes = readFileSync(localPath);
  if (bytes.subarray(0, 4).toString('hex') !== '504b0304' || !bytes.includes(Buffer.from('AndroidManifest.xml'))) {
    throw new Error('The supplied Android file is not an APK.');
  }
  release = { url: '/downloads/voltflow.apk', version, channel, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

mkdirSync('public/downloads', { recursive: true });
const contents = `${JSON.stringify({ release }, null, 2)}\n`;
if (!existsSync(target) || readFileSync(target, 'utf8') !== contents) writeFileSync(target, contents);
