// src/services/liquidityCacheService.js
const DEFAULT_GATEWAY = 'https://whostler.com'
const API_BASE = (import.meta.env.VITE_API_GATEWAY_URL || DEFAULT_GATEWAY).replace(/\/+$/, '')
const API_KEY = import.meta.env.VITE_API_KEY
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT || 10000)
const RETRIES = Math.max(0, Number(import.meta.env.VITE_API_RETRY_COUNT || 0))

function buildHeaders() {
  const headers = { 'Accept': 'application/json' }
  if (API_KEY) headers['x-api-key'] = API_KEY
  return headers
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

async function retryFetch(url, opts = {}) {
  let lastErr
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await fetchWithTimeout(url, opts)
      return res
    } catch (e) {
      lastErr = e
      // small backoff
      await new Promise(r => setTimeout(r, 200 * (i + 1)))
    }
  }
  throw lastErr
}

export async function fetchCachedLiquidity() {
  const url = `${API_BASE}/api/liquidity`
  try {
    const res = await retryFetch(url, { cache: 'no-store', headers: buildHeaders() })
    if (res.status === 202) {
      const json = await res.json()
      return json
    }
    if (!res.ok) {
      // Para 4xx/5xx consideramos indisponível e retornamos null
      return null
    }
    return await res.json()
  } catch (e) {
    console.warn('[LiquidityCache] Falha ao buscar cache:', e && e.message ? e.message : e)
    return null
  }
}

export async function fetchHealth() {
  const url = `${API_BASE}/api/health`
  try {
    const res = await retryFetch(url, { cache: 'no-store', headers: buildHeaders() })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.warn('[LiquidityCache] Falha ao buscar health:', e && e.message ? e.message : e)
    return null
  }
}
