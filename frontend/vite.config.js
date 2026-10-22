import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      // Default is 2 MiB; the main JS chunk (jsPDF, qrcode, Stream chat/video
      // SDKs, etc. all bundled together) now runs well over that, so it
      // needs raising rather than the build silently failing to precache it.
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The app shell (JS/CSS/HTML) is precached above. These rules cover
        // the files fetched later, so games still look right with no internet.
        // API calls are deliberately NOT cached: offline data comes from the
        // local database (src/offline), never from a stale API response.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Game art, Pao poses, logos, photos: cached after the first view.
            urlPattern: ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: { cacheName: 'tp-images', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Lottie animations are JSON files: show the cached copy, refresh it in the background.
            urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:json|lottie)$/.test(url.pathname) && !url.pathname.startsWith('/api/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tp-animations', expiration: { maxEntries: 100 } },
          },
        ],
      },
      manifest: {
        name: 'My Capstone Project',
        short_name: 'Capstone',
        description: 'An awesome Vite + React PWA',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
