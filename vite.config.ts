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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Sawmill Planner',
        short_name: 'Sawmill',
        description: 'Plan and optimize log milling for single-blade sawmills.',
        theme_color: '#3a444f',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  test: {
    globals: true,
    environment: 'node'
  }
});
