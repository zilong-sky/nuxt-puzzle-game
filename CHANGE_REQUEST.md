# 拼图改造需求（手机优先 + 交换玩法）

## 目标
1. **手机优先适配**：现在棋盘 + 托盘布局在手机上放不下。改成手机屏幕能完整装下的单屏布局，横竖屏都合理。
2. **取消"空槽 + 托盘"机制**：不再把碎片放在托盘/空槽外，改成"一开始就是一整张打乱的图"，玩家点/拖任意一块，再点/拖到另一块的位置，两块**直接交换**，直到全部对位即胜利。

## 具体要求

### 布局（mobile-first）
- 棋盘按视窗尺寸 `min(100vw - 16px, 100vh - header - footer - controls - 16px)` 自适应，永远整屏可见，不出现横向/纵向滚动。
- 顶部保留计时/道具/得分等控件条，尺寸压缩到手机可用（一行、图标 + 文字紧凑）。
- 删除托盘 `.tray` 相关 DOM/样式/滚动逻辑。
- 桌面端保留居中放大显示，不要为桌面拉大到超过 720px。

### 玩法（swap-only）
- 初始化：`generateGridPieces` 后，把 `slotIndex` 随机排列，每格都被占用；`tray*`、`空槽`概念全部去除。
- 交互：
  - **点击-点击** 选中第一块（高亮），点击第二块 → 交换 slotIndex；再次点击已选中的块 → 取消选中。
  - **拖拽** 起手一块，拖到另一块上松开 → 交换；拖动中被覆盖的块淡显高亮，松手不在任何格子上则弹回原位。
  - 同时支持鼠标/触屏（Pointer Events）。
- 胜利判定：所有 piece 的 `slotIndex === piece.correctIndex` 时触发通关。
- 智能还原道具：随机挑 3 块未归位的，把它和正确位置上的那块交换（不是移到空槽）。
- 时间冻结、广告复活等逻辑不变。

### 事件/composable 改造
- `usePuzzleGame.ts`：删除 `placePieceToSlot / returnPieceToTray`，改成 `swapPieces(aId, bId)`；`useRestore` 用交换实现。
- `PuzzleBoard.vue`：删除托盘层，只保留一层棋盘 + 一层拖拽中浮层；`@swap` 事件冒泡到 `PuzzleGame.vue`。
- `PuzzleGame.vue`：改接 `@swap`，删除 `@place / @return-to-tray`。

### 手感
- 拖起 `scale(1.08)` + drop-shadow，跟手（rAF）。
- 目标格子高亮（金色描边呼吸），松手命中即交换，动画 150ms。
- 已归位（`slotIndex === correctIndex`）的块加淡淡的绿色描边，方便看进度。

## 交付
1. `npm run build` 必须通过。
2. 手机 375×667 视窗下打开 `/play/casual` `/play/cloud` `/play/selfie` 三条链接，棋盘完全可见、无滚动、可玩。
3. `git add -A && git commit -m "feat(mobile): swap-only puzzle with mobile-first layout"` 然后 `git push origin master`（失败重试一次）。
4. 全过程自主完成，不要询问。
