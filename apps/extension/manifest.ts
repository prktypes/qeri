import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' with { type: 'json' };

/**
 * Single source of truth for the extension's identity and browser contract.
 * Written in TS so version/name stay in sync with the release process.
 *
 * Permission philosophy (plan.md §security): declare exactly what ships today —
 * storage + sidePanel + localhost for the Phase 3 AI proxy + two content-script
 * host patterns. Nothing more. No <all_urls>.
 *
 * Phase 7 (Web store launch): description and homepage URL are aligned with
 * Chrome Web Store requirements. The short/long description, privacy policy URL,
 * and screenshots are configured in the developer dashboard.
 *
 * Phase 5 note: the explicit `content_security_policy` was removed because
 * Chrome MV3 rejects `'unsafe-inline'` in `script-src` (manifest-load error).
 * Chrome applies its secure default MV3 CSP when the key is absent.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Qeri — AI that explains what you read',
  short_name: 'Qeri',
  description:
    'Click Explain on any supported post and get plain-English context without leaving the page. ' +
    "Demo mode keeps all data local; live AI uses OpenRouter with the user's key.",
  version: packageJson.version,
  // sidePanel.open() requires Chrome ≥116
  minimum_chrome_version: '116',

  // Core icons — also the images uploaded to the Chrome Web Store listing.
  // The product mark is `qeri-logo.png` (repo root, 1254×1254); CRXJS maps the
  // 16/32/48/128 entries to the files below.
  icons: {
    16: 'src/assets/qeri-logo-16.png',
    32: 'src/assets/qeri-logo-32.png',
    48: 'src/assets/qeri-logo-48.png',
    128: 'src/assets/qeri-logo-128.png',
  },

  // Toolbar action icon — also used in chrome://extensions card.
  action: {
    default_title: 'Open Qeri panel',
    default_icon: { 16: 'src/assets/qeri-logo-16.png', 32: 'src/assets/qeri-logo-32.png' },
  },

  // Phase 3: side panel attached to the current tab.
  side_panel: {
    default_path: 'src/panel/index.html',
  },

  // The service worker owns all writes to chrome.storage (single-writer store),
  // routes explain requests to the API, and opens the side panel.
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

  // Phase 2: the extraction chip is injected only on supported sites.
  content_scripts: [
    {
      // Legacy host kept for profiles still logged into twitter.com
      matches: ['https://x.com/*', 'https://twitter.com/*'],
      js: ['src/content/content-entry.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],

  permissions: ['storage', 'sidePanel'],

  // Phase 3: the local AI proxy is the only host grant — no <all_urls>, ever.
  // Phase 4 (stage 2): swapped for the deployed Edge Function origin.
  host_permissions: ['http://localhost:8787/*'],

  // Phase 7 (Web store launch): store-listed metadata.
  // Fill in the real URLs before submitting to the store.
  homepage_url: 'https://qeri.ai',

  // Commands — Alt+Q opens the panel; listed in the store's keyboard shortcuts.
  commands: {
    'open-qeri-panel': {
      suggested_key: { default: 'Alt+Q' },
      description: 'Open the Qeri side panel',
    },
  },
});
