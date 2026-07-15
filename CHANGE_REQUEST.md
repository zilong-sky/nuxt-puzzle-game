# 优化拖动流畅度

## 现象
拖拽拼图时明显卡顿，不跟手，尤其在 6×6 以上高阶数下。

## 根因分析
`app/components/PuzzleBoard.vue` 里：
1. `dragOffset` 是响应式 ref，每次 pointermove（rAF）都变一次值 → Vue 触发**所有** `.piece` 的 `pieceStyle` 重算（36~81 个），即便只有被拖那组真的动。
2. `hoverTargets` 每帧都用 `new Set()` 重新赋值 → 触发所有 `.slot` 的 class 重算和 vue diff。
3. 每次 pointermove 都调用 `computeGroupMove` 遍历 pieces。
4. `.piece` 上还有 `transition: left 0.15s, top 0.15s, transform 0.2s` —— 非拖动状态下写了 transition 属性，Vue 每次 rerender 都会重新读一遍样式。

## 优化目标
拖动只让被拖那组的 DOM 直接更新 transform，其他 piece 完全不进入 Vue 更新循环；hover 反馈按"格子跳变"节流，不是每帧刷。

## 具体改动（都在 `app/components/PuzzleBoard.vue`）

### 1. 把拖动 offset 从响应式改成"直接写 DOM style / CSS 变量"
- 移除 `dragOffset` ref 在 `pieceStyle` 里的分支：
  - `pieceStyle(p)` 只返回位置和尺寸，**不再**根据 `draggingGroupId` 写 `transform`。
- 在 `<template>` 的 `.board` 元素上定义 CSS 变量：
  ```css
  .board { --drag-dx: 0px; --drag-dy: 0px; }
  .piece.dragging {
    transform: translate3d(var(--drag-dx), var(--drag-dy), 0) scale(1.05);
    z-index: 999;
  }
  ```
- `scheduleUpdate` 的 rAF 回调里改为：
  ```ts
  const boardEl = getBoardEl()
  boardEl.style.setProperty('--drag-dx', drag.curDx + 'px')
  boardEl.style.setProperty('--drag-dy', drag.curDy + 'px')
  ```
  绕过 Vue 响应式，这样非拖动的 80 个 piece 完全不参与更新。
- `onPointerUp` 时把 `--drag-dx / --drag-dy` 复位为 `0px`。

### 2. hoverTargets 按"整数格"节流，不是每帧
- 在 `DragState` 里加 `lastDCol: number; lastDRow: number`（初始 `-9999`）。
- rAF 回调里先算 `dCol = Math.round(curDx/cellW), dRow = Math.round(curDy/cellH)`；只有当 `dCol !== lastDCol || dRow !== lastDRow` 时才调 `computeGroupMove` 并更新 `hoverTargets`。
- 这样拖 1 格范围内的抖动不会反复触发 slot 高亮 diff。

### 3. dragging 期间冻结所有 piece 的 transition
- 在 `.board` 上加 `is-dragging` class（`draggingGroupId !== null` 时）：
  ```css
  .board.is-dragging .piece:not(.dragging) {
    transition: none;
  }
  ```
  避免拖动过程中其他 piece 的 transition 重算。（因为 slotIndex 拖动中不变，其实不会触发过渡，但 Vue 仍会走 diff；此规则 + 上面的 DOM 直写，双保险。）

### 4. `computeGroupMove` 内部构造 Set 复用
- 把 `members = props.pieces.filter(...)` 缓存到 `DragState.members`（onPointerDown 时算一次）；rAF 里不用每次 filter。
- 每次 rAF 内部 new Set 无所谓，但循环遍历 members 而不是全部 pieces。

### 5. `.piece-fill` 上一版为了"无缝大块"用了动态 `box-shadow` 四边合成 + border-color 分边设置，每帧数据变化时会重算。检查 `fillStyle` 依赖，如果 `neighborInsets/groupAligned` 拖动过程中不会变，那么它们不会重算；如果 Vue 仍在 diff，考虑把 `fillStyle` 结果缓存进 `computed`（按 p.id + p.slotIndex + p.groupId + p.groupAligned 生成 key）。若判断改动收益不大，本项可跳过。

### 6. `<img class="board-ghost">` 加 `pointer-events: none`（应已存在）；确认 `.piece { touch-action: none; will-change: transform }` 已在，拖动组加 `will-change: transform` 更明显（可能已在）。

## 交付
1. `npm run build` 通过。
2. `git add -A && git commit -m "perf(drag): DOM-direct transform, throttled hover, seamless idle"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
