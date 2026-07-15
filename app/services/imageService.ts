/**
 * app/services/imageService.ts
 * 图片相关远程接口占位。
 * 后续对接后端修改此处：将 mock 数据替换为真实 API 请求即可。
 */

export interface PuzzleImage {
  id: number
  url: string
  title?: string
  /** 上传者 - 仅云冒险模式使用 */
  uploader?: string
  /** 上传时间戳 - 云冒险按此升序播放 */
  uploadedAt?: number
}

/** 内置 SVG 数据 URI，作为演示图。真实环境应由后端返回 CDN 图片 URL。 */
function demoSvg(hue: number, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='hsl(${hue},70%,60%)'/>
        <stop offset='1' stop-color='hsl(${(hue + 60) % 360},70%,40%)'/>
      </linearGradient>
    </defs>
    <rect width='400' height='400' fill='url(#g)'/>
    <circle cx='120' cy='140' r='60' fill='rgba(255,255,255,0.4)'/>
    <circle cx='280' cy='260' r='80' fill='rgba(255,255,255,0.3)'/>
    <text x='200' y='210' text-anchor='middle' font-family='sans-serif' font-size='42' fill='white'>${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * 获取休闲模式的图库列表。
 * 后续对接后端修改此处：改为 fetch(`${apiBase}/api/images/casual`)。
 */
export async function fetchCasualImages(): Promise<PuzzleImage[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const list: PuzzleImage[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        url: demoSvg(i * 30, `休闲 #${i + 1}`),
        title: `休闲图片 ${i + 1}`
      }))
      resolve(list)
    }, 50)
  })
}

/**
 * 获取云冒险模式图库（其他玩家自拍上传的公开图片，按上传时间升序）。
 * 后续对接后端修改此处：改为 fetch(`${apiBase}/api/images/cloud`)。
 */
export async function fetchCloudImages(): Promise<PuzzleImage[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = Date.now()
      const list: PuzzleImage[] = Array.from({ length: 20 }, (_, i) => ({
        id: 1000 + i,
        url: demoSvg((i + 3) * 22, `云#${i + 1}`),
        title: `玩家上传 ${i + 1}`,
        uploader: `player_${i + 1}`,
        uploadedAt: now - (20 - i) * 3600_000
      }))
      resolve(list)
    }, 50)
  })
}

/**
 * 用户自拍/相册图片上传到云图库（占位）。
 * 后续对接后端修改此处：改为 POST FormData 到 `${apiBase}/api/images/upload`。
 */
export async function uploadImage(_file: Blob | File): Promise<{ success: boolean; url?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // mock：假装上传成功
      resolve({ success: true, url: '' })
    }, 400)
  })
}
