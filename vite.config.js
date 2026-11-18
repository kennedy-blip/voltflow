import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const android = mode === 'android';
  return {
    plugins: [react(), !android && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icons/voltflow.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['downloads/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/downloads\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: '/', name: 'VoltFlow — Apartment Energy Ledger', short_name: 'VoltFlow',
        description: 'The offline electricity ledger for shared homes.',
        start_url: '/', scope: '/', display: 'standalone',
        theme_color: '#080c14', background_color: '#080c14', lang: 'en',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }), android && {
      name: 'voltflow-android-assets',
      transformIndexHtml(html) { return html.replace(/^\s*<link rel="(?:icon|apple-touch-icon)"[^\n]*\n/gm, '\n'); },
    }].filter(Boolean),
    publicDir: android ? false : 'public',
    build: { outDir: android ? 'dist-android' : 'dist' },
    server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
    preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  };
});
