# 变更需求：方格拼图 + 拖起手感

## 目标
把现在的 SVG 异形拼图（凸凹卡口）**整体替换**为**规则矩形方格拼图**，并把拖拽交互改成手机拼图 App 的"抬起-跟手-落位"手感。三种模式（休闲 / 云冒险 / 自拍）全部按新玩法运行。

## 参考视觉
参考手游"红楼梦拼图"里的方格式拼图：
- 图片按 `cols × rows` 网格均匀切割，每块是矩形（无凸凹卡口）
- 棋盘一侧有一格**空位**（灰色/半透明底），已放好的块在棋盘上按目标位摆放，未放好的块散落在下方托盘区
- 拖起某块 → 该块**放大 ~1.15×**、投**深色柔和阴影**（offset 6px、blur 16px、rgba(0,0,0,.35)）、**中心跟随手指/指针**（触点相对偏移平滑过渡）
- 释放时若命中目标格（距离 < 半格）→ **吸附动画**（120ms cubic-bezier(.2,.9,.3,1.2)）落位，播放轻微亮边闪一下；否则回弹到托盘原位（180ms 弹性）
- 目标格在拖动过程中显示**虚线高亮框**（金色 2px dashed），最近可吸附格额外加"呼吸"发光

## 技术改动清单

### 1. 切割算法（`app/utils/puzzle.ts`）
- 删除/弃用 SVG 凸凹路径（`buildTabPath` 等）
- 新增 `generateGridPieces(cols, rows, imgW, imgH, seed)`：返回 `Piece[]`
  - `Piece = { id, row, col, x, y, w, h, bgX, bgY, correctIndex, currentIndex }`
  - 每块是一个 div，`background-image: url(img)`, `background-position` 定位到自己那一块
- 根据 `blocks`（30–200）推算最佳 `cols × rows`：取最接近 `sqrt(blocks * ratio)` 的整数对，`ratio = imgW/imgH`，最终块数在 `[blocks*0.8, blocks*1.2]` 内即可

### 2. 棋盘组件（`app/components/PuzzleBoard.vue` 重写）
- 用绝对定位的 `<div class="piece">` 而不是 SVG
- 每块 div：
  - 正常态：`transform: translate(x, y); transition: transform .18s`
  - 拖起态（加 class `.dragging`）：
    - `z-index: 999`
    - `transform: translate(cursorX - w/2, cursorY - h/2) scale(1.15)`
    - `filter: drop-shadow(0 6px 16px rgba(0,0,0,.35))`
    - 关闭 transition，走 rAF 直接跟手
- Pointer 事件统一走 `pointerdown/move/up`（覆盖鼠标+触摸），`setPointerCapture` 保证不丢帧
- 落位判定：release 时找到最近的**空目标格**，距离 < `min(w,h)*0.5` → 吸附；否则回原位
- 目标格高亮：拖动时给所有空目标格加 `.slot-highlight`；最近那个再加 `.slot-active`（呼吸动画）

### 3. 托盘 & 完成检测
- 棋盘下方 `.tray` 横向可滚动，未上棋盘的块按随机顺序排列，也支持拖出
- 完成条件：所有 `piece.currentIndex === piece.correctIndex`
- 完成时全棋盘播 200ms 亮边脉冲，然后走原有胜利流程

### 4. 三模式接入（`app/composables/usePuzzleGame.ts` 和 `pages/play/*.vue`）
- 只改切割入口：`pieces = generateGridPieces(cols, rows, ...)`
- 倒计时公式沿用（`60 + 4 * pieceCount`）
- 道具"智能还原 3 块"：随机挑 3 块未归位的直接吸附到 correct 位（带动画）
- 时间冻结：不变

### 5. 样式（Scoped SCSS 或 style 内联）
```css
.piece {
  position: absolute;
  will-change: transform;
  cursor: grab;
  border-radius: 2px;
}
.piece.dragging {
  cursor: grabbing;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,.35));
  z-index: 999;
}
.slot {
  position: absolute;
  background: rgba(0,0,0,.06);
  border: 1px dashed transparent;
}
.slot-highlight { border-color: #d4a24c; }
.slot-active {
  border-color: #f5c451;
  box-shadow: 0 0 12px rgba(245,196,81,.6);
  animation: breathe 1s ease-in-out infinite;
}
@keyframes breathe {
  0%,100% { box-shadow: 0 0 6px rgba(245,196,81,.4); }
  50%     { box-shadow: 0 0 16px rgba(245,196,81,.8); }
}
```

### 6. README 更新
- 说明"切割方式改为矩形网格"
- 更新截图/说明中提到"异形/Bezier"的段落
- 保留后端占位注释和位置

## 验收
1. `npm run build` 通过（Nuxt 4 + Vercel preset）
2. `npm run dev` 手工验证：休闲模式能开局、能拖起放大+跟手+阴影、能吸附落位、完成后弹胜利
3. 手机 Chrome 触摸也顺（pointer events 已覆盖）
4. Git commit：`feat: rectangular grid pieces with lifted-drag interaction`

## 不要做的事
- 不要改路由结构、不要动 `services/*` 后端占位
- 不要动 `AppHeader/AppFooter/AdModal`
- 不要引第三方拖拽库（interact.js/dnd-kit 之类），纯 pointer events + CSS transform
