import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Vite bundles this config file into a temp module before running it, so a
// relative dynamic import here would resolve against that temp file's
// location instead of this file's real location. Resolve from process.cwd()
// (the directory `vite`/`npm run dev` was launched from, i.e. frontend/)
// instead, which is stable regardless of where Vite stages the temp config.
const paymentIntentLibUrl = pathToFileURL(
  path.resolve(process.cwd(), '..', 'api', '_lib', 'createPaymentIntent.js')
).href

// Dev-only: serves /api/create-payment-intent locally (mirrors the Vercel
// serverless function at ../api/create-payment-intent.js) so `npm run dev`
// works end-to-end without needing the Vercel CLI.
function stripeDevApiPlugin() {
  return {
    name: 'stripe-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/create-payment-intent', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const mod = await import(paymentIntentLibUrl)
          const { createPaymentIntent } = mod.default ?? mod
          const result = await createPaymentIntent()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The Stripe secret key lives in the repo-root .env (never frontend/.env,
  // which only holds client-safe VITE_ vars). Vite's own env loading only
  // reads frontend/.env* and only exposes VITE_-prefixed vars to the client,
  // so load the root .env separately here and put it on process.env for the
  // dev middleware above to read via process.env.STRIPE_SECRET_KEY.
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '')
  if (rootEnv.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = rootEnv.STRIPE_SECRET_KEY

  return {
    plugins: [
      react(),
      stripeDevApiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline', // Automatically registers the service worker in index.html
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'] // Explicitly tell workbox to cache assets
        },
        devOptions: {
          enabled: true // Allows you to test the service worker locally on localhost
        },
        manifest: {
          name: 'Therapy Pro',
          short_name: 'TherapyPro',
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
  }
})