import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' with { type: 'json' };

/**
 * Single source of truth for the extension's identity and browser contract.
 * Written in TS so version/name stay in sync with the release process.
 *
 * Permission philosophy (plan.md §security): declare exactly what ships today —
 * storage + sidePanel + localhost for the Phase 3 AI proxy + two content-script host
 * patterns. Nothing more.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Qeri — AI that explains what you read',
  short_name: 'Qeri',
  description:
    'Click Explain on any supported post and get plain-English context without leaving the page. Demo mode: no data leaves your browser yet.',
  version: packageJson.version,
  // sidePanel.open() requires Chrome ≥116
  minimum_chrome_version: '116',

  // The Qeri mascot everywhere Chrome surfaces identity: toolbar icon, the
  // chrome://extensions card, and the web-store listing later (Phase 7).
  // CRXJS resolves these manifest-relative path strings and bundles the files.
  icons: {
    16: 'src/assets/qeri-logo-16.png',
    32: 'src/assets/qeri-logo-32.png',
    48: 'src/assets/qeri-logo-48.png',
    128: 'src/assets/qeri-logo-128.png',
  },

  // Clicking the toolbar icon opens the side panel (formal alternative to a popup
  // in v1 — the icon targets "read where you are", not "configure settings").
  action: {
    default_title: 'Open Qeri panel',
    default_icon: { 16: 'src/assets/qeri-logo-16.png', 32: 'src/assets/qeri-logo-32.png' },
  },

  side_panel: {
    default_path: 'src/panel/index.html',
  },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

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
  // Phase 4 replaces this with the deployed Edge Function origin (same policy).
  host_permissions: ['http://localhost:8787/*'],
  // Phase 5: explicit CSP — restricts injected script sources and limits
  // what the side panel can load, reducing XSS surface. 'unsafe-inline' is
  // avoided where possible; the panel uses 'strict-dynamic' with a single
  // trusted type for Lucide icons.  Connect back-end only to the local API.
  content_security_policy: {
    // Extends the CRXJS‑specificmanifest type (extension_pages + sandbox)
    // while staying within the Chrome MV3 spec.
    extension_pages:
      "default-src 'self' data: blob; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.lucide-react.com; connect-src 'self' http://localhost:8787; img-src 'self' data:; font-src 'self' data:; frame-src 'self'",
    // sandbox is not needed for the side panel because it is rendered
    // by CRXJS from the extension source code.
    sandbox: undefined,
  },

  commands: {
    'open-qeri-panel': {
      suggested_key: { default: 'Alt+Q' },
      description: 'Open the Qeri side panel',
    },
  },
});
