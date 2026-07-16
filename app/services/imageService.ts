/**
 * app/services/imageService.ts
 * 图片相关接口：休闲模式使用 picsum seeds 30 张，云冒险模式调用 /api/images/cloud 真实数据。
 */

export interface PuzzleImage {
  id: number
  url: string
  title?: string
  code?: string
  uploader?: string
  uploadedAt?: number
  pieceCount?: number | null
}

/** 休闲模式：picsum seeds 30 张（保持不变） */
export async function fetchCasualImages(): Promise<PuzzleImage[]> {
  const seeds = [
    'aurora','forest','ocean','desert','mountain','sunset','city','river','lake','field',
    'canyon','meadow','glacier','harbor','vineyard','island','sakura','coast','valley','waterfall',
    'lagoon','savanna','fjord','plateau','oasis','tundra','marsh','dune','reef','summit'
  ]
  return seeds.map((seed, i) => ({
    id: i + 1,
    url: `https://picsum.photos/seed/${seed}/800/600`,
    title: seed
  }))
}

/** 云冒险模式图库：读取已审核图片，按 seq ASC 顺序。 */
export async function fetchCloudImages(): Promise<PuzzleImage[]> {
  return await $fetch<PuzzleImage[]>('/api/images/cloud')
}

/** 用 XHR 上传以获取真实进度。 */
export function uploadImage(
  file: Blob,
  meta: { uploader: string; fingerprint: string; width: number; height: number; pieceCount: number },
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; id?: number; message?: string; error?: string; used?: number; limit?: number }> {
  return new Promise((resolve) => {
    const fd = new FormData()
    fd.append('file', file, 'selfie.jpg')
    fd.append('uploader', meta.uploader)
    fd.append('fingerprint', meta.fingerprint)
    fd.append('width', String(meta.width))
    fd.append('height', String(meta.height))
    fd.append('pieceCount', String(meta.pieceCount))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/images/upload')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve({ success: true, id: data.id, message: data.message, used: data.used, limit: data.limit })
        } else {
          resolve({ success: false, error: data.error || `HTTP ${xhr.status}`, used: data.used, limit: data.limit })
        }
      } catch {
        resolve({ success: false, error: '响应解析失败' })
      }
    }
    xhr.onerror = () => resolve({ success: false, error: '网络错误' })
    xhr.send(fd)
  })
}
