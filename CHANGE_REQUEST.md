# 拼图游戏第二批需求（9 条一次做完）

## 1. 道具改成"每张一次"，而非"整局一次"

**当前**：`useGameStore.items = { restore: 1, freeze: 1 }` 是玩家账户的库存，用一次 -1，永久扣。
**期望**：进入**每一张**拼图（`usePuzzleGame.init()` 触发时）都重置为 `{ restore: 1, freeze: 1, replay: 1 }`；本局用完就是没了，下一张自动补满。全局 store 不再管道具库存。

改法：
- `usePuzzleGame.ts` 内部新增 `roundItems = ref({ restore: 1, freeze: 1, replay: 1 })`，`init()` 里重置。
- 导出 `roundItems, useRestore, useFreeze, useReplay`；`useRestore/useFreeze/useReplay` 内部先 `if (roundItems.value.xxx <= 0) return; roundItems.value.xxx -= 1;` 再执行原逻辑。
- `PuzzleGame.vue` 的道具按钮改成读 `roundItems` 而不是 `game.items`；`doRestore/doFreeze` 里去掉 `game.useItem(...)` 那一步，直接调 `useRestore/useFreeze`。
- `gameStore.ts` 保留 items 字段不动（未来做付费购买再用），但**不再消耗**，暂时视作背景库存/皮肤入口，UI 里也不显示了。

## 2. 休闲模式：结束弹窗 → 点确认 → 弹窗消失 → 加载下一张（含进度条）

**当前**：`PuzzleGame` 的成功弹窗点"下一张"emit `next` → `casual.vue` `idx.value++` → watch `imageUrl` 变 → `init()` 重置并 `loading=true` 进度条。理论已经是这个行为，**请验证**：
- 点"下一张"后成功弹窗应立刻消失（`finished` 在 `init()` 里置 false）。
- 弹窗消失后 loading overlay 立刻显示，进度条 0→100%。
- 加载完成后新棋盘出现，继续玩。

如果验证下来点"下一张"时**弹窗还没消失就开始加载**、或者**加载完了弹窗才关**，修 `usePuzzleGame.init()` 开头：
```ts
finished.value = false
failed.value = false
loading.value = true
loadProgress.value = 0
```
确保 `finished=false` 先于任何异步 fetch 发生（放在函数第一行，同步执行完 Vue 才切响应式）。

## 3. 冒险模式：暂用休闲图池，顺序固定 + 全局进度持久化

改 `app/pages/play/cloud.vue`：
- `fetchCloudImages()` → 改成 `fetchCasualImages()`（用休闲同一批 30 张 seed 图）。
- **不 shuffle**，保持 imageService 返回的原顺序（seed 数组顺序即为冒险模式顺序）。
- 起始 idx 来自 `gameStore.adventureIdx`（新增字段）：
  - `useGameStore` state 新增 `adventureIdx: 0`，storage key `puzzle:adv-idx`。
  - `hydrate()` 里 `this.adventureIdx = getItem(STORAGE_KEYS.ADV_IDX, 0)`。
  - actions 新增 `setAdventureIdx(i: number) { this.adventureIdx = i; setItem(STORAGE_KEYS.ADV_IDX, i) }`。
- `onMounted`：`list.value = await fetchCasualImages()`（不打乱）；`idx.value = Math.min(game.adventureIdx, list.value.length - 1)`。
- `loadNext()` 里：`idx.value = (idx.value + 1) % list.value.length`；调用 `game.setAdventureIdx(idx.value)`（持久化）。
- 每张的 `pieceCount`：`randInt(30, 80)`（保留随机难度）。
- `STORAGE_KEYS` 里加 `ADV_IDX: 'puzzle:adv-idx'`。

## 4. 修复休闲模式页面标题/文案乱码

`app/pages/play/casual.vue` 里的中文全是乱码（`?? ����ģʽ` / `������...` / `��һ��`）。**整个文件用 UTF-8 编码重写**为：

```vue
<!-- app/pages/play/casual.vue - 休闲模式：弹窗选难度，30 张固定图 -->
<template>
  <DifficultyModal
    :open="!pieceCountChosen"
    :min="4" :max="50" :initial="25"
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
```

script/style 部分保持原有逻辑，只改中文文案。**用 UTF-8 without BOM 保存**。

顺便检查其他文件里 mode-label / 提示语是否有 `??` `����` 之类的乱码，一并改成正确中文。

## 5. 自拍模式：结束弹窗 → 询问是否上传 → 假上传进度条 → 下一张（或返回选择页）

`app/pages/play/selfie.vue` 已有 `askUpload` 弹窗（"是否将这张自拍推荐到云图库？"）。当前 `doUpload` 只是 `await uploadImage(blob)` mock 400ms。改成：

- 新增状态 `uploading = ref(false)`、`uploadProgress = ref(0)`。
- 新增弹窗 `<ModalDialog :visible="uploading" title="☁️ 上传中" :closable="false">`：内容是一个进度条（复用 `.progress-track/.progress-fill/.progress-num` 样式），显示 `{{ uploadProgress }}%`。
- `doUpload()` 改成：
  ```ts
  async function doUpload() {
    askUpload.value = false
    uploading.value = true
    uploadProgress.value = 0
    // 假上传：3 秒内匀速 0→100
    await new Promise<void>((resolve) => {
      const start = Date.now()
      const timer = setInterval(() => {
        const elapsed = Date.now() - start
        const pct = Math.min(100, Math.round((elapsed / 3000) * 100))
        uploadProgress.value = pct
        if (pct >= 100) { clearInterval(timer); resolve() }
      }, 60)
    })
    // TODO: 真实上传接口就绪后替换成 uploadImage(blob)
    uploading.value = false
    onNext()
  }
  ```
- `onNext()` 保持不变：如果有下一张 → idx++，否则 gameStarted=false 返回选择页。

## 6. 新增道具"🔄 重玩本局"

- `usePuzzleGame.ts` 新增 `restart()`：不重新拉图/不重新旋转/不重新 pickGrid，只把当前 `pieces` 的 `slotIndex` **重新 Fisher-Yates 洗一次**（复用 shufflePieces 里避免"洗后不变"的重试逻辑）→ `recomputeGroups()` → `finished=false, failed=false, running=true, timeLeft=calcCountdown(pieces.length)`。
- 导出 `useReplay = () => restart()`（受 roundItems.replay 约束，同 §1）。
- `PuzzleGame.vue` 道具栏在 `❄️ 时间冻结` 后面新增一个按钮：
  ```html
  <button
    class="item-btn"
    :disabled="!running || roundItems.replay <= 0"
    @click="doReplay"
  >
    🔄 重玩本局 × {{ roundItems.replay }}
  </button>
  ```
- `doReplay() { useReplay() }`。

## 7. 云冒险入口按钮变大 + 居中

`app/pages/index.vue` 的 `.mode-card.highlight`（云冒险卡）里的 `<button>了解并开始</button>` 改成：

```html
<button class="big-start-btn">了解并开始</button>
```

样式：
```css
.big-start-btn {
  display: block;
  margin: 12px auto 0;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  min-width: 180px;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  border: none;
}
```

顺便把云冒险说明弹窗（ModalDialog）里的"进入云冒险"按钮也用相同 `.big-start-btn` class 处理，`.big-start-btn:disabled` 灰色。

## 8. 进入游戏页自动滚到顶（避免被 sticky header 遮）

`app/components/PuzzleGame.vue` 的 `onMounted` 里新增：
```ts
onMounted(() => {
  init()
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' })
    // 再用 rAF 补一次，确保 sticky header 布局稳定后再校准
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }
})
```
另外在 `app/layouts/default.vue` 里给 `.main-content.is-play` 加 `min-height: 100dvh` 防止内容不够高时 header 相对位置漂移。

保险起见，`app/pages/play/casual.vue` `app/pages/play/cloud.vue` `app/pages/play/selfie.vue` 三个页面的 `onMounted` 里也加一次 `window.scrollTo(0, 0)`。

## 9. 二级页面 header 显示返回按钮

改 `app/components/AppHeader.vue`：

```vue
<template>
  <header class="app-header">
    <div class="inner">
      <button v-if="!isHome" class="back-btn" @click="goBack" aria-label="返回">
        ← 返回
      </button>
      <NuxtLink to="/" class="brand" v-else>🧩 拼图小游戏</NuxtLink>
      <div class="title-center" v-if="!isHome">{{ pageTitle }}</div>
      <nav class="nav" v-if="isHome">
        <NuxtLink to="/">首页</NuxtLink>
        <NuxtLink to="/rank">排行榜</NuxtLink>
      </nav>
      <div class="right-placeholder" v-else />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const route = useRoute()
const router = useRouter()
const isHome = computed(() => route.path === '/')
const TITLE_MAP: Record<string, string> = {
  '/play/casual': '🌿 休闲模式',
  '/play/cloud': '☁️ 云冒险',
  '/play/selfie': '📸 自拍上传',
  '/rank': '🏆 排行榜'
}
const pageTitle = computed(() => TITLE_MAP[route.path] || '')
function goBack() {
  if (window.history.length > 1) router.back()
  else navigateTo('/')
}
</script>
```

样式补：
```css
.back-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.back-btn:hover { background: #f3f4f6; }
.title-center {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.right-placeholder { width: 68px; } /* 平衡返回按钮的宽度，让标题真正居中 */
```

---

## 验收

- `npm run build` 通过；
- git commit：`feat(round-items): per-round items; feat(replay): 🔄 replay item; feat(adventure): reuse casual pool with sticky idx; feat(selfie): fake upload progress; feat(home): bigger centered CTA; fix(casual): mojibake title; feat(scroll): auto-scroll to top on enter; feat(header): back button on subpages`
- push origin master（失败重试一次）。
