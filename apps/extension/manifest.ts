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
 * Phase 7 (Web store launch): the following fields are aligned with Chrome Web
 * Store requirements. The short/long description, privacy policy URL, and
 * screenshots are configured in the developer dashboard, but the manifest
 * declares the core metadata that the store pulls through.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Qeri — AI that explains what you read',
  short_name: 'Qeri',
  description:
    'Click Explain on any supported post and get plain-English context without leaving the page. ' +
    "Demo mode keeps all data local; live AI uses OpenRouter with the user's key.",
  version: packageJson.version,
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

  // Phase 4 (stage 2): when the Edge Function is deployed, this host
  // permission will be swapped for the function's origin.
  host_permissions: ['http://localhost:8787/*'],

  // Commands — Alt+Q opens the panel; listed in the store's keyboard shortcuts.
  commands: {
    'open-qeri-panel': {
      suggested_key: { default: 'Alt+Q' },
      description: 'Open the Qeri side panel',
    },
  },
});
