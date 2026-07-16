import { sql } from '@vercel/postgres'

export default defineEventHandler(async () => {
  const { rows } = await sql`
    SELECT player_name, score, level_reached, created_at
    FROM scores
    ORDER BY score DESC, created_at DESC
    LIMIT 50
  `
  return rows.map((r: any, i: number) => ({
    rank: i + 1,
    name: r.player_name,
    score: Number(r.score),
    level_reached: Number(r.level_reached ?? 0),
    created_at: Number(r.created_at)
  }))
})
