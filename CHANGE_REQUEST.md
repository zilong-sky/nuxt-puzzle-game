# 拼图改造需求（缝隙 + 组合成块）

在当前 swap-only 版本基础上继续改。

## 1. 每块之间加缝隙
- 相邻格子渲染时留 **2px** 间隔（棋盘背景可见），视觉上像"分体的方块"。
- 缝隙**只出现在不同 group 之间**；同一 group 内相邻块渲染时缝隙消失，看起来就是一整块大图。

## 2. 组合成块（classic jigsaw group 逻辑）

### 定义
两块 A、B 属于**同一 group**，当且仅当：
- 它们在**当前棋盘位置**上相邻（行或列相差 1）
- 它们的**正确位置**也在**同一方向**上相邻（`correctIndex` 差值与当前 `slotIndex` 差值相同）

用 Union-Find 计算 groups。

### 时机
- **初始化**：随机洗牌后立即计算一次 groups（所以开局如果碰巧某几块位置对上了，它们直接就是一整块）。
- **每次交换/移动之后**：重算 groups（旧的可能拆散，新的可能合并）。

### 移动语义
- 点击 / 拖拽一个 group 里的任一块 == 选中整个 group。
- 拖拽时整个 group 跟手平移；松手时的位移换算成整数 (dx, dy) 单元格偏移。
- 目标位置：group 里每块的新 slotIndex = 原 slotIndex + delta。所有新位置必须都在棋盘内，否则弹回原位。
- **移动本质是"整组 swap"**：设 S = group 当前占的格子集合，D = S 平移后的格子集合。
  - S ∩ D 的格子：group 里对应的块直接留下（就是自己滑过去了）。
  - S \ D 的格子（group 空出来的）与 D \ S 的格子（新落点占用的别人）里的块**一一对调**：把新落点上原来那些块搬到 group 腾出来的空位（顺序：按 slotIndex 升序两两配对）。
- 单块 group（size = 1）时，行为退化到现有 swap。
- 点击-点击玩法保留：点选一个 group，再点另一格 → 计算 delta 做整组 swap。

### 拖拽手感
- 拖起来整个 group `scale(1.05)` + drop-shadow；跟手 rAF。
- 目标落点合法时高亮金色边（呼吸），非法（越界/无处安放）不高亮，松手弹回。

### 视觉提示
- 已经和"正确整图"对齐的 group（即 group 里每块都 `slotIndex === correctIndex`）加**淡金色描边**，看进度。
- 其他 group 用中性描边即可，取消之前每块单独的绿色描边（现在按组显示）。

## 3. 智能还原道具
- 改成：随机挑最多 3 个"未归位的块"，把它和它 `correctIndex` 那格上的块交换（可能触发合并）。逻辑不变，交换完记得重算 groups。

## 4. 兼容 & 收尾
- 三种模式（休闲/云冒险/自拍）走同一套。
- 胜利判定不变：所有块 `slotIndex === correctIndex`。
- `npm run build` 必须通过。
- `git add -A && git commit -m "feat: piece gaps and jigsaw group merging"` 然后 `git push origin master`（失败重试一次）。
- 全过程自主完成，不要询问。
