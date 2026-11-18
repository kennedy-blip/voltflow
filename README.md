# VoltFlow

VoltFlow is a local-first apartment electricity ledger. It tracks prepaid tokens, estimates when to refill the meter, splits electricity costs, and estimates appliance consumption in kWh and KES. The same React app ships as a Vercel-hosted web PWA and as a Capacitor Android app.

## Run locally

Requires Node 22 LTS (or the version range in `package.json`).

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

Use the **production preview** to test offline web loading. The service worker precaches the app after the first successful online load on HTTPS (or localhost). The APK bundles all app assets and can launch offline on first use. The APK download itself requires network access unless the file is already downloaded.

## Use the ledger

- **Overview:** Log top-ups and meter readings. The forecast starts from the most recent reported meter balance (or first logged top-up), adds later purchases, and subtracts daily usage. Missing elapsed days use the mean of available readings over seven calendar days, or the configured fallback rate. Same-day top-ups logged after a meter reading are added to that reading. The forecast is an estimate, not a utility-provider meter integration. Low balance alerts are displayed inside the app.
- **Bill Splitter:** Add roommate profiles, choose equal or weighted splits when logging a refill, and record partial or full contributions. Historical splits retain their original amounts when profile weights change. Money is stored as integer cents; rounding never changes the total. Payments are allocated to the oldest unpaid shares by default or to a specified refill. An edited share cannot go below the paid amount.
- **Estimator:** Set the power rating, run time, and count of appliances to estimate daily kWh and daily/30-day costs. Estimator inputs are stored per role/profile.
- **Settings:** Change theme, update the KES/kWh utility rate, optionally protect Admin mode with a local passcode, export a JSON ledger, and manage device storage. The first launch uses clearly labeled sample records. Select **Start fresh** to enter real household data.

VoltFlow does not sync records between phones, browsers, or web and Android installations. Roles restrict app actions and the passcode limits switching on the same device; neither is server-side authentication or encryption. Anyone with device-level access to browser storage can modify or remove that storage. Export important records before clearing browser data, changing APK signing channels, or resetting a device. A JSON export contains records for reference and processing; it is not an in-app restore file.

## Vercel web deployment

Import the repository in Vercel and select the Vite preset (the build/output rules and route rewrites are in `vercel.json`). Use Node 22. A preview can be built from the current branch without promoting it to production. No utility account, API key, or database service is required.

The web build publishes `/downloads/manifest.json`. If `public/downloads/voltflow.apk` is present, the manifest includes a same-origin download link, file size, and SHA-256. Or set `ANDROID_APK_URL` to a stable HTTPS APK asset URL (for example, a public GitHub Release attachment). For a signed production release, set `ANDROID_APK_CHANNEL=release`. See `.env.example`. If neither is configured, the APK Center shows that no build is published rather than linking to an invalid file. APK files are excluded from browser precaching and from the native app bundle.

## Build Android

Requires JDK 21, Android SDK platform 35, and Android build tools 35.0.0. The project uses checked-in Gradle wrapper scripts and targets Android 15 with Android 6.0 as its minimum OS.

```sh
npm ci
npm run android:debug
mkdir -p public/downloads
cp android/app/build/outputs/apk/debug/app-debug.apk public/downloads/voltflow.apk
npm run build
```

Debug APKs are installable previews. Android requires allowing installs from the browser or file manager if the APK is sideloaded. For a release, supply `VOLTFLOW_KEYSTORE` (filesystem path), `VOLTFLOW_STORE_PASSWORD`, `VOLTFLOW_KEY_ALIAS`, and `VOLTFLOW_KEY_PASSWORD` through your local environment and run `npm run android:release`. Keep the key outside Git and reuse it for updates; increment the Android `versionCode` for each release. Verify the APK with `apksigner verify --verbose app-release.apk` before publishing it. Never put signing credentials in Vercel’s client build or in the repo.

The **Verify and package VoltFlow** GitHub Actions workflow checks the web app and uses the Android SDK to publish an installable `voltflow-android` artifact. Where the corresponding encrypted GitHub Actions secrets (including `VOLTFLOW_KEYSTORE_BASE64` in place of the file path) are available, it produces a signed release instead. For production distribution, publish the verified release APK on stable hosting and point the APK Center to that asset.

## Source layout

- `src/components/`: dashboard, splitter, estimator, settings, and dialogs
- `src/db/`: Dexie schema, demo data, and transactional operations with role checks
- `src/lib/`: forecast and money logic, platform file helpers, and workspace context
- `src/styles/`: theme variables, glass styling, mesh animation, and responsive layouts
- `android/`, `capacitor.config.json`: native Android wrapper
- `vercel.json`, `vite.config.js`: web routing, build, and offline cache
