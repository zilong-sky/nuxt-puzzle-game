import { sql } from '@vercel/postgres'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    player_name?: string
    fingerprint?: string
    score?: number
    level_reached?: number
  }>(event)
  const name = (body?.player_name || '').trim().slice(0, 32) || 'anonymous'
  const fp = (body?.fingerprint || '').trim() || null
  const score = Number(body?.score)
  const level = Number(body?.level_reached || 0)
  if (!Number.isFinite(score)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'score must be a number' }
  }
  await sql`
    INSERT INTO scores (player_name, fingerprint, score, level_reached, created_at)
    VALUES (${name}, ${fp}, ${Math.round(score)}, ${Math.round(level)}, ${Date.now()})
  `
  return { ok: true }
})
