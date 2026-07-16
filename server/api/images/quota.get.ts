import { sql } from '@vercel/postgres'

const LIFETIME_LIMIT = 3

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const fingerprint = String(q.fingerprint || '').trim()
  if (!fingerprint) return { used: 0, limit: LIFETIME_LIMIT, remaining: LIFETIME_LIMIT }
  try {
    const r = await sql`SELECT COUNT(*)::int AS c FROM cloud_images WHERE fingerprint=${fingerprint}`
    const used = r.rows[0]?.c ?? 0
    return { used, limit: LIFETIME_LIMIT, remaining: Math.max(0, LIFETIME_LIMIT - used) }
  } catch {
    return { used: 0, limit: LIFETIME_LIMIT, remaining: LIFETIME_LIMIT }
  }
})
