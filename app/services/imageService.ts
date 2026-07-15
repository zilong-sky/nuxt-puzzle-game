/**
 * app/services/imageService.ts
 * 鍥剧墖鐩稿叧杩滅▼鎺ュ彛鍗犱綅銆? * 鍚庣画瀵规帴鍚庣淇敼姝ゅ锛氬皢 mock 鏁版嵁鏇挎崲涓虹湡瀹?API 璇锋眰鍗冲彲銆? */

export interface PuzzleImage {
  id: number
  url: string
  title?: string
  /** 涓婁紶鑰?- 浠呬簯鍐掗櫓妯″紡浣跨敤 */
  uploader?: string
  /** 涓婁紶鏃堕棿鎴?- 浜戝啋闄╂寜姝ゅ崌搴忔挱鏀?*/
  uploadedAt?: number
}

/** 鍐呯疆 SVG 鏁版嵁 URI锛屼綔涓烘紨绀哄浘銆傜湡瀹炵幆澧冨簲鐢卞悗绔繑鍥?CDN 鍥剧墖 URL銆?*/
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
 * 鑾峰彇浼戦棽妯″紡鐨勫浘搴撳垪琛ㄣ€? * 鍚庣画瀵规帴鍚庣淇敼姝ゅ锛氭敼涓?fetch(`${apiBase}/api/images/casual`)銆? */
export async function fetchCasualImages(): Promise<PuzzleImage[]> {
  const seeds = [
    'aurora','forest','ocean','desert','mountain','sunset','city','river','lake','field',
    'canyon','meadow','glacier','harbor','vineyard','island','sakura','coast','valley','waterfall',
    'lagoon','savanna','fjord','plateau','oasis','tundra','marsh','dune','reef','summit'
  ]
  const list: PuzzleImage[] = seeds.map((seed, i) => ({
    id: i + 1,
    url: `https://picsum.photos/seed/${seed}/800/600`,
    title: seed
  }))
  return list
}

/**
 * 鑾峰彇浜戝啋闄╂ā寮忓浘搴擄紙鍏朵粬鐜╁鑷媿涓婁紶鐨勫叕寮€鍥剧墖锛屾寜涓婁紶鏃堕棿鍗囧簭锛夈€? * 鍚庣画瀵规帴鍚庣淇敼姝ゅ锛氭敼涓?fetch(`${apiBase}/api/images/cloud`)銆? */
export async function fetchCloudImages(): Promise<PuzzleImage[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = Date.now()
      const list: PuzzleImage[] = Array.from({ length: 20 }, (_, i) => ({
        id: 1000 + i,
        url: demoSvg((i + 3) * 22, `浜?${i + 1}`),
        title: `鐜╁涓婁紶 ${i + 1}`,
        uploader: `player_${i + 1}`,
        uploadedAt: now - (20 - i) * 3600_000
      }))
      resolve(list)
    }, 50)
  })
}

/**
 * 鐢ㄦ埛鑷媿/鐩稿唽鍥剧墖涓婁紶鍒颁簯鍥惧簱锛堝崰浣嶏級銆? * 鍚庣画瀵规帴鍚庣淇敼姝ゅ锛氭敼涓?POST FormData 鍒?`${apiBase}/api/images/upload`銆? */
export async function uploadImage(_file: Blob | File): Promise<{ success: boolean; url?: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // mock锛氬亣瑁呬笂浼犳垚鍔?      resolve({ success: true, url: '' })
    }, 400)
  })
}
