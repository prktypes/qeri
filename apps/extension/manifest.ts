import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' with { type: 'json' };

/**
 * Single source of truth for the extension's identity and browser contract.
 * Written in TS so version/name stay in sync with the release process.
 *
 * Permission philosophy (plan.md §security): declare exactly what ships today —
 * storage + sidePanel + two content-script host patterns. Nothing more.
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

  // Clicking the toolbar icon opens the side panel (formal alternative to a popup
  // in v1 — the icon targets "read where you are", not "configure settings").
  action: { default_title: 'Open Qeri panel' },

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

  commands: {
    'open-qeri-panel': {
      suggested_key: { default: 'Alt+Q' },
      description: 'Open the Qeri side panel',
    },
  },
});
