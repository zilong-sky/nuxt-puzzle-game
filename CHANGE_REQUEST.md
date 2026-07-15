# 加载进度条

## 目标
用户从菜单点进游戏后，或者切换到下一张图时，如果图片还在下载/decode/切块，页面看起来卡了。需要一个覆盖在棋盘位置的进度条，让用户明确知道在加载。整个 init() 过程都在 loading 状态里，直到实际能玩。

## 修改

### A. `app/composables/usePuzzleGame.ts` 暴露加载状态

新增 refs：
```ts
const loading = ref(true)      // true 表示 init 还没完成
const loadProgress = ref(0)    // 0 - 100
```
在 return 里加入。

改 `init()` 顺序，按阶段更新进度：

```ts
async function init() {
  loading.value = true
  loadProgress.value = 0

  // 阶段 A：下载图片（用 fetch 读 stream 拿真实字节进度；失败/无 content-length 时降级为虚拟进度）
  let rawW = 1, rawH = 1
  let imgObjectUrl: string | null = null
  let imgSrcForRotate: string = opts.imageUrl

  if (opts.imageUrl && typeof fetch !== 'undefined') {
    try {
      const isDataUrl = opts.imageUrl.startsWith('data:')
      const isBlobUrl = opts.imageUrl.startsWith('blob:')
      if (isDataUrl || isBlobUrl) {
        // 本地已就绪，直接跳到 60%
        loadProgress.value = 60
      } else {
        const resp = await fetch(opts.imageUrl, { mode: 'cors' })
        const total = Number(resp.headers.get('content-length') || 0)
        const reader = resp.body?.getReader()
        if (reader && total > 0) {
          const chunks: Uint8Array[] = []
          let received = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) {
              chunks.push(value)
              received += value.length
              // 下载占 0 - 60
              loadProgress.value = Math.min(60, Math.round((received / total) * 60))
            }
          }
          const blob = new Blob(chunks)
          imgObjectUrl = URL.createObjectURL(blob)
          imgSrcForRotate = imgObjectUrl
        } else {
          // 无 stream 或无 content-length：把响应转 blob，用虚拟进度
          loadProgress.value = 30
          const blob = await resp.blob()
          imgObjectUrl = URL.createObjectURL(blob)
          imgSrcForRotate = imgObjectUrl
          loadProgress.value = 60
        }
      }
    } catch {
      // fetch 失败：降级，让 Image() 自己去加载
      imgSrcForRotate = opts.imageUrl
      loadProgress.value = 30
    }
  }

  // 阶段 B：Image + decode（占 60 → 80）
  if (typeof Image !== 'undefined' && opts.imageUrl) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imgSrcForRotate
      const anyImg = img as unknown as { decode?: () => Promise<void> }
      if (typeof anyImg.decode === 'function') {
        await anyImg.decode.call(img).catch(() => {})
      } else {
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
      }
      loadProgress.value = 80
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        rawW = img.naturalWidth
        rawH = img.naturalHeight
      }
      // 阶段 C：旋转（占 80 → 90）
      const portraitViewport = typeof window !== 'undefined' ? window.innerHeight >= window.innerWidth : true
      const landscapeImage = rawW > rawH
      if (portraitViewport && landscapeImage && typeof document !== 'undefined') {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = rawH
          canvas.height = rawW
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.translate(rawH, 0)
            ctx.rotate(Math.PI / 2)
            ctx.drawImage(img, 0, 0)
            renderImageUrl.value = canvas.toDataURL('image/jpeg', 0.92)
            const tmp = rawW; rawW = rawH; rawH = tmp
          } else {
            renderImageUrl.value = imgObjectUrl || opts.imageUrl
          }
        } catch {
          renderImageUrl.value = imgObjectUrl || opts.imageUrl
        }
      } else {
        renderImageUrl.value = imgObjectUrl || opts.imageUrl
      }
      loadProgress.value = 90
    } catch {
      renderImageUrl.value = imgObjectUrl || opts.imageUrl
    }
  }

  // 阶段 D：pickGrid + generate + shuffle（占 90 → 100）
  boardW.value = rawW
  boardH.value = rawH
  aspect.value = rawW / rawH
  const grid = pickGrid(opts.pieceCount, rawW, rawH)
  cols.value = grid.cols
  rows.value = grid.rows
  const cw = rawW / grid.cols
  const ch = rawH / grid.rows
  const base = generateGridPieces(grid.cols, grid.rows, rawW, rawH)
  let indices = base.map((_, i) => i)
  if (indices.length > 1) {
    let tries = 0
    do {
      indices = shufflePieces(indices)
      tries++
    } while (indices.every((v, i) => v === i) && tries < 5)
  }
  pieces.value = base.map((p, i) => ({
    ...p, w: cw, h: ch,
    slotIndex: indices[i]!,
    groupId: p.id,
    groupAligned: false
  }))
  recomputeGroups()
  timeLeft.value = calcCountdown(base.length)
  running.value = true
  finished.value = false
  failed.value = false
  frozen.value = false
  startTimer()
  loadProgress.value = 100
  loading.value = false
}
```

**注意**：`init()` 被 `watch(() => [imageUrl, pieceCount])` 反复调用，切图时也会走一遍进度。旧的 objectURL 应该在下一次 init 前 revoke —— 用一个模块级 `let lastObjectUrl: string | null = null`，每次开始时若有则 `URL.revokeObjectURL(lastObjectUrl)`，然后赋新的。

### B. `app/components/PuzzleGame.vue` 展示进度覆盖层

1. 从 `usePuzzleGame` 解构 `loading, loadProgress`：
   ```ts
   const {
     cols, rows, aspect, renderImageUrl,
     pieces, timeLeft, running, finished, failed, frozen,
     placedCount,
     loading, loadProgress,
     init, moveGroup, moveGroupToSlot, useRestore, useFreeze, reviveByAd
   } = usePuzzleGame({...})
   ```

2. 在 `.board-holder` 内加覆盖层：
   ```html
   <div class="board-holder">
     <PuzzleBoard ... />
     <div v-if="loading" class="loading-overlay">
       <div class="loading-card">
         <div class="loading-title">正在加载图片…</div>
         <div class="progress-track">
           <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
         </div>
         <div class="progress-num">{{ loadProgress }}%</div>
       </div>
     </div>
   </div>
   ```

3. 样式：
   ```css
   .board-holder { position: relative; }
   .loading-overlay {
     position: absolute; inset: 0;
     display: flex; align-items: center; justify-content: center;
     background: rgba(255,255,255,0.85);
     backdrop-filter: blur(2px);
     z-index: 20;
     border-radius: var(--radius-md);
   }
   .loading-card {
     display: flex; flex-direction: column; gap: 10px;
     align-items: center; min-width: 200px; padding: 20px 24px;
     background: #fff; border-radius: 12px; box-shadow: var(--shadow-sm);
   }
   .loading-title { font-size: 14px; color: var(--color-text); font-weight: 600; }
   .progress-track {
     width: 180px; height: 8px; border-radius: 999px;
     background: #e5e7eb; overflow: hidden;
   }
   .progress-fill {
     height: 100%; background: #d4af37;
     transition: width 0.15s linear;
   }
   .progress-num { font-size: 12px; color: var(--color-text-soft); }
   ```

4. **让 HUD 计时器不要在 loading 时倒数**：其实 `running` 在 `init` 快结束才被置 true，`startTimer` 也在最后，所以 loading 期间没问题；确认无需额外处理。

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(loading): board-level progress overlay while init"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
