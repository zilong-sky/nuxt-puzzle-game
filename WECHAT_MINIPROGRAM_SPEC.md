# 拼图游戏 · 微信小程序移植规范（交付 Codex 用）

本文档 = 现有 Nuxt 4 版（https://nuxt-puzzle-game.vercel.app，仓库 `zilong-sky/nuxt-puzzle-game`）的**完整技术规格 + 逻辑规范 + 小程序端移植接入细节**。目标：让 Codex 只读本文件即可产出一款**行为、观感、体验完全对等**的微信小程序，无需回看 Web 源码。

> 沟通语言：中文。工作流：Codex 收到本规范后可直接开工，产出小程序完整工程。

---

## 0. 项目定位与三种模式

一款**移动优先**的拼图游戏，**核心玩法是"交换式拼图（swap puzzle）"**：整张图片切成 `cols × rows` 网格，每一格是一"块"，被打乱后玩家通过**拖拽或点选**把每一块移动到正确位置；相邻且位置正确的块**自动合并成"组"**，组内无缝隙、可整体拖动。

三种模式：

| 模式 | 图片来源 | 难度 | 是否计分 | 是否倒计时 |
| --- | --- | --- | --- | --- |
| **休闲模式 casual** | 服务端 / picsum 图库固定 30 张（顺序进入时打乱） | 进入前弹窗一次性选（4~50） | 否 | 有（用于失败判定，可看广告复活） |
| **云冒险 cloud** | 其他玩家上传的公开图片，按上传时间排序 | 每张随机 30~80 | 是（分 = 总块数） | 有 |
| **自拍上传 selfie** | 用户本地相册 / 摄像头拍照，支持多张 | 圆环自选，受视口与图片比例 clamp | 否 | 有 |

---

## 1. 目录结构建议（微信小程序原生框架）

如果 Codex 选择原生 WXML+WXSS+JS 方案（推荐；不建议用 Taro/uni-app 转译因为要压榨性能）：

```
miniprogram/
├── app.js                      // 全局 store、道具/每日次数 hydrate
├── app.json                    // 页面路由、tabBar、window
├── app.wxss                    // 全局样式变量：--color-primary 等
├── pages/
│   ├── index/                  // 三大模式入口
│   ├── play-casual/            // 休闲模式
│   ├── play-cloud/             // 云冒险
│   └── play-selfie/            // 自拍上传
├── components/
│   ├── puzzle-board/           // 核心棋盘（重要！）
│   ├── puzzle-game/            // HUD + 棋盘 + 道具栏 + 弹窗
│   ├── difficulty-dial/        // 圆环选难度
│   ├── difficulty-modal/       // 弹窗版本
│   ├── modal-dialog/           // 通用弹窗
│   └── ad-modal/               // 广告倒计时占位
├── utils/
│   ├── puzzle.js               // pickGrid / generateGridPieces / shuffle
│   ├── difficulty-limit.js     // computeMaxPieces
│   ├── time.js                 // formatTime / calcCountdown
│   └── storage.js              // wx.getStorageSync 封装
├── services/
│   ├── image-service.js        // fetchCasualImages / fetchCloudImages / uploadImage
│   └── ad-service.js           // 激励视频广告接入
└── stores/
    └── game-store.js           // 全局状态（可用 mobx-miniprogram 或纯对象+observer）
```

---

## 2. 数据模型

### 2.1 PieceState（每一块的状态）

```ts
interface PieceState {
  id: number            // 稳定唯一 id，作为组代表可用
  correctIndex: number  // 正确位置的 slot 索引（0..N-1）
  col: number           // 正确列（correctIndex % cols）
  row: number           // 正确行（floor(correctIndex / cols)）
  w: number             // 单元格逻辑宽（px 或 rpx）
  h: number             // 单元格逻辑高
  slotIndex: number     // 当前所在 slot 索引（0..N-1），拖动/点选时改变
  groupId: number       // 所在组的代表 pieceId，Union-Find 计算得到
  groupAligned: boolean // 该组每一块都在自己 correctIndex 上（视觉高亮金色）
}
```

**关键不变量**：
- 任意时刻，`pieces` 数组每个元素占据**恰好一个** slot；`slotIndex` 是全表唯一的置换。
- `id` 稳定不变（用于渲染 key、DOM 查询）。`correctIndex` 是"目标"，`slotIndex` 是"当前"。
- 完成条件：`∀ p, p.slotIndex === p.correctIndex`。

### 2.2 组（Group）语义

两块 A、B 属于同一组，当且仅当：
- **当前 slot 相邻**（同行相邻列 或 同列相邻行，步长 1）
- **且正确 slot 也在同方向相邻**（比如 A 在 B 的左边 slot，且 A 的 correctIndex 也在 B 的 correctIndex 左边）

用 Union-Find 一次扫全表得到（见 §5 算法）。**同组的块拖动时整体移动，视觉上内部无缝隙**（无边框、无阴影投在内部边）；**只有整组外围**才画阴影。

---

## 3. 核心算法（照抄 Web 版逻辑，几乎无需思考）

### 3.1 `pickGrid(pieceCount, imgW, imgH)` → `{cols, rows}`

按图片宽高比选择"最接近正方形单元格"的网格。

```js
function pickGrid(target, imgW, imgH) {
  const aspect = imgW / imgH
  let best = { cols: 2, rows: 2, score: Infinity }
  for (let cols = 2; cols <= 20; cols++) {
    const rows = Math.max(2, Math.round(cols / aspect))
    const total = cols * rows
    const totalPenalty = Math.abs(total - target) / target
    const cellRatio = (imgW / cols) / (imgH / rows)
    const ratioPenalty = Math.abs(Math.log(cellRatio)) // 单元格越接近正方形越好
    const score = totalPenalty * 3 + ratioPenalty
    if (score < best.score) best = { cols, rows, score }
  }
  return { cols: best.cols, rows: best.rows }
}
```

### 3.2 `generateGridPieces(cols, rows, imgW, imgH)` → `Piece[]`

```js
function generateGridPieces(cols, rows, imgW, imgH) {
  const w = imgW / cols, h = imgH / rows
  const pieces = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      pieces.push({ id: idx + 1, correctIndex: idx, col: c, row: r, w, h })
    }
  }
  return pieces
}
```

### 3.3 `shufflePieces(indices)` — Fisher-Yates

```js
function shufflePieces(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

初始化时对 `[0, 1, ..., N-1]` 洗牌得到 `indices`，把 `pieces[i].slotIndex = indices[i]`。若打乱后与原顺序相同（所有块归位），最多重试 5 次。

### 3.4 `recomputeGroups()` — Union-Find 求组

对全体 N 块，两轮扫描：

```
parent[i] = i for all
for each piece p at index i:
  sc = p.slotIndex % C; sr = floor(p.slotIndex / C)
  pc = p.correctIndex % C; pr = floor(p.correctIndex / C)
  // 右邻居
  if sc < C-1 and 存在 j 使 pieces[j].slotIndex == p.slotIndex + 1:
    q = pieces[j]; qc = q.correctIndex%C; qr = floor(q.correctIndex/C)
    if qr == pr and qc == pc + 1: union(i, j)
  // 下邻居
  if sr < R-1 and 存在 j 使 pieces[j].slotIndex == p.slotIndex + C:
    q = pieces[j]; qc = q.correctIndex%C; qr = floor(q.correctIndex/C)
    if qc == pc and qr == pr + 1: union(i, j)
groupId[i] = pieces[find(i)].id
groupAligned[gid] = ∀ member: member.slotIndex == member.correctIndex
```

**性能技巧**：写回 `piece.groupId / groupAligned` 时先判断"值真的变了"才赋值，避免小程序 setData 无谓开销。

### 3.5 `moveGroup(pieceId, dCol, dRow)` — 批量交换

```
anchor = pieces.find(p => p.id === pieceId)
gid = anchor.groupId
groupPieces = pieces.filter(p => p.groupId === gid)
S = groupPieces.map(p => p.slotIndex)  // 源 slot 集合
D = groupPieces.map(p => p.slotIndex + dCol + dRow * C)  // 目标 slot 集合
每个目标 slot 都必须在棋盘内，否则整体拒绝
displaced = 位于 D 集合但不在 S 集合的其他块（按 slotIndex 升序）
freeSlots = S 中不在 D 里的空 slot（按 slotIndex 升序）
if displaced.length != freeSlots.length: 拒绝
// 一次性写回：整组按位移到 D，被顶走的块按顺序填 freeSlots
for s in shifts: s.piece.slotIndex = s.newSlot
for k in [0..displaced.length): displaced[k].slotIndex = freeSlots[k]
recomputeGroups()
checkFinished()
```

### 3.6 `moveGroupToSlot(pieceId, targetSlot)`

用锚点差值算出 `(dCol, dRow)`，转调 `moveGroup`。用于"点选 A → 点选 B" 的整组换位。

### 3.7 `computeMaxPieces({ imgW, imgH })` — 自拍模式难度上限

```js
function computeMaxPieces({ imgW, imgH }) {
  // 视口内接矩形（同 puzzle-game 里的 wrapSize 逻辑）
  const vw = wx.getSystemInfoSync().windowWidth
  const vh = wx.getSystemInfoSync().windowHeight
  const aspect = imgW / imgH
  const maxW = Math.min(vw - 32, 560)
  const maxH = Math.min(vh - 240, 900)
  let w = maxW, h = w / aspect
  if (h > maxH) { h = maxH; w = h * aspect }
  const MIN_CELL = 50 // 每格最少 50px，保证手指点得到
  const cols = Math.max(2, Math.floor(w / MIN_CELL))
  const rows = Math.max(2, Math.floor(h / MIN_CELL))
  const raw = Math.floor(cols * rows * 0.85) // 0.85 保守系数
  return Math.max(4, Math.min(200, raw))
}
```

### 3.8 `calcCountdown(pieceCount)` — 倒计时

```js
export const calcCountdown = n => 60 + n * 4
```

---

## 4. 页面 & 组件规格

### 4.1 首页 `pages/index/`

三张卡片：休闲 / 云冒险 / 自拍上传。云冒险点开先弹说明（每日 5 局免费、超出可看广告 +1 或付费永久解锁），点"进入云冒险"若无次数则禁用。

顶部展示 `游戏名 · 选择你的拼图模式`。

### 4.2 `components/difficulty-dial/`（**关键 UI 组件**）

**270° 圆环选值滑块**，替代传统 slider。规格：

- SVG viewBox `0 0 240 240`，圆心 `(120, 120)`，半径 `92`
- 弧线角度定义（0° = 12 点方向，顺时针为正）：
  - `START_DEG = 315`（约 10:30 方向，min 端，**左上**）
  - `END_DEG = 45`（约 1:30 方向，max 端，**右上**）
  - `SPAN_DEG = 270`
  - 弧线从 315° 顺时针经底部（270→180→90→45），值**左低右高**
  - **开口在正上方（12 点±45°），中央为死区**：手指落在死区时吸附到较近端
- 元素：灰色 track + 金色 progress 弧 + 白圆 knob（描边金）
- **中央文本 y 坐标**：数值 `y=69`（**上移至开口内**，手指按住时不被遮），标签 `y=99`；数值 fontSize=48 bold，标签 fontSize=12 soft
- `pointerToValue(cx, cy)` 转换：`atan2(dx, -dy)` → clockDeg → `t=(START_DEG - clockDeg)/SPAN_DEG`，clamp 到 [0,1]，映射到 [min, max]
- 支持键盘：←↓ -1 步 / →↑ +1 步 / PageUp/Down ±10 / Home/End 到端点
- v-model 化，emit `update:modelValue`

微信小程序实现：`<canvas type="2d">` 或 SVG（小程序 SVG 支持有限，**用 canvas 2d 绘制圆环 + touchstart/touchmove/touchend 处理拖动**）。数值文字用 `<view>` 绝对定位覆盖在 canvas 中央上方（避开手指遮挡）。

### 4.3 `components/difficulty-modal/`

蒙层弹窗，包含 `difficulty-dial` + `选择难度` 标题 + `左低右高，滑动圆环选择` 提示 + "取消 / 开始游戏" 双按钮。`open` prop 打开时把 `local = initial`。

### 4.4 `components/puzzle-board/`（**最核心组件**）

#### 视觉结构

```
.puzzle-wrap
  .board (position:relative, 背景灰 #c8ccd6, 圆角, overflow:hidden)
    <img class="board-ghost" src="{imageUrl}" style="opacity:0.1; filter:blur(1px) grayscale(0.4)"/>
    <view v-for="s in slots" class="slot" data-slot="{s.index}" 绝对定位百分比 />
    <view v-for="p in pieces" class="piece" data-piece-id="{p.id}"
          style="position:absolute; width/height/left/top 用百分比" >
      <view class="piece-fill" style="通过 neighborInsets 计算内缩 + 背景图切片 + 阴影" />
    </view>
```

**背景图切片映射（同一张原图 CSS 平铺缩放）**：

```
piece-fill.style:
  backgroundImage: url(imageUrl)
  backgroundSize: `${cols*100}% ${rows*100}%`
  backgroundPosition: `${p.col/(cols-1)*100}% ${p.row/(rows-1)*100}%`
```

这样每一块只显示原图的对应 1/N 区域，全局是原图的重复"放大后错位裁剪"。**小程序里 `<view>` 的 background-image 支持 url，方案完全通用**。

#### `neighborInsets(p)` — 内边距 & 阴影控制

对块 p 的四邻（上下左右）：如果邻居存在且 `groupId === p.groupId`，则该边 inset = 0（无缝贴合）；否则 inset = 1px 且画侧向 1px 阴影 `rgba(0,0,0,0.15)`。若 `p.groupAligned=true` 追加金色 3px 8px 阴影 `rgba(212,175,55,0.55)`。

#### 拖动逻辑（**移植难点，务必照抄下面的状态机**）

Web 版用 `pointerdown/pointermove/pointerup`。**小程序端映射到 `catchtouchstart/catchtouchmove/catchtouchend`**（在 `.piece` 上绑定，touchcancel 视作 up）。

**DragState 状态**：

```js
{
  pieceId, groupId, pointerId (=changedTouches[0].identifier),
  startX, startY,      // touchstart 的 pageX/pageY
  boardRect,           // wx.createSelectorQuery 一次性拿到 board 的 boundingClientRect
  moved: false,        // 位移是否超过 CLICK_THRESHOLD=6px
  curDx, curDy,        // 最新位移
  members: [PieceState], // 同组所有块
  memberIds: [id],       // 用于 setData 时索引
  lastDCol: -9999, lastDRow: -9999, // 上一次量化的整格位移
  activeSlotIndices: Set  // 悬停高亮的 slot 集合
}
```

**touchstart(id)**：
1. 记录 startX/Y、pointerId、初始化 memberIds = 同组所有 piece 的 id
2. 通过 `SelectorQuery` 拿一次 board 的 rect（**不要每次 move 都查**，非常慢）

**touchmove**：
1. 取 `touches[0]`，计算 `dx = pageX - startX, dy = pageY - startY`
2. 若 `!moved && hypot(dx,dy) > 6`：置 `moved=true`；把 board 置 `is-dragging` 状态；把 `memberIds` 里所有块加 `dragging` class
3. 更新 `curDx/curDy`；**用 CSS 变量驱动位移**：
   - 小程序 `<view>` 支持 `style="--drag-dx:{{drag.dx}}px; --drag-dy:{{drag.dy}}px"` 吗？—— **不支持自定义 CSS 变量的动态更新**（wxss 不认自定义属性），改用**内联 transform**：
   - `style="transform: translate3d({{drag.dx}}px, {{drag.dy}}px, 0) scale(1.05); z-index:999"`
   - **性能陷阱**：小程序 setData 有传输成本，**不能对整组每一块单独 setData**。做法：
     - 只把 `drag.dx / dy` 一个字段 setData（原对象引用），WXML 上写 `wx:for="pieces"` 时对 `dragging === piece.id` 的成员应用 transform
     - 或者**用小程序官方 `wx.createAnimation` / `worklet`**：`transform` 通过 `worklet` 在 native 层驱动，无需 setData → **推荐使用 [WXS 响应事件](https://developers.weixin.qq.com/miniprogram/dev/framework/view/interactive-animation.html) / [Skyline worklet](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/wxs.html)**：把 touchmove 处理放 WXS 里，直接改 DOM style，绕过 setData 60fps
4. 量化 `dCol = round(dx / cellW), dRow = round(dy / cellH)`；若变化则调用 `computeGroupMoveInto` 检查合法性，`applyHoverTargets` 高亮目标 slots

**touchend**：
1. 计算最终 `dCol, dRow`
2. **先同步清视觉**：所有 memberIds 的 dragging 移除、transform 归零（避免松手→setData 完成之间的闪烁）
3. 清 hover 高亮，移除全局监听
4. 若 `moved`：`emit('moveGroup', pieceId, dCol, dRow)` 交给 puzzle-game 调 store
5. 若未 `moved`（点击）：selectedGroupId 三态逻辑 —— 无选中 → 选中当前组；点自己 → 取消；点别的组 → `emit('moveGroupToSlot', anchor.id, thisPiece.slotIndex)`

**松手动画**：`.piece` 的 `transition: left/top var(--swap-ms) cubic-bezier(0.2,0,0,1)`；**当 `cols*rows >= 80` 时 swapMs = 60ms，否则 120ms**（大棋盘更利落）。松手瞬间 `.piece.dragging` class 已被同步移除，transform 归零，因此左/上属性的过渡自然接管。

**渲染优化**：
- Vue 版用 `v-memo`，小程序对应：
  - 每个 piece 用**独立子组件** `piece-cell`，只把它需要的字段传进去（`slotIndex/groupId/groupAligned/cols/rows/imageUrl/selected`）
  - 组件内部 `observers` 只在必要字段真变时才重算 style
  - 或者启用 Skyline 渲染引擎，性能天差地别，官方鼓励用于游戏类小程序

### 4.5 `components/puzzle-game/`

组合：`.hud`（左：模式标签+倒计时，右：进度 X/N + 得分）+ `.board-holder`（放 puzzle-board + 加载覆盖层）+ `.items`（🧠智能还原 + ❄️时间冻结 + 退出）+ 成功/失败弹窗 + 广告复活弹窗。

**wrapSize（棋盘容器尺寸）**：

```
vw = windowWidth; vh = windowHeight
maxW = min(vw - 32, 560); maxH = min(vh - 240, 900)
按图片 aspect 内接：先尝试 w=maxW, h=w/aspect；若 h>maxH 则 h=maxH, w=h*aspect
最后 clamp 每格 >=50px：w = max(w, cols*50); h = max(h, rows*50)
```

**加载覆盖层（loading overlay）**：半透明白背景 + 卡片（"正在加载图片…" + 金色进度条 + 百分比数字），显示条件 `loading === true`。

### 4.6 `pages/play-casual/`

进入流程：
1. `onLoad` 拉图库（30 张 seed 固定），**Fisher-Yates 洗一次顺序**
2. **弹 difficulty-modal（`:max=50 :initial=25`），必选一次**，取消则返回首页
3. 确认后进入 puzzle-game，通关点"下一张" → `idx = (idx+1) % list.length` 只切图，**不再弹难度**

### 4.7 `pages/play-selfie/`

- 上方标题 + 两个入口按钮："📸 摄像头拍照"（小程序用 `wx.chooseImage` 或 `<camera>` 组件）+ "🖼 相册选择（可多选）"（`wx.chooseMedia({ count: 9, mediaType: ['image'] })`）
- **本地缓存**：`wx.getStorageSync('puzzle-selfie-images-v1')` → 数组 dataURL（**小程序建议存 file 路径而非 dataURL**，因为 storage 上限 10MB，图片文件路径更省）。
  - `key = 'puzzle-selfie-images-v1'`，每次 `images` 变化 `wx.setStorageSync` 写回
  - **单张 file 大小 > 1.5MB 的跳过缓存**（`wx.getFileInfo` 拿 size）
  - 总量 > 4MB 截断
  - 写失败自动清 key
  - `onLoad` 读缓存 → 回显 → 对最后一张测尺寸更新 maxPieces
- 预览宫格 + "已保存 X 张，下次进入自动回显" + "清空"按钮
- 圆环 difficultyDial（`:min=4 :max={maxPieces} :label='切块数'`）+ 🎲随机难度 + 提示"根据当前手机屏幕和图片比例，最高难度 N 块"
- watch `maxPieces` → 若 `pieceCount > maxPieces` 自动 clamp
- 开始拼图 → 依次玩每一张 → 单张通关弹"是否推荐到云图库"

### 4.8 `pages/play-cloud/`

从服务端拉列表（暂时 mock 20 张），每张随机 30~80 难度。每玩一张扣一次 `dailyPlaysLeft`（非 premium 用户），通关计分入 `rankHistory`，最高分更新。

---

## 5. 全局状态（gameStore）

```js
{
  items: { restore: 1, freeze: 1 },  // 道具库存
  dailyDate: '2025-11-06',           // 上次玩云冒险的日期
  dailyPlaysLeft: 5,                 // 今日剩余次数
  premium: false,                    // 是否永久解锁
  highScore: 0,
  rankHistory: [],
  initialized: false
}
```

**hydrate（onLaunch 调用）**：从 storage 恢复，若 `dailyDate !== todayString()` 重置 `dailyPlaysLeft = 5` 并更新 date。

**actions**：`consumeCloudPlay / grantExtraPlay / unlockPremium / submitCloudScore / useItem / addItem`，每次修改后 `wx.setStorageSync`。

storage keys：

```
puzzle:daily-date, puzzle:daily-plays, puzzle:premium,
puzzle:high-score, puzzle:rank-history, puzzle:items
```

---

## 6. 图片加载与旋转（自拍/云图片）

Web 版 `usePuzzleGame.init()` 分四段进度：

| 阶段 | 进度 | 逻辑 |
| --- | --- | --- |
| A. fetch | 0→60 | dataURL/blob 直接跳 60；网络图 fetch 读 content-length 精确进度，无 length 则 30/60 阶跃 |
| B. decode | 60→80 | `Image().decode()` 或 onload |
| C. rotate | 80→90 | **竖屏视口 + 横图** → 用 canvas 2d 顺时针旋转 90° 生成 dataURL 作为 `renderImageUrl` |
| D. grid | 90→100 | pickGrid + generateGridPieces + shuffle + 生成 PieceState 数组 |

**小程序对等实现**：

- fetch → `wx.downloadFile` 拿本地临时路径（**无进度回调时用 30/60 阶跃**），或直接对 `chooseImage` 拿的 `tempFilePath` 跳 60
- decode → `wx.getImageInfo({ src })` 拿 `width/height`（相当于 onload）
- rotate → `wx.createOffscreenCanvas` 2D 上下文，`ctx.translate + ctx.rotate(π/2) + ctx.drawImage`，然后 `canvas.toTempFilePath` 拿新路径
- 存"上一次的临时 canvas 路径"，切换图片时不需要显式 revoke，小程序会自动清理

---

## 7. 关键交互约束（务必逐条对齐）

| # | 约束 | 为什么 |
| --- | --- | --- |
| 1 | 棋盘一屏可见，不允许纵向滚动 | 移动端体验 |
| 2 | 每格最少 50px | 手指点得到 |
| 3 | 图片按原比例映射到棋盘（非拉伸） | 视觉美感 |
| 4 | 竖屏 + 横图自动旋转成竖版 | 避免棋盘变得太扁 |
| 5 | 拖动时被拖块 `scale(1.05)` + 阴影 | 明显反馈 |
| 6 | 同组邻居间 0 内边距、0 阴影 | 组视觉一体化 |
| 7 | 松手前**先同步清视觉**再 emit | 消除感知延迟 |
| 8 | 大棋盘（≥80 块）swap 过渡 60ms，否则 120ms | 大棋盘更利落 |
| 9 | 圆环数字 y=69（上移到开口内） | 手指按住时不遮 |
| 10 | 休闲模式弹窗只选一次难度 | 避免每张都问 |
| 11 | 自拍缓存单张 >1.5MB / 总量 >4MB 有保护 | 避免爆 storage 配额 |
| 12 | groupAligned 才画金色光晕，仅外围 | 引导玩家看到"已完成的组" |

---

## 8. 样式变量（app.wxss）

```css
page {
  --color-primary: #4a7dbf;
  --color-primary-dark: #365a91;
  --color-danger: #d94b4b;
  --color-warning: #d97706;
  --color-text: #222;
  --color-text-soft: #888;
  --color-border: #d0d0d0;
  --radius-md: 12rpx;
  --shadow-sm: 0 2rpx 8rpx rgba(0,0,0,0.08);
  --shadow-md: 0 4rpx 16rpx rgba(0,0,0,0.12);
}
```

（小程序变量在 wxss 里以 `var(--x)` 使用；`rpx` 是响应式像素，1rpx = 屏宽/750）

---

## 9. 服务接口占位（未来对接）

```js
// services/image-service.js
export async function fetchCasualImages() {
  // TODO: 换成 wx.request 拉后端
  const seeds = ['aurora','forest','ocean',/* ...30 个 */]
  return seeds.map((seed, i) => ({
    id: i + 1,
    url: `https://picsum.photos/seed/${seed}/800/600`,
    title: seed
  }))
}
export async function fetchCloudImages() { /* mock 20 张 */ }
export async function uploadImage(filePath) {
  // TODO: wx.uploadFile → POST /api/images/upload
}
```

**注意小程序合法域名白名单**：`picsum.photos` 需要在小程序管理后台"服务器域名"里配置 `request 合法域名`。开发阶段可以在开发者工具里勾"不校验合法域名"绕过。

---

## 10. 广告与付费

- 激励视频 `wx.createRewardedVideoAd({ adUnitId })` → 看完 15s 视频给 `+1 daily play`
- 复活广告：失败弹窗点"📺 看广告复活"，看完 → `reviveByAd()` 重置倒计时
- 付费永久解锁：`wx.requestPayment`（小程序需接微信支付商户号），付款成功 → `unlockPremium()`

MVP 阶段：Codex 可先做占位（`ad-modal` 用 2 秒倒计时假装播广告），后续接真广告位。

---

## 11. 性能与兼容性

- **建议开启 Skyline 渲染引擎**（`app.json` 里 `"renderer": "skyline"`），性能远超 WebView，接近原生；拖拽 60fps 无压力
- 拖动过程中的位移**必须用 WXS 或 worklet 处理**，setData 顶不住 60fps（尤其 100 块以上）
- 每块作为独立组件（自定义组件），`observers` 里做增量计算
- iOS 上 `<canvas>` 需要用 `type="2d"` 新版 canvas，别用 old canvas
- `touch-action: none` 在小程序里不需要（原生就无浏览器手势）
- 图片加载失败降级：显示默认灰底 + "加载失败"文字

---

## 12. 测试清单（Codex 交付前自检）

- [ ] 三大模式入口能进入
- [ ] 休闲模式弹窗只出现一次，`max=50 initial=25`，取消返回首页
- [ ] 拼图初始化：图片按比例 fit，棋盘不超屏，加载覆盖层显示进度 0→100%
- [ ] 竖屏 + 横图自动旋转成竖版
- [ ] 单块拖动：松手前 scale(1.05)+阴影，松手后落到最近格子，被顶走的块换位
- [ ] 相邻拼对：自动组成组，内部无缝
- [ ] 拖同组任意一块：整组一起移动，跟手
- [ ] 点选 A → 点选 B：整组 A 与位于 B 的块换位
- [ ] 通关：弹成功弹窗，可"下一张"
- [ ] 时间到：弹失败，可看广告复活重置时间
- [ ] 自拍上传：本地图 + 摄像头 → 缓存回显 + "清空"按钮清缓存 + 圆环选难度 clamp
- [ ] 圆环：值左低右高，开口在正上方，中央数字在开口内
- [ ] 大棋盘（如 50 块）拖动流畅、松手快
- [ ] 首页显示历史最高分 & 今日剩余次数
- [ ] 云冒险每玩一局扣次数，5 次用完弹"看广告 +1 / 付费永久"

---

## 13. Codex 开发建议顺序

1. **搭骨架**：`app.json` + `pages/index/` + tabBar + gameStore + storage 封装
2. **DifficultyDial**：canvas 2d 绘制圆环 + touch 事件 → v-model 数值。这是全项目最复杂的 UI 组件，先啃下
3. **PuzzleBoard**：pickGrid + generateGridPieces + 静态渲染。**用 Skyline + WXS/worklet 驱动拖动**，先做单块拖动，再做组
4. **组算法**：Union-Find + neighborInsets + 松手交换
5. **PuzzleGame**：包 HUD + 道具 + 弹窗
6. **三大模式页面**：休闲 / 云冒险 / 自拍上传
7. **图片加载 + 旋转 + 进度**：offscreen canvas
8. **激励广告 + 付费**（可最后接）
9. **自检 → 提审**

---

## 14. 参考 Web 版源码（对齐时可反查）

仓库：https://github.com/zilong-sky/nuxt-puzzle-game

| 文件 | 作用 |
| --- | --- |
| `app/composables/usePuzzleGame.ts` | 状态机 + 算法（**逻辑基准**） |
| `app/components/PuzzleBoard.vue` | 棋盘 + 拖动交互（**移植核心**） |
| `app/components/PuzzleGame.vue` | HUD + 弹窗 + 加载覆盖层 |
| `app/components/DifficultyDial.vue` | 圆环选难度 |
| `app/components/DifficultyModal.vue` | 弹窗版难度 |
| `app/pages/play/casual.vue` | 休闲模式 |
| `app/pages/play/selfie.vue` | 自拍上传 + 缓存 |
| `app/utils/puzzle.ts` | pickGrid / generate / shuffle |
| `app/utils/difficultyLimit.ts` | computeMaxPieces |
| `app/utils/time.ts` | calcCountdown |
| `app/services/imageService.ts` | 图库接口占位 |
| `app/stores/gameStore.ts` | Pinia 全局状态（对齐 game-store.js） |

Codex 遇到任何**行为歧义**都以 Web 版实际表现为准，可访问部署站 https://nuxt-puzzle-game.vercel.app 实机对比。

---

**完。** 本规范应足够 Codex 无源码盲盒式产出一款视觉、体验、算法完全对等的微信小程序版本。若某项接不通（如激励视频 adUnitId、微信支付商户号未申请），先做占位并在 README 里标 TODO 交付。
