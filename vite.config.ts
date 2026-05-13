import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Served as a GitHub Pages project site at
 *   https://<user>.github.io/sawmill/
 * so every asset URL must be prefixed with `/sawmill/`. A local dev run
 * still works because Vite only prepends `base` for built files.
 *
 * If you rename the GitHub repository, change `BASE` here (and the `scope`
 * / `start_url` in the PWA manifest below) to match the new path.
 */
const BASE = '/sawmill/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // `prompt` means the service worker does NOT auto-activate when a
      // new build lands — the app surfaces an "Update available, reload?"
      // toast and only swaps versions when the user confirms. This keeps
      // the workshop tablet running a known-good build until the sawyer
      // is between logs and happy to update.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Northern Lights Sawmill Planner',
        short_name: 'NL Sawmill',
        description: 'Plan and optimize log milling for single-blade chainsaw and bandsaw sawmills.',
        theme_color: '#0b1026',
        background_color: '#f4f6f8',
        display: 'standalone',
        orientation: 'any',
        // `scope` and `start_url` must live under `base`, otherwise Chrome
        // refuses to install the PWA ("Manifest start_url is not within
        // scope of service worker").
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,webmanifest}'],
        // Default is 2 MiB. We bump to 5 MiB so future growth (bigger
        // icons, extra fonts, more images in the help modal) doesn't
        // silently drop files from the precache manifest.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  test: {
    globals: true,
    environment: 'node'
  }
});
