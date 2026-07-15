# 拖动跟手度进阶优化

## 现象
上一次优化已经消除了大部分卡顿（DOM 直写 + hover 节流 + members 缓存），但拖动仍有轻微不跟手感。

## 剩余瓶颈分析

### 瓶颈 1（最大）：`.piece.dragging` 用了 `filter: drop-shadow(...)`
`filter: drop-shadow` 在移动端 GPU 上每帧都要重光栅化，是**跟手感的头号杀手**。哪怕 CSS var 直写、transform 硬件加速全部到位，drop-shadow 一开，还是感觉黏。

### 瓶颈 2：rAF 强制推迟一帧
现在 pointermove → 只做数据存储 → rAF 里才 setProperty。这在 60/90/120Hz 屏上都会额外拖 8~16ms。移动端 pointer event 本身已经和 vsync 对齐，rAF 反而多加一层延迟。

### 瓶颈 3：CSS 变量写在 `.board` 上
`.board { --drag-dx: 0 }` 每次改都会让浏览器对整个 board 子树做一次样式失效检查（虽然只有 `.piece.dragging` 使用，检查仍要走）。把变量直接写到**被拖的那个 piece 元素上**能把样式失效范围缩到最小。

### 瓶颈 4：coalesced events 未启用
手机高刷屏上一帧内可能有多次触摸采样，浏览器默认合并成一个事件。`event.getCoalescedEvents()` 可以取到全部原始点，让插值更贴合手指轨迹（对"末段收尾"跟手感有帮助）。

### 瓶颈 5：`.piece` 上写了 `transition: left 0.15s, top 0.15s, transform 0.2s`
拖动结束松手瞬间 slotIndex 变了，`left/top` 走 0.15s transition —— 这段时间视觉上"回收慢"，容易被误解为拖动本身黏。可以保留（这个是"落位"动画，玩家喜欢），但**要确保 transform 上没有过渡**（现在写了 `transform 0.2s`，如果 dragging class 被移除的一瞬间 transform 还没归零就会走 0.2s 过渡回到原位，感觉飘）。

## 具体改动（都在 `app/components/PuzzleBoard.vue`）

### 1. 干掉 `filter: drop-shadow`
```css
.piece.dragging {
  cursor: grabbing;
  transition: none;
  /* 删掉 filter: drop-shadow(...) */
  /* 阴影改用 piece-fill 的 box-shadow：拖动组的四条边都亮起来 */
}
.piece.dragging .piece-fill {
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.15),
    0 8px 18px rgba(0, 0, 0, 0.35);
}
```
`box-shadow` 走 compositor 层，比 `filter: drop-shadow` 快非常多。

### 2. 把 rAF 去掉，pointermove 里直接写 style
```ts
function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  // 采集 coalesced events 的最后一个作为最新位置
  const events = (typeof e.getCoalescedEvents === 'function')
    ? e.getCoalescedEvents()
    : [e]
  const last = events[events.length - 1] || e
  const dx = last.clientX - drag.startX
  const dy = last.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
    drag.moved = true
    draggingGroupId.value = drag.groupId
    selectedGroupId.value = null
  }
  drag.curDx = dx; drag.curDy = dy
  if (!drag.moved) return
  // 直接写 CSS 变量到 piece 元素，绕过 rAF
  const pieceEl = drag.dragEl
  if (pieceEl) {
    pieceEl.style.setProperty('--drag-dx', dx + 'px')
    pieceEl.style.setProperty('--drag-dy', dy + 'px')
  }
  // 整数格变化才更新 hoverTargets（保留 lastDCol/lastDRow 节流）
  const cellW = drag.boardRect.width / props.cols
  const cellH = drag.boardRect.height / props.rows
  const dCol = Math.round(dx / cellW)
  const dRow = Math.round(dy / cellH)
  if (dCol !== drag.lastDCol || dRow !== drag.lastDRow) {
    drag.lastDCol = dCol; drag.lastDRow = dRow
    const { legal, targets } = computeGroupMove(drag.pieceId, dCol, dRow)
    dragLegal.value = legal && (dCol !== 0 || dRow !== 0)
    hoverTargets.value = legal ? targets : new Set()
  }
}
```
`DragState` 里新增 `dragEl: HTMLElement | null`，在 `onPointerDown` 里赋值为 `e.currentTarget as HTMLElement`。取消 `scheduleUpdate/raf/raf id` 相关字段。

### 3. CSS 变量写到 piece 元素，而不是 board
- 删掉 `.board { --drag-dx: 0; --drag-dy: 0 }`。
- `.piece.dragging` 消费当前元素自己的 `--drag-dx / --drag-dy`：
  ```css
  .piece.dragging {
    transform: translate3d(var(--drag-dx, 0), var(--drag-dy, 0), 0) scale(1.05);
    z-index: 999;
    will-change: transform;
  }
  ```
- `onPointerUp` 时把该 piece 元素的两个变量置为 `0px`。

### 4. transition 收尾
- `.piece` 的 transition 保留 `left 0.15s, top 0.15s`（落位动画），**去掉 transform 那段**：
  ```css
  .piece { transition: left 0.15s ease, top 0.15s ease; }
  ```
  这样松手瞬间 transform 立即归零，不会飘。

### 5. pointer 捕获挪到 pointerdown 后立即执行的 board 元素
现在是 `(e.currentTarget as Element).setPointerCapture?.(e.pointerId)`，`currentTarget` 是那个 piece。保持不变即可，但**加 `passive: false`** 已经通过 `e.preventDefault()` 满足。可选：把 `pointermove` 监听从 `window` 改到该 piece 元素上（因为已经 setPointerCapture，事件会锁定到该元素）。这样监听器搜索作用域更小。

### 6. 检查 `.piece-fill` 的 box-shadow 合成
上一次为了"无缝大块"用了动态 `box-shadow` 四边合成 + border 分边设色。拖动的 piece 上，如果它也是 groupAligned 组的一部分，会同时叠加 groupAligned 的四边发光和 dragging 的四边阴影 —— 可能过度复杂。可以在 `.piece.dragging .piece-fill` 里用 `box-shadow: 0 8px 18px rgba(0,0,0,0.35) !important` 覆盖，减少每帧合成层。

### 7. touch-action 已经是 none，pointercancel 已监听，保持。

## 交付
1. `npm run build` 通过。
2. `git add -A && git commit -m "perf(drag): drop filter, sync write, coalesced events"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
