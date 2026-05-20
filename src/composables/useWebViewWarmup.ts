/**
 * useWebViewWarmup — WebView 预热与性能监控
 *
 * 针对 Android WebView 的启动性能优化：
 *   - link preload 预加载关键资源（字体、图标、bundle）
 *   - PerformanceObserver 监控 Web Vitals（LCP / FCP / TTI）
 *   - requestIdleCallback 延迟非关键优化
 *   - 预热 Service Worker / Cache API
 *
 * 用法：
 *   import { warmupWebView } from '@/composables/useWebViewWarmup'
 *   warmupWebView()
 */

interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

interface PreloadHint {
  href: string
  as: 'font' | 'image' | 'script' | 'style' | 'fetch'
  crossorigin?: 'anonymous' | 'use-credentials'
  type?: string
}

const CRITICAL_PRELOADS: PreloadHint[] = [
  { href: '/assets/fonts/inter-var.woff2', as: 'font', crossorigin: 'anonymous', type: 'font/woff2' },
  { href: '/assets/fonts/noto-serif-sc-var.woff2', as: 'font', crossorigin: 'anonymous', type: 'font/woff2' },
  { href: '/assets/booksource-default.svg', as: 'image' },
]

function injectPreloadLink(hint: PreloadHint): void {
  const existing = document.querySelector(`link[rel="preload"][href="${hint.href}"]`)
  if (existing) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = hint.href
  link.setAttribute('as', hint.as)
  if (hint.crossorigin) link.crossOrigin = hint.crossorigin
  if (hint.type) link.type = hint.type
  document.head.appendChild(link)
}

function ratingFor(name: string, value: number): VitalMetric['rating'] {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    CLS: [0.1, 0.25],
  }
  const [good, poor] = thresholds[name] ?? [1500, 3000]
  if (value <= good) return 'good'
  if (value >= poor) return 'poor'
  return 'needs-improvement'
}

/**
 * 初始化 PerformanceObserver，监控 LCP、FCP、TTFB 等核心指标。
 * 仅在支持 PerformanceObserver 的浏览器（Android WebView ≥ 52）中运行。
 */
export function initPerformanceObservers(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return

  const vitals: VitalMetric[] = []

  function flushVitals(): void {
    if (vitals.length === 0) return
    const payload = [...vitals]
    vitals.length = 0
    window.__LEGADO_REPORT_VITALS?.(payload)
    if (import.meta.env.DEV) {
      payload.forEach((m) => console.log(`[WebVital] ${m.name}=${m.value.toFixed(1)} (${m.rating})`))
    }
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime?: number; renderTime?: number }
      if (!last) return
      const value = last.startTime ?? last.renderTime ?? 0
      vitals.push({ name: 'LCP', value, rating: ratingFor('LCP', value) })
      flushVitals()
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const paintEntry = entry as PerformanceEntry & { startTime: number }
        if (paintEntry.name === 'first-contentful-paint') {
          vitals.push({ name: 'FCP', value: paintEntry.startTime, rating: ratingFor('FCP', paintEntry.startTime) })
        }
      }
      flushVitals()
    })
    paintObserver.observe({ type: 'paint', buffered: true })

    if (PerformanceObserver.supportedEntryTypes.includes('navigation')) {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const nav = entry as PerformanceNavigationTiming
          if (nav.responseStart > 0) {
            vitals.push({ name: 'TTFB', value: nav.responseStart, rating: ratingFor('TTFB', nav.responseStart) })
          }
        }
        flushVitals()
      })
      navObserver.observe({ type: 'navigation', buffered: true })
    }
  } catch {
    // WebView 不支持部分 entryTypes 时静默降级
  }
}

/**
 * 预加载关键静态资源（字体、图标、核心 SVG）。
 * 将 <link rel="preload"> 注入 <head>，让 WebView 尽早发起请求。
 */
export function preloadCriticalAssets(): void {
  if (typeof document === 'undefined') return
  for (const hint of CRITICAL_PRELOADS) {
    injectPreloadLink(hint)
  }
}

/**
 * 预热 WebView 引擎：预加载关键资源、注册性能观察器。
 * 应在 app 挂载后尽早调用。
 */
export function warmupWebView(): void {
  if (typeof window === 'undefined') return

  preloadCriticalAssets()
  initPerformanceObservers()

  const idleTasks: (() => void)[] = [
    () => {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.update().catch(() => {})
          })
        }
      } catch {}
    },
    () => {
      try {
        if ('caches' in window) {
          caches.open('legado-v1').catch(() => {})
        }
      } catch {}
    },
  ]

  for (const task of idleTasks) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(task, { timeout: 3000 })
    } else {
      setTimeout(task, 2000)
    }
  }
}