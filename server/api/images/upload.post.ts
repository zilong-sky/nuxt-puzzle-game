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
  try {
    const form = await readMultipartFormData(event)
    if (!form) return { success: false, error: '未收到表单数据' }

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
      return { success: false, error: `文件大于 3MB（当前 ${(file.data.length / 1024 / 1024).toFixed(2)}MB）` }
    }

    // 环境变量检查
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { success: false, error: '服务端未配置 BLOB_READ_WRITE_TOKEN，请联系管理员在 Vercel 关联 Blob store' }
    }
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      return { success: false, error: '服务端未配置 Postgres 连接' }
    }

    const day = todayCST()

    // 配额检查
    let used = 0
    try {
      const q = await sql`SELECT count FROM upload_quota WHERE fingerprint=${fingerprint} AND day=${day}`
      used = q.rows[0]?.count ?? 0
    } catch (e: any) {
      return { success: false, error: `数据库查询失败：${e?.message || e}。请确认 upload_quota 表已建。` }
    }
    if (used >= 3) {
      setResponseStatus(event, 429)
      return { success: false, error: '今日额度已用完（3/3），明天再来' }
    }

    // 上传 Blob
    const key = `selfie/${Date.now()}-${nanoid()}.jpg`
    let blob: { url: string }
    try {
      blob = await put(key, file.data, {
        access: 'public',
        contentType: 'image/jpeg'
      })
    } catch (e: any) {
      return { success: false, error: `Blob 上传失败：${e?.message || e}` }
    }

    // 写数据库
    const now = Date.now()
    let id: number
    try {
      const insert = await sql`
        INSERT INTO cloud_images (url, blob_pathname, uploader, fingerprint, uploaded_at, status, width, height)
        VALUES (${blob.url}, ${key}, ${uploader}, ${fingerprint}, ${now}, 'pending', ${width}, ${height})
        RETURNING id
      `
      id = insert.rows[0].id as number
    } catch (e: any) {
      return { success: false, error: `写入 cloud_images 失败：${e?.message || e}。请确认表已建。` }
    }

    // 更新配额
    try {
      await sql`
        INSERT INTO upload_quota (fingerprint, day, count)
        VALUES (${fingerprint}, ${day}, 1)
        ON CONFLICT (fingerprint, day) DO UPDATE SET count = upload_quota.count + 1
      `
    } catch (e: any) {
      // 配额写失败不影响上传成功，但要打日志
      console.error('[upload] quota update failed:', e)
    }

    return { success: true, id, message: '已提交，审核通过后会出现在云冒险' }
  } catch (e: any) {
    console.error('[upload] fatal:', e)
    setResponseStatus(event, 500)
    return { success: false, error: `服务器异常：${e?.message || String(e)}` }
  }
})
