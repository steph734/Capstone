import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ReCaptcha.css'

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY
const MOBILE_BREAKPOINT = 768

const WIDGET = {
  normal: { width: 304, height: 78 },
  compact: { width: 164, height: 144 },
}

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

function computeLayout(hostWidth) {
  const isMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  const size = isMobile || hostWidth < WIDGET.normal.width ? 'compact' : 'normal'
  const { width: baseWidth, height: baseHeight } = WIDGET[size]
  const scale = hostWidth < baseWidth ? hostWidth / baseWidth : 1

  return {
    size,
    scale,
    isMobile,
    baseWidth,
    baseHeight,
    height: Math.ceil(baseHeight * scale),
  }
}

export default function ReCaptcha({ onChange, onExpired }) {
  const hostRef = useRef(null)
  const mountRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onExpiredRef = useRef(onExpired)
  const [layout, setLayout] = useState(null)

  useEffect(() => {
    onChangeRef.current = onChange
    onExpiredRef.current = onExpired
  })

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const updateLayout = () => {
      const next = computeLayout(host.offsetWidth)
      setLayout((prev) => {
        if (
          prev &&
          prev.size === next.size &&
          prev.scale === next.scale &&
          prev.isMobile === next.isMobile
        ) {
          return prev
        }
        return next
      })
    }

    updateLayout()

    const observer = new ResizeObserver(updateLayout)
    observer.observe(host)
    window.addEventListener('resize', updateLayout)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateLayout)
    }
  }, [])

  useEffect(() => {
    if (!SITE_KEY || !mountRef.current || !layout) return

    const mountPoint = document.createElement('div')
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(mountPoint)

    let cancelled = false

    const renderWidget = () => {
      if (cancelled) return

      widgetIdRef.current = window.grecaptcha.render(mountPoint, {
        sitekey: SITE_KEY,
        size: layout.size,
        callback: (token) => onChangeRef.current?.(token),
        'expired-callback': () => {
          onChangeRef.current?.(null)
          onExpiredRef.current?.()
        },
      })
    }

    loadRecaptchaScript()
      .then(() => {
        if (cancelled) return
        window.grecaptcha.ready(renderWidget)
      })
      .catch((err) => console.error(err))

    return () => {
      cancelled = true
      widgetIdRef.current = null
      if (mountRef.current) mountRef.current.innerHTML = ''
    }
  }, [layout?.size])

  const scale = layout?.scale ?? 1
  const scaleStyle =
    scale < 1
      ? {
          transform: `scale(${scale})`,
          width: `${layout.baseWidth}px`,
          height: `${layout.baseHeight}px`,
        }
      : {
          width: `${layout?.baseWidth ?? 304}px`,
          height: `${layout?.baseHeight ?? 78}px`,
        }

  return (
    <div
      ref={hostRef}
      className={`recaptcha-wrapper${layout?.isMobile ? ' recaptcha-wrapper--mobile' : ' recaptcha-wrapper--desktop'}${layout?.size === 'compact' ? ' recaptcha-wrapper--compact' : ''}`}
      style={{ height: layout ? `${layout.height}px` : '78px' }}
    >
      <div className="recaptcha-inner">
        <div
          ref={mountRef}
          className="recaptcha-mount"
          style={scaleStyle}
        />
      </div>
    </div>
  )
}
