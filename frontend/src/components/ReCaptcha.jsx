import { useEffect, useRef } from 'react'
import './ReCaptcha.css'

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY

let scriptLoading = false
let scriptLoaded = false
const loadCallbacks = []

function loadRecaptchaScript() {
  if (scriptLoaded || window.grecaptcha?.render) {
    scriptLoaded = true
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    loadCallbacks.push(resolve)

    if (scriptLoading) return

    scriptLoading = true
    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoaded = true
      loadCallbacks.forEach((cb) => cb())
      loadCallbacks.length = 0
    }
    script.onerror = () => {
      scriptLoading = false
      reject(new Error('Failed to load reCAPTCHA'))
    }
    document.head.appendChild(script)
  })
}

export default function ReCaptcha({ onChange, onExpired }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onExpiredRef = useRef(onExpired)

  useEffect(() => {
    onChangeRef.current = onChange
    onExpiredRef.current = onExpired
  })

  useEffect(() => {
    if (!SITE_KEY) {
      console.error('Missing VITE_RECAPTCHA_SITE_KEY in environment variables')
      return
    }

    let cancelled = false

    loadRecaptchaScript().then(() => {
      if (cancelled || !containerRef.current || widgetIdRef.current !== null) return

      window.grecaptcha.ready(() => {
        if (cancelled || !containerRef.current || widgetIdRef.current !== null) return

        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onChangeRef.current?.(token),
          'expired-callback': () => {
            onChangeRef.current?.(null)
            onExpiredRef.current?.()
          },
        })
      })
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="recaptcha-wrapper">
      <div ref={containerRef} className="recaptcha-container" />
    </div>
  )
}
