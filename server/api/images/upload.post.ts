import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)
const MAX_BYTES = 3 * 1024 * 1024
const LIFETIME_LIMIT = 3

export default defineEventHandler(async (event) => {
  try {
    const form = await readMultipartFormData(event)
    if (!form) return { success: false, error: '未收到表单数据' }

    let file: { data: Buffer; type?: string; filename?: string } | null = null
    let uploader = 'anonymous'
    let fingerprint = ''
    let width = 0
    let height = 0
    let pieceCount = 0

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
      } else if (p.name === 'pieceCount') {
        pieceCount = parseInt(p.data.toString('utf8'), 10) || 0
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
      return { success: false, error: `文件大于 3MB（当前 ${(file.data.length / 1024 / 1024).toFixed(2)}MB）` }
    }
    if (pieceCount < 4 || pieceCount > 500) {
      return { success: false, error: '难度参数非法（4-500）' }
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { success: false, error: '服务端未配置 BLOB_READ_WRITE_TOKEN' }
    }
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      return { success: false, error: '服务端未配置 Postgres 连接' }
    }

    // 终身配额（按指纹累计，不再按天）
    let used = 0
    try {
      const q = await sql`SELECT COUNT(*)::int AS c FROM cloud_images WHERE fingerprint=${fingerprint}`
      used = q.rows[0]?.c ?? 0
    } catch (e: any) {
      return { success: false, error: `配额查询失败：${e?.message || e}` }
    }
    if (used >= LIFETIME_LIMIT) {
      setResponseStatus(event, 429)
      return { success: false, error: `你已累计上传 ${used}/${LIFETIME_LIMIT} 张，额度已用完` }
    }

    const key = `selfie/${Date.now()}-${nanoid()}.jpg`
    let blob: { url: string }
    try {
      blob = await put(key, file.data, { access: 'public', contentType: 'image/jpeg' })
    } catch (e: any) {
      return { success: false, error: `Blob 上传失败：${e?.message || e}` }
    }

    const now = Date.now()
    let id: number
    try {
      const insert = await sql`
        INSERT INTO cloud_images (url, blob_pathname, uploader, fingerprint, uploaded_at, status, width, height, piece_count)
        VALUES (${blob.url}, ${key}, ${uploader}, ${fingerprint}, ${now}, 'pending', ${width}, ${height}, ${pieceCount})
        RETURNING id
      `
      id = insert.rows[0].id as number
    } catch (e: any) {
      return { success: false, error: `写入 cloud_images 失败：${e?.message || e}（请确认列 piece_count 已加）` }
    }

    return {
      success: true,
      id,
      message: `已提交审核（已用 ${used + 1}/${LIFETIME_LIMIT}）`,
      used: used + 1,
      limit: LIFETIME_LIMIT
    }
  } catch (e: any) {
    console.error('[upload] fatal:', e)
    setResponseStatus(event, 500)
    return { success: false, error: `服务器异常：${e?.message || String(e)}` }
  }
})
