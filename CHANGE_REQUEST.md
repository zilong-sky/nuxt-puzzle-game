# 三处调整

## 一、圆环内数字上移到缺口位置

### 现状
`DifficultyDial.vue` 中心大数字在正中，滑动时容易被手指挡住。

### 修改（`app/components/DifficultyDial.vue`）
把 `<text>` 数字上移到圆环顶部缺口位置：
- 当前 viewBox 是 `240x240`（或类似），圆心 `(cx, cy) = (120, 120)`，半径 `r ≈ 100`。
- 数字 y 从 `cy` 改到 `cy - r * 0.55` 附近（大约在顶部缺口正下方一点，肉眼看在弧的开口"里面"）。具体值以 SVG 实际尺寸为准，目标是数字视觉中心落在两条弧末端连线上方。
- 保持字体大小 48px 不变，`text-anchor="middle"`, `dominant-baseline="central"`。
- 单位小字 "块" 放在数字**正下方**（原本在数字下方，跟着上移即可），保持 12px。

## 二、休闲模式：开始前弹窗选难度

### 修改
1. 新建 `app/components/DifficultyModal.vue`：
   - Props: `open: boolean`, `min=4, max=200`, `initial=48`。
   - Emits: `confirm(value: number)`, `cancel()`。
   - 模板：一层遮罩 `.modal-backdrop`（半透明黑，`position: fixed; inset: 0; z-index: 100`）+ 中间白卡 `.modal-card`：
     ```html
     <div v-if="open" class="modal-backdrop" @click.self="$emit('cancel')">
       <div class="modal-card">
         <h3>选择难度</h3>
         <p class="hint">左低右高，滑动圆环选择</p>
         <DifficultyDial v-model="local" :min="min" :max="max" label="块数" />
         <div class="btns">
           <button class="ghost-btn" @click="$emit('cancel')">取消</button>
           <button class="primary-btn" @click="$emit('confirm', local)">开始游戏</button>
         </div>
       </div>
     </div>
     ```
   - `local = ref(props.initial)`；`watch(() => props.open, (o) => { if (o) local.value = props.initial })`。
   - 样式：卡片圆角 16px，padding 24px，宽度 `min(90vw, 360px)`，中间居中；按钮排一行右对齐；`.primary-btn` 用金色 `#d4af37`。

2. 改 `app/pages/play/casual.vue`：
   ```vue
   <template>
     <DifficultyModal
       :open="!pieceCountChosen"
       :min="4" :max="200" :initial="48"
       @confirm="onDifficultyConfirm"
       @cancel="onDifficultyCancel"
     />
     <div v-if="current && pieceCountChosen">
       <PuzzleGame
         :image-url="current.url"
         :piece-count="pieceCount"
         mode-label="🌿 休闲模式"
         :show-score="false"
         next-label="下一张"
         @success="onSuccess"
         @fail="onFail"
         @abort="onAbort"
         @next="loadNext"
       />
     </div>
     <div v-else-if="pieceCountChosen" class="card">加载中...</div>
   </template>

   <script setup lang="ts">
   import { onMounted, ref, computed } from 'vue'
   import PuzzleGame from '~/components/PuzzleGame.vue'
   import DifficultyModal from '~/components/DifficultyModal.vue'
   import { fetchCasualImages, type PuzzleImage } from '~/services/imageService'

   const list = ref<PuzzleImage[]>([])
   const idx = ref(0)
   const pieceCount = ref(48)
   const pieceCountChosen = ref(false)

   const current = computed(() => list.value[idx.value])

   onMounted(async () => {
     const raw = await fetchCasualImages()
     // Fisher-Yates shuffle
     const arr = raw.slice()
     for (let i = arr.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1))
       ;[arr[i], arr[j]] = [arr[j], arr[i]]
     }
     list.value = arr
   })

   function onDifficultyConfirm(v: number) {
     pieceCount.value = v
     pieceCountChosen.value = true
   }
   function onDifficultyCancel() { navigateTo('/') }
   function loadNext() {
     idx.value = (idx.value + 1) % list.value.length
     // 难度不变
   }
   function onSuccess() {}
   function onFail() {}
   function onAbort() { navigateTo('/') }
   </script>
   ```

## 三、休闲模式：30 张默认图片

### 修改（`app/services/imageService.ts`）
把 `fetchCasualImages` 从生成 12 张 SVG 改成返回 30 张**真实照片**。用 [Picsum Photos](https://picsum.photos) 免费图库（无需 API key，直接 URL 返回随机图片）：

```ts
export async function fetchCasualImages(): Promise<PuzzleImage[]> {
  // 30 个稳定 seed，每次同一 seed 返回同一张图；构建时确定，避免每次刷新变化
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
```
- Picsum 的 `seed/xxx` URL 返回固定内容，浏览器可缓存。
- 800×600 是横向图，会触发我们的"竖屏时旋转"逻辑，正好测试旋转分支。
- 若 Picsum 慢或被墙，替代方案：把 seeds 数量改小 or 换成 `https://source.unsplash.com/random/800x600?nature&sig=${i}`。**首选 Picsum**，稳定可缓存。
- ⚠️ Picsum 是 HTTPS，Nuxt/Vercel 侧无需配置。canvas 旋转时 `img.crossOrigin` 需要设置为 `"anonymous"` 才能画到 canvas 后 `toDataURL` —— **重要**：检查 `usePuzzleGame.ts` 里 `new Image()` 有没有设 crossOrigin。如果没设，会触发 tainted canvas 错误导致旋转分支失败。需要改成：
   ```ts
   const img = new Image()
   img.crossOrigin = 'anonymous'
   img.src = opts.imageUrl
   await img.decode().catch(() => {})
   ```
   Picsum 响应有 `Access-Control-Allow-Origin: *`，兼容。

## 四、交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(casual): difficulty modal + 30 shuffled images; ui(dial): number up"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
