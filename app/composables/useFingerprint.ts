import FingerprintJS from '@fingerprintjs/fingerprintjs'

let cached: string | null = null

export async function getFingerprint(): Promise<string> {
  if (cached) return cached
  try {
    const fp = await FingerprintJS.load()
    const res = await fp.get()
    cached = res.visitorId
  } catch {
    // Fallback: random UUID stored in localStorage
    const key = 'puzzle:fp-fallback'
    let v = ''
    try { v = localStorage.getItem(key) || '' } catch {}
    if (!v) {
      v = 'fp_' + (crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
      try { localStorage.setItem(key, v) } catch {}
    }
    cached = v
  }
  return cached!
}
