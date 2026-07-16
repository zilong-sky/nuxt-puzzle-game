import { sql } from '@vercel/postgres'

export default defineEventHandler(async () => {
  const { rows } = await sql`
    SELECT id, seq, code, url, uploader, uploaded_at
    FROM cloud_images
    WHERE status='approved'
    ORDER BY seq ASC
  `
  return rows.map((r: any) => ({
    id: r.id,
    url: r.url,
    title: r.code,
    code: r.code,
    uploader: r.uploader,
    uploadedAt: Number(r.uploaded_at)
  }))
})
