import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)
const MAX_BYTES = 3 * 1024 * 1024

function todayCST(): string {
  const now = new Date()
  const cst = new Date(now.getTime() + (8 * 60 - now.getTimezoneOffset()) * 60000)
  return cst.toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'No form data' })

  let file: { data: Buffer; type?: string; filename?: string } | null = null
  let uploader = 'anonymous'
  let fingerprint = ''
  let width = 0
  let height = 0

  for (const p of form) {
    if (p.name === 'file' && p.data) {
      file = { data: p.data, type: p.type, filename: p.filename }
    } else if (p.name === 'uploader') {
      uploader = p.data.toString('utf8').trim() || 'anonymous'
    } else if (p.name === 'fingerprint') {
      fingerprint = p.data.toString('utf8').trim()
    } else if (p.name === 'width') {
      width = parseInt(p.data.toString('utf8'), 10) || 0
    } else if (p.name === 'height') {
      height = parseInt(p.data.toString('utf8'), 10) || 0
    }
  }

  if (!file || !file.data?.length) {
    return { success: false, error: '缺少文件' }
  }
  if (!fingerprint) {
    return { success: false, error: '缺少指纹标识' }
  }
  if (file.data.length > MAX_BYTES) {
    setResponseStatus(event, 413)
    return { success: false, error: '文件大于 3MB' }
  }

  const day = todayCST()
  const q = await sql`SELECT count FROM upload_quota WHERE fingerprint=${fingerprint} AND day=${day}`
  const used = q.rows[0]?.count ?? 0
  if (used >= 3) {
    setResponseStatus(event, 429)
    return { success: false, error: '今日额度已用完（3/3），明天再来' }
  }

  const key = `selfie/${Date.now()}-${nanoid()}.jpg`
  const blob = await put(key, file.data, {
    access: 'public',
    contentType: 'image/jpeg'
  })

  const now = Date.now()
  const insert = await sql`
    INSERT INTO cloud_images (url, blob_pathname, uploader, fingerprint, uploaded_at, status, width, height)
    VALUES (${blob.url}, ${key}, ${uploader}, ${fingerprint}, ${now}, 'pending', ${width}, ${height})
    RETURNING id
  `
  const id = insert.rows[0].id as number

  await sql`
    INSERT INTO upload_quota (fingerprint, day, count)
    VALUES (${fingerprint}, ${day}, 1)
    ON CONFLICT (fingerprint, day) DO UPDATE SET count = upload_quota.count + 1
  `

  return { success: true, id, message: '已提交，审核通过后会出现在云冒险' }
})
