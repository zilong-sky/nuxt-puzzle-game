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
  const s = Math.round(score)
  const lv = Math.round(level)
  const now = Date.now()

  if (fp) {
    // 一个指纹只保留最高分：低于历史最高不更新，等于/高于则更新
    await sql`
      INSERT INTO scores (player_name, fingerprint, score, level_reached, created_at)
      VALUES (${name}, ${fp}, ${s}, ${lv}, ${now})
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        player_name   = EXCLUDED.player_name,
        score         = GREATEST(scores.score, EXCLUDED.score),
        level_reached = CASE WHEN EXCLUDED.score >= scores.score THEN EXCLUDED.level_reached ELSE scores.level_reached END,
        created_at    = CASE WHEN EXCLUDED.score >  scores.score THEN EXCLUDED.created_at    ELSE scores.created_at    END
    `
  } else {
    await sql`
      INSERT INTO scores (player_name, fingerprint, score, level_reached, created_at)
      VALUES (${name}, ${fp}, ${s}, ${lv}, ${now})
    `
  }
  return { ok: true }
})
