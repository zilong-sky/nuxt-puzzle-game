# 拼图棋盘尺寸与横图旋转优化

## 一、目标（务必全部满足）

### 1. 拼图块最小尺寸 50px 硬底线
- 单个拼图格子最小 **50px × 50px（CSS 逻辑像素）**，任何阶数、任何屏幕下都不得小于此值。
- 依据：移动端拖拽触控容错，44px 只是按钮最小，拼图需 50px 才不打滑不误触。
- 拖拽热区（.piece 元素本身）跟随块尺寸，天然满足 50px。

### 2. 棋盘布局（重点：**不主动放大**、**不强制铺满**）
- **不要**再用 `min(100%, calc(100dvh - var(--chrome-h)))` 之类的策略把棋盘拉去填满可用高度。
- 页面左右固定安全边距 **16px**（board-holder 或 game 容器左右 padding 16px），棋盘不贴屏幕边缘。
- 棋盘尺寸计算规则（新算法）：
  1. 设当前拼图为 `N = max(cols, rows)`（因为要求正方形棋盘，见约束 4.1）。
  2. `minBoardSize = N * 50`（最小 50px/格硬底线）。
  3. `naturalBoardSize`：默认适中尺寸取 `min(可用宽度 - 32px, 可用高度 - chrome, 560px)`；`560px` 是"适中"的上限，避免在大屏 PC 上被拉得过大。
  4. 最终 `boardSize = max(minBoardSize, naturalBoardSize)`。
     - 如果 `minBoardSize > 可用宽度 - 32px`（高阶数如 9×9 在窄屏上），棋盘宽度就是 `minBoardSize`，允许出现横向滚动 —— 但**绝不能**把块缩到 50px 以下。
     - 允许四周留白，不需要消除留白；只保证 50px 底线。
- 棋盘容器 `.board-holder` 不再强制 `flex:1` 撑满剩余高度，改为按上述计算得到的方形尺寸自然显示，四周允许有空白。

### 3. 图片自适应旋转切块（重要新逻辑）
- 图片加载后读取 `naturalWidth / naturalHeight`：
  - **横向图**（`imgW > imgH`）：**画布顺时针旋转 90°** 转为竖版构图后再切块 —— 即在渲染层，`.board-ghost` 与所有 `.piece-fill` 的 `background-image` 都以旋转 90° 后的坐标系映射（等价于把原图旋转 90° 后再当作素材切）。
  - **竖图 / 正方形**（`imgW <= imgH`）：不旋转，保持原方向直接切块。
- **旋转仅在游戏对局渲染时临时生效**：
  - 原始上传图片文件 / URL 不修改；
  - 排行榜、图片存档、`selfieService` 上传占位、`imageService` 缓存等地方使用的都是原图，不要写回旋转后的数据。
- 旋转后再做 `pickGrid` 与 `generateGridPieces`，让 `cols/rows` 依据旋转后的宽高比来选，使竖屏观感更舒展。

### 4. 附加约束
- 棋盘始终 **正方形**（`aspect-ratio: 1 / 1`），当 `cols != rows` 时也保持整体外框方形 —— **强制 `cols = rows`**，具体做法：`pickGrid` 传入旋转后的 `imgW/imgH` 后，取 `n = round(sqrt(target))`，再 clamp 到 `[2, sqrt(target*1.2)]`；返回 `{ cols: n, rows: n }`。这样 9×9 = 81 块等高阶阶数天然覆盖。
- 所有阶数（含 9×9 / 10×10）统一遵守 50px 底线。
- 拖拽/点击识别区域 = `.piece` 元素本体，已自动跟随尺寸变化，无需额外改。

---

## 二、具体改动位置

### A. `app/utils/puzzle.ts`
- `pickGrid`：改为总是返回 `cols === rows` 的正方形网格。逻辑：
  ```ts
  export function pickGrid(blocks: number): { rows: number; cols: number } {
    const target = Math.max(4, Math.floor(blocks))
    const n = Math.max(2, Math.round(Math.sqrt(target)))
    return { rows: n, cols: n }
  }
  ```
  参数 `imgW/imgH` 可保留但不再影响结果（因为旋转已在上层完成，且棋盘正方形）。

### B. `app/composables/usePuzzleGame.ts`
- 新增响应式 `rotated = ref(false)`，在 `init()` 里预加载图片：
  ```ts
  const img = new Image()
  img.src = opts.imageUrl
  await img.decode().catch(() => {})   // 或用 onload
  rotated.value = img.naturalWidth > img.naturalHeight
  ```
  （若不想引入 async，可以用 `img.onload` 触发一次 `applyGrid()`；期间棋盘先隐藏或空态。）
- `pickGrid` 后 `cols === rows`，`generateGridPieces` 用旋转后的逻辑：如果 `rotated`，把 `boardW/boardH` 保持相等（例如仍为 720×720，因为棋盘方形），`bgX/bgY` 仍按 `row/col` 计算。
- 关键：旋转的语义 **只体现在渲染层的背景朝向**，`slotIndex/correctIndex/groupId` 逻辑完全不变。因此 composable 只需暴露 `rotated` 给 `PuzzleBoard` 使用。
- 返回值新增 `rotated`。

### C. `app/components/PuzzleBoard.vue`
- 接收新 prop `rotated: boolean`。
- `.board-ghost` 与 `.piece-fill` 的背景渲染在 `rotated=true` 时按 **顺时针旋转 90°** 的坐标系映射：
  - 简单实现：为 `.board-ghost` 和每个 `.piece-fill` 加 `transform: rotate(90deg); transform-origin: center;`，并交换背景尺寸的宽高。或者更稳的做法：单独包一层 `.rotated-canvas`，内部保持原坐标计算，外层 `rotate(90deg)`；但这样需要处理点击命中区。**推荐方案**：不做 CSS transform，而是**直接调换背景映射公式**——旋转 90° 顺时针的等价矩阵下：
    - `bgW/bgH` 交换；
    - 每片背景位置：原来 `bgX = col/(cols-1)*100%`，`bgY = row/(rows-1)*100%`。旋转后应为 `bgX = row/(rows-1)*100%`, `bgY = (cols-1-col)/(cols-1)*100%`（等价于把原图旋转 90° 顺时针后再切块）。
    - 需要额外把 `background-size` 从 `cols*100% x rows*100%` 改为 `rows*100% x cols*100%`，再交换 `bgX/bgY` 语义。请仔细验证公式，可用一张明显有方向感的横图人工核对。
  - `.board-ghost` 同样应用该规则：可以用 CSS `transform: rotate(90deg) scale(...)` 简化，只要视觉正确。**这个 ghost 只是半透明背景提示**，用 `transform: rotate(90deg)` 即可，但要注意 rotate 后需再翻转宽高填满 board。若实现麻烦，`rotated=true` 时直接把 `.board-ghost` 隐藏也可以接受。

- `.slot` / `.piece` 的定位（left/top/width/height）**不变**，因为格子拓扑不变。

### D. `app/components/PuzzleGame.vue`
- 移除 `measureChrome` 那一整套 `--chrome-h` 逻辑（不再需要按剩余高度铺满）。
- `.board-holder` 改为：
  ```css
  .board-holder {
    display: flex;
    justify-content: center;
    padding: 0 16px;          /* 左右 16px 安全边距 */
    width: 100%;
  }
  .board-holder :deep(.puzzle-wrap) {
    width: max(
      calc(var(--puzzle-n, 4) * 50px),
      min(calc(100vw - 32px), 560px)
    );
    max-width: none;           /* 移除 720px 上限 */
    aspect-ratio: 1 / 1;
  }
  ```
- 通过 `document.documentElement.style.setProperty('--puzzle-n', String(cols))` 把 `n` 写入 CSS 变量（`cols === rows`）；改到 `pieceCount / cols` 变化时同步一次即可。
- 让页面允许纵向滚动（`overflow-y: auto`），不再执意"一屏放下"。横向也允许溢出滚动（当 9×9 需要 450px 而窗口只有 400px 时）。

### E. `app/layouts/default.vue`（若有 `is-play` 强居中）
- 移除 `is-play` 路由下 `min-height: 100dvh; justify-content: center` 之类会把 game 强撑满一屏的规则，改为普通文档流；顶部/底部固定组件保留。

### F. 全站验证
- 检查 `pages/play/casual.vue`、`play/cloud.vue`、`play/selfie.vue` 是否有额外强制满屏样式，一并按上述规则松开。
- 排行榜、上传逻辑不动。

---

## 三、验收标准
1. 桌面 1440×900：4×4 棋盘约 560×560 居中，四周留白，不再拉到 720。
2. 手机 375×667：4×4 棋盘约 343×343（375-32），四周留白；9×9 时块 50px → 棋盘 450px，允许横向滚动。
3. 横向照片（如 1920×1080）导入后，棋盘里图像方向变为竖版（相当于原图顺时针 90°），切块也在旋转后的图上做。
4. 竖向照片导入后，方向保持不变。
5. 排行榜/上传保存的图片仍是原始方向的原图。
6. 拖拽拼图不受 50px 底线影响，触控体验不变。

---

## 四、交付要求
1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(board): 50px min piece, no forced fill, auto-rotate landscape images"`。
3. `git push origin master`（失败重试一次）。
4. 全过程自主完成，不要询问。
