# 松手交换卡顿优化（大棋盘专用）

## 根因分析
用户报告：`.piece` 数量多时（如 50/100/200 块），松手瞬间交换有卡顿感。

排查链路（`onPointerUp` → `emit('moveGroup')` → `usePuzzleGame.moveGroup`）：
1. `moveGroup` 里 `for (const s of shifts) s.piece.slotIndex = s.newSlot` + `for (displaced) displaced[k].slotIndex = freeSlots[k]` —— **深响应式 mutation**，每次赋值触发一次 track 通知；虽然 Vue 会去重合并成一次 flush，但 200 次 deps 通知本身有几毫秒开销。
2. Vue re-render `PuzzleBoard`：
   - `slotMap` computed 重建 O(N)
   - **所有 N 个 `<div class="piece">` 都被 patch**，每个都跑一遍 `pieceStyle(p)`（读 slotIndex/cols/rows）+ `fillStyle(p)`（读 slotMap → neighborInsets → 4 次 map 查找 + box-shadow 字符串拼接 + border color 计算）。虽然实际 DOM diff 只更新几块，但函数调用和响应式追踪开销 × N 就明显了。
3. CSS `transition: left 0.12s cubic-bezier(...)` —— 每个被换位置的块启动合成层动画。这个是必要的（要看到滑动效果），但配合前面 2 就叠加。

## 修复方案

### 优化 1：`.piece` 上加 `v-memo`（首要且最有效）

只有 slotIndex/groupId/groupAligned/cols/rows/imageUrl 真的变了才 patch 这个 piece。其余块**完全跳过 render**。

`app/components/PuzzleBoard.vue` template：
```html
<div
  v-for="p in pieces"
  :key="p.id"
  class="piece"
  :class="{
    selected: selectedGroupId === p.groupId,
    'group-aligned': p.groupAligned
  }"
  :data-piece-id="p.id"
  :style="pieceStyle(p)"
  v-memo="[p.slotIndex, p.groupId, p.groupAligned, props.cols, props.rows, props.imageUrl, selectedGroupId === p.groupId]"
  @pointerdown="onPointerDown($event, p)"
>
  <div class="piece-fill" :style="fillStyle(p)" />
</div>
```
（保持现有其他属性；只是新增 `v-memo` 一行。`selectedGroupId === p.groupId` 单独提出来，让点选态变化时也能重绘。）

### 优化 2：大棋盘时缩短 CSS transition

`.piece` transition 时长基于块数动态调整：
- 加个 computed：`const swapTransition = computed(() => (cols.value * rows.value >= 80) ? 60 : 120)`
- 在 `.piece` `:style` 里注入一个 CSS 变量 `--swap-ms`：
  ```ts
  function pieceStyle(p) {
    return {
      ...
      '--swap-ms': swapTransition.value + 'ms',
    }
  }
  ```
  但 `--swap-ms` 应该在 `.board` 上设一次而不是每块设一次。改成 `:style` 挂 `.board`：
  ```html
  <div class="board" ref="boardEl" :style="{ '--swap-ms': swapMs + 'ms' }">
  ```
  ```ts
  const swapMs = computed(() => (props.cols * props.rows >= 80) ? 60 : 120)
  ```
- CSS：
  ```css
  .piece {
    transition: left var(--swap-ms, 120ms) cubic-bezier(0.2, 0, 0, 1),
                top  var(--swap-ms, 120ms) cubic-bezier(0.2, 0, 0, 1);
  }
  ```
  （替换现有 `.piece` 的 transition 硬编码时间。）

### 优化 3：`recomputeGroups` 内部小优化

现在每次 `moveGroup` 尾巴都跑一次 `recomputeGroups`，全表 O(N) 是必要的。里面用了 `slotToIdx.get` 已经是 O(1)。**唯一浪费**：
- 最后循环里 `p.groupId = rootPieceId[i]` 和 `p.groupAligned = ...` 无条件写深属性 → N 次 track。改成"值变了才写"：
  ```ts
  for (let i = 0; i < N; i++) {
    const p = list[i]!
    const newGid = rootPieceId[i]!
    const newAlign = alignedMap.get(newGid) === true
    if (p.groupId !== newGid) p.groupId = newGid
    if (p.groupAligned !== newAlign) p.groupAligned = newAlign
  }
  ```

### 优化 4：`checkFinished` 用短路遍历（已经是 `.every`，OK，不改）

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "perf(swap): v-memo + dynamic transition + skip no-op writes"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
