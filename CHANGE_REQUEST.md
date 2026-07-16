# 自拍上传真实化 + 云冒险图库 + 排行榜接入

## 一、目标

用 Vercel Blob 存图片，Vercel Postgres 存元数据 + 排行榜，实现：
1. 自拍模式真实上传（含压缩、真实进度、指纹限流、审核制）
2. 云冒险按已审核图片 seq 顺序玩
3. 排行榜真实读写
4. 玩家昵称首次输入

## 二、前置

Vercel Blob 和 Postgres 已在项目中开通并关联，环境变量已注入。安装依赖：
```
npm i @vercel/blob @vercel/postgres @fingerprintjs/fingerprintjs
```

## 三、数据库表结构（写入项目 SETUP.md，让用户在 Vercel Query 面板执行）

```sql
CREATE TABLE IF NOT EXISTS cloud_images (
  id SERIAL PRIMARY KEY,
  seq INT UNIQUE,                                  -- 审核通过后分配，从 1 递增
  code TEXT UNIQUE,                                -- 'CLOUD-0001' 形式，seq 通过后生成
  url TEXT NOT NULL,                               -- Blob 公开 URL
  blob_pathname TEXT NOT NULL,                     -- Blob 内部路径（删除用）
  uploader TEXT DEFAULT 'anonymous',
  fingerprint TEXT NOT NULL,                       -- 浏览器指纹
  uploaded_at BIGINT NOT NULL,                     -- ms
  reviewed_at BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  width INT,
  height INT
);
CREATE INDEX IF NOT EXISTS idx_cloud_status ON cloud_images (status);
CREATE INDEX IF NOT EXISTS idx_cloud_seq ON cloud_images (seq) WHERE status='approved';

CREATE TABLE IF NOT EXISTS upload_quota (
  fingerprint TEXT NOT NULL,
  day TEXT NOT NULL,                               -- 'YYYY-MM-DD' UTC+8
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (fingerprint, day)
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  fingerprint TEXT,
  score INT NOT NULL,
  level_reached INT DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_desc ON scores (score DESC, created_at DESC);
```

## 四、Server API（新增）

### server/api/images/upload.post.ts
- 读 multipart：`file`(Blob), `uploader`(string), `fingerprint`(string), `width`(int), `height`(int)
- 校验：file 存在 且 <= 3MB（前端已压缩），fingerprint 必填
- 限流：查 `upload_quota WHERE fingerprint=$fp AND day=$today(UTC+8)`；若 >=3 返回 429 `{error:'今日额度已用完（3/3），明天再来'}`
- 上传 Blob：key `selfie/${Date.now()}-${nanoid(6)}.jpg`，`access:'public'`，`contentType:'image/jpeg'`
- 插入 cloud_images（status='pending'），同事务 upsert upload_quota +1
- 返回 `{success:true, id, message:'已提交，审核通过后会出现在云冒险'}`

### server/api/images/cloud.get.ts
- 查 `SELECT id, seq, code, url, uploader, uploaded_at FROM cloud_images WHERE status='approved' ORDER BY seq ASC`
- 返回 PuzzleImage[]，`title=code`

### server/api/rank/submit.post.ts
- body: `{player_name, fingerprint, score, level_reached}`
- 校验 score 是数字，插入 scores 表

### server/api/rank/list.get.ts
- 查前 50 名 `SELECT * FROM scores ORDER BY score DESC, created_at DESC LIMIT 50`
- 返回 RankItem[]，rank 用 index+1

## 五、前端改动

### app/services/imageService.ts（整体重写为真实接口）
```typescript
export interface PuzzleImage {
  id: number
  url: string
  title?: string
  code?: string           // 新增
  uploader?: string
  uploadedAt?: number
}

export async function fetchCasualImages(): Promise<PuzzleImage[]> {
  // 保持不变：picsum seeds 30 张
}

export async function fetchCloudImages(): Promise<PuzzleImage[]> {
  return await $fetch<PuzzleImage[]>('/api/images/cloud')
}

// 用 XHR 拿真实上传进度
export function uploadImage(
  file: Blob,
  meta: { uploader: string; fingerprint: string; width: number; height: number },
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve, reject) => {
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
        const data = JSON.parse(xhr.responseText)
        if (xhr.status === 200) resolve(data)
        else resolve({ success: false, error: data.error || `HTTP ${xhr.status}` })
      } catch { resolve({ success: false, error: '响应解析失败' }) }
    }
    xhr.onerror = () => resolve({ success: false, error: '网络错误' })
    xhr.send(fd)
  })
}
```

### app/services/rankService.ts（接真实 API）
```typescript
export async function fetchCloudRank(): Promise<RankItem[]> {
  return await $fetch<RankItem[]>('/api/rank/list')
}
export async function submitScore(payload: {
  player_name: string; fingerprint: string; score: number; level_reached?: number
}) {
  return await $fetch('/api/rank/submit', { method: 'POST', body: payload })
}
```

### app/utils/imageCompress.ts（新增）
```typescript
export async function compressImage(blob: Blob, maxSide=1200, quality=0.85): Promise<{blob:Blob, width:number, height:number}> {
  const img = await createImageBitmap(blob)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const out = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', quality))
  return { blob: out, width: w, height: h }
}
```

### app/composables/useFingerprint.ts（新增）
```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs'
let cached: string | null = null
export async function getFingerprint(): Promise<string> {
  if (cached) return cached
  const fp = await FingerprintJS.load()
  const res = await fp.get()
  cached = res.visitorId
  return cached
}
```

### app/stores/gameStore.ts
- 新增 `playerName: string` 状态，默认 `''`
- STORAGE_KEYS 新增 `PLAYER_NAME: 'puzzle:player-name'`
- hydrate 读取；actions 新增 `setPlayerName(name)` 持久化
- **保留** 现有 items/adventureIdx 等所有字段

### app/components/PlayerNameModal.vue（新增）
- 简易弹窗，输入昵称（2-12 字符），存 gameStore.playerName
- 在 default layout 里 mounted 后检查：if (!playerName) 显示弹窗

### app/pages/play/selfie.vue（改 doUpload）
```typescript
async function doUpload() {
  askUpload.value = false
  uploading.value = true
  uploadProgress.value = 0

  try {
    // 拿原 blob（从 canvas.toBlob 或 currentBlob）
    const rawBlob = currentBlob.value  // 已有
    const { blob: compressed, width, height } = await compressImage(rawBlob)
    const fingerprint = await getFingerprint()
    const uploader = game.playerName || 'anonymous'

    const result = await uploadImage(compressed,
      { uploader, fingerprint, width, height },
      (pct) => { uploadProgress.value = pct }
    )
    uploading.value = false
    if (result.success) {
      alert(result.message || '✅ 已提交，审核通过后会出现在云冒险')
    } else {
      alert('❌ ' + (result.error || '上传失败'))
    }
  } catch (e) {
    uploading.value = false
    alert('❌ 上传异常：' + (e as Error).message)
  }
  onNext()
}
```
**保留**假进度条 UI，只是数字来自真实 XHR onprogress。

### app/pages/play/cloud.vue（改用真实云图库）
- import `fetchCloudImages`（不是 fetchCasual）
- onMounted：`list.value = await fetchCloudImages()`
- 若 `list.value.length === 0`：显示空态提示"云冒险图库暂无内容，快去📸自拍模式上传第一张吧"+ 按钮跳 `/play/selfie`
- `idx.value = Math.min(game.adventureIdx, list.value.length - 1)`
- 图片顺序天然按 seq ASC（服务端已排序），不 shuffle
- **提交分数**：游戏结束时（成功或失败）调 `submitScore({player_name: game.playerName, fingerprint, score, level_reached: idx+1})`

### app/pages/rank.vue
- 若目前是 mock，改用 `fetchCloudRank()`

## 六、SETUP.md（新增到项目根）

写清楚：
1. 环境变量列表（Vercel 自动注入的哪些必须存在）
2. 数据库建表 SQL（原样贴上面 CREATE TABLE 三段）
3. 本地开发：`vercel link && vercel env pull .env.local && npm run dev`

## 七、验收

1. `npm run build` 通过
2. 类型无错
3. 提交 message：`feat(upload): real blob upload with compress+fingerprint+quota; feat(cloud): seq-ordered gallery; feat(rank): real postgres backend; feat(player): nickname prompt`
4. push origin master（失败重试一次）
5. 全过程自主完成，遇疑难项做保守选择（如指纹库加载失败用随机 uuid 兜底）。
