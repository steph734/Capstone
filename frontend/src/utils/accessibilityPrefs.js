const STORAGE_KEY = 'therapypro_accessibility'

export const DEFAULT_ACCESSIBILITY = {
  textSize: 'normal', // 'normal' | 'large' | 'extra-large'
  reduceMotion: false,
  highContrast: false,
}

export function loadAccessibilityPrefs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(saved) }
  } catch {
    // ignore malformed storage
  }
  return { ...DEFAULT_ACCESSIBILITY }
}

export function saveAccessibilityPrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

// Toggles classes on <html> so the effect applies across every page,
// not just while the Settings page is mounted.
export function applyAccessibilityPrefs(prefs) {
  const html = document.documentElement
  html.classList.toggle('text-large', prefs.textSize === 'large')
  html.classList.toggle('text-extra-large', prefs.textSize === 'extra-large')
  html.classList.toggle('reduce-motion', !!prefs.reduceMotion)
  html.classList.toggle('high-contrast', !!prefs.highContrast)
}
