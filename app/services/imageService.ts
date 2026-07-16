/**
 * app/services/imageService.ts
 * 鍥剧墖鐩稿叧鎺ュ彛锛?浼戦棽妯″紡浣跨敤 picsum seeds 30 寮狅紝浜戝啋闄╂ā寮忚皟鐢?/api/images/cloud 鐪熷疄鏁版嵁銆? */

export interface PuzzleImage {
  id: number
  url: string
  title?: string
  code?: string
  uploader?: string
  uploadedAt?: number
}

/** 浼戦棽妯″紡锛歱icsum seeds 30 寮狅紙淇濇寔涓嶅彉锛?*/
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

/** 浜戝啋闄╂ā寮忓浘搴擄細璇诲彇宸插鏍稿浘鐗囷紝鎸?seq ASC 椤哄簭銆?*/
export async function fetchCloudImages(): Promise<PuzzleImage[]> {
  return await $fetch<PuzzleImage[]>('/api/images/cloud')
}

/** 鐢?XHR 涓婁紶浠ヨ幏鍙栫湡瀹炶繘搴︺€?*/
export function uploadImage(
  file: Blob,
  meta: { uploader: string; fingerprint: string; width: number; height: number },
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; id?: number; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const fd = new FormData()
    fd.append('file', file, 'selfie.jpg')
    fd.append('uploader', meta.uploader)
    fd.append('fingerprint', meta.fingerprint)
    fd.append('width', String(meta.width))
    fd.append('height', String(meta.height))
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
          resolve({ success: true, id: data.id, message: data.message })
        } else {
          resolve({ success: false, error: data.error || `HTTP ${xhr.status}` })
        }
      } catch {
        resolve({ success: false, error: '鍝嶅簲瑙ｆ瀽澶辫触' })
      }
    }
    xhr.onerror = () => resolve({ success: false, error: '缃戠粶閿欒' })
    xhr.send(fd)
  })
}
