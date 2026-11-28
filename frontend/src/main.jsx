import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installAuthFetch } from './utils/installAuthFetch'

installAuthFetch() // attach the sign-in token to every call to our own /api

// After a new deployment an open (or cached) page can ask for files that no longer exist. Reload to pick up the new
// version: at most once a minute, and never while offline.
function reloadForNewVersion() {
  try {
    if (!navigator.onLine || Date.now() - Number(sessionStorage.getItem('tp_asset_reload') || 0) < 60000) return
    sessionStorage.setItem('tp_asset_reload', String(Date.now()))
    window.location.reload()
  } catch { /* storage blocked: skip, so we can never loop */ }
}
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadForNewVersion() })
window.addEventListener('load', () => {
  if ([...document.querySelectorAll('link[rel="stylesheet"][href*="/assets/"]')].some((l) => !l.sheet)) reloadForNewVersion()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
