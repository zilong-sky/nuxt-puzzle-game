# 自拍模式难度上限约束

## 目标
1. 拼图切完总高度不能超出手机可视区，否则用户没法玩（要滑屏幕）。
2. 自动算出"最高安全难度"，实时提示给用户，并且**不允许**用户选超过这个值的难度。

## 约束推导

PuzzleGame 里棋盘 `.puzzle-wrap` 的尺寸公式（当前）：
- 宽约束：`min(100vw - 32, 560)`
- 高约束：`min(100dvh - 240, 900)`
- 内接图片 aspect，取更约束一侧为长边
- 底线：任意格子 ≥ 50×50 CSS 逻辑像素

"最高难度"其实等价于**在满足高度约束下，格数 = cols × rows 的最大值**。给定图片 aspect（旋转后 `a = W/H`）：
- 令 wrapH 上限 = `min(window.innerHeight - 240, 900)`，wrapW 上限 = `min(window.innerWidth - 32, 560)`
- 内接后 wrap 实际尺寸: 若 `wrapW_max / a <= wrapH_max` → `wrapW=wrapW_max, wrapH=wrapW_max/a`；否则 `wrapH=wrapH_max, wrapW=wrapH_max*a`
- 每格必须 ≥ 50px 逻辑像素，所以 `cols ≤ wrapW/50`，`rows ≤ wrapH/50`
- pickGrid 会按 aspect 选接近正方形的格子，所以最大格数近似 `floor(wrapW/50) * floor(wrapH/50)`

⚠️ 注意 pickGrid 的搜索范围是 target ∈ [0.75×N, 1.3×N]，实际选出的总数会略偏离 N。为了保守，把上限再打 0.85 折。

## 修改

### A. 抽一个工具函数（新建 `app/utils/difficultyLimit.ts`）
```ts
export interface DifficultyLimitOpts {
  imgW: number   // 图片原始宽
  imgH: number   // 图片原始高
  minCellPx?: number   // 默认 50
  reserveH?: number    // 视口高度扣除量，默认 240（header/hud/items/footer）
  reserveW?: number    // 视口宽度扣除量，默认 32（左右 padding）
  maxWrapW?: number    // 默认 560
  maxWrapH?: number    // 默认 900
  hardMin?: number     // 拼图最少块数，默认 4
  hardMax?: number     // 拼图最多块数，默认 200
  vw?: number          // 传入以便 SSR / 测试
  vh?: number
}

export function computeMaxPieces(o: DifficultyLimitOpts): number {
  const minCell = o.minCellPx ?? 50
  const reserveH = o.reserveH ?? 240
  const reserveW = o.reserveW ?? 32
  const maxWrapW = o.maxWrapW ?? 560
  const maxWrapH = o.maxWrapH ?? 900
  const hardMax = o.hardMax ?? 200
  const hardMin = o.hardMin ?? 4
  const vw = o.vw ?? (typeof window !== 'undefined' ? window.innerWidth : 400)
  const vh = o.vh ?? (typeof window !== 'undefined' ? window.innerHeight : 800)

  // 视口竖屏但图片横向 → 旋转后 W↔H 交换（与 usePuzzleGame 逻辑保持一致）
  const portraitViewport = vh >= vw
  const portraitImage = o.imgH >= o.imgW
  const rotated = portraitViewport && !portraitImage
  const W = rotated ? o.imgH : o.imgW
  const H = rotated ? o.imgW : o.imgH
  const a = W / H

  const capW = Math.min(vw - reserveW, maxWrapW)
  const capH = Math.min(vh - reserveH, maxWrapH)
  // 内接矩形
  let wrapW = capW, wrapH = capW / a
  if (wrapH > capH) { wrapH = capH; wrapW = capH * a }

  const maxCols = Math.max(2, Math.floor(wrapW / minCell))
  const maxRows = Math.max(2, Math.floor(wrapH / minCell))
  // pickGrid 会按 aspect 选接近正方形的格子；上限约等于 maxCols*maxRows，再保守 0.85 倍
  const raw = Math.floor(maxCols * maxRows * 0.85)
  return Math.min(hardMax, Math.max(hardMin, raw))
}
```

### B. `selfie.vue` 集成

1. **拿到最新一张预览图的 naturalWidth/naturalHeight**（用最后一张作为约束依据；也可以取最"极端"的一张，先按"最后一张"实现简单可靠）：
   ```ts
   const imgDim = ref<{ w: number; h: number } | null>(null)

   function measureImage(url: string) {
     const im = new Image()
     im.onload = () => { imgDim.value = { w: im.naturalWidth, h: im.naturalHeight } }
     im.src = url
   }
   // onFileSelect 里 reader.onload 时 push 后调用 measureImage(reader.result)
   // capture 里 push 后调用 measureImage(data)
   // 每次 images 变化时用最后一张的尺寸
   ```
   实际实现：把 measure 逻辑做成"每次 push 一张就更新 imgDim 为该张的尺寸"，并且 `removeImage` 时若删掉的是最后一张，回退到前一张的尺寸（简化：干脆每次 images 变都重测最后一张）。

2. **计算 maxPieces**（响应式，随 imgDim / viewport 变化）：
   ```ts
   import { computeMaxPieces } from '~/utils/difficultyLimit'
   const viewportTick = ref(0)
   onMounted(() => {
     const handler = () => viewportTick.value++
     window.addEventListener('resize', handler)
     window.addEventListener('orientationchange', handler)
     onBeforeUnmount(() => {
       window.removeEventListener('resize', handler)
       window.removeEventListener('orientationchange', handler)
     })
   })
   const maxPieces = computed(() => {
     viewportTick.value  // 依赖
     if (!imgDim.value) return 200
     return computeMaxPieces({ imgW: imgDim.value.w, imgH: imgDim.value.h })
   })
   ```

3. **DifficultyDial 的 max 绑定用 `maxPieces`**：
   ```html
   <DifficultyDial v-model="pieceCount" :min="4" :max="maxPieces" label="切块数" />
   ```
   同时 `range-hint` 右侧文案改成动态：`{{ maxPieces }} (最难)`。

4. **超限自动 clamp**：`watch(maxPieces, (m) => { if (pieceCount.value > m) pieceCount.value = m })`。

5. **提示文案**：在 `.difficulty` 下面加一行小字：
   ```html
   <p class="limit-hint" v-if="imgDim">
     根据当前手机屏幕和图片比例，最高难度 <strong>{{ maxPieces }}</strong> 块；再高会超出屏幕。
   </p>
   ```
   样式 `font-size: 12px; color: var(--color-text-soft); text-align: center;`

6. **randomize 也 clamp**：`pieceCount.value = randInt(4, maxPieces.value)`。

7. **开始按钮附加二次校验**（保险）：`startGame` 里若 `pieceCount.value > maxPieces.value`，alert 并 return。

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(selfie): cap difficulty by viewport & image ratio"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
