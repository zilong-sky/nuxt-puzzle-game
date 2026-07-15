# 两处修复

## 一、松手后块没交换（回归 bug）

### 根因
上一版把 `pieces` 从 `ref` 改成 `shallowRef` + `triggerRef` 时，忽略了一件事：
- `moveGroup` 内部通过 `p.slotIndex = newSlot` 深层属性变更移动块。
- `shallowRef` 不追踪深层。`triggerRef(pieces)` 虽让**直接消费者**（PuzzleGame 父组件 render）重跑，但 `<PuzzleBoard :pieces="pieces">` 传入的是**同一个数组引用**。
- 子组件 PuzzleBoard 的 `props.pieces` 引用未变，Vue 不会重新渲染 `<div v-for="p in pieces">` 的子节点 → **块视觉上停在原位**。

### 修改（`app/composables/usePuzzleGame.ts`）
**把 `pieces` 改回普通 `ref`**（深响应式），撤销 shallowRef/triggerRef 相关代码：

```ts
import { computed, onUnmounted, ref } from 'vue'   // 删掉 shallowRef, triggerRef

// ...
const pieces = ref<PieceState[]>([])               // 改回 ref
// ...

function moveGroup(pieceId, dCol, dRow) {
  // ... 逻辑不变
  recomputeGroups()
  // 删掉 triggerRef(pieces)
  checkFinished()
  return true
}
```

### 备注
上一版加 shallowRef 的初衷是减少 81 次深响应 flush，实测收益有限（因为 `.piece` 已经删了动态 class 绑定，Vue 层面重算量很小）。回归 ref 保证正确性，性能不会退化。

---

## 二、圆环方向：从左往右 = 从低到高

### 现状
`DifficultyDial.vue` 里 `START_DEG=45`（右上）, `END_DEG=315`（左上），`SPAN_DEG=270`，用 SVG 顺时针约定。当前值增大方向：**从右上顺时针 → 底部 → 左上**，即从右向左递增。用户要反过来：**从左往右递增**，即最小值在左上，最大值在右上，弧线从左上经底部到右上顺时针。

### 修改（`app/components/DifficultyDial.vue`）
把常量对调，并把 `value ↔ angle` 映射方向反转：

```ts
// SVG 约定：12 点 = 0°，顺时针为正
// 目标：弧从左上（315°）顺时针经底部（180°）到右上（45°），
// 值从 min(最左) 到 max(最右) 递增
const START_DEG = 315   // min 侧（左上，10:30 位置）
const END_DEG   = 45    // max 侧（右上，1:30 位置）
const SPAN_DEG  = 270   // 顺时针跨度

// value → angle: 顺时针从 START_DEG 走 t * SPAN，模 360
function valueToAngle(v: number): number {
  const t = (v - props.min) / (props.max - props.min)
  return (START_DEG + t * SPAN_DEG) % 360
}

// angle(clockDeg) → t：把 clockDeg 从 START_DEG 起顺时针换算成 [0, SPAN_DEG]
// 若落在死区（顶部 315°..360° ∪ 0°..45° 的**开区间**外，即缺口就是 45°..315° 顶部一段？
// 等等，缺口在正上方 12 点两侧 ±45° = 315°..360°(=0°) ..45°
// 有效弧是 45° 顺时针经 90/180/270 到 315°，跨度 270°
// 那么"从 START_DEG=315° 顺时针"到 END_DEG=45° 也是 270°，路径正确）
function pointerToValue(clockDeg: number): number {
  // 顺时针相对 START_DEG 的位移
  let delta = (clockDeg - START_DEG + 360) % 360
  // delta in [0, 360)：[0, SPAN_DEG] 是有效弧，(SPAN_DEG, 360) 是缺口
  if (delta > SPAN_DEG) {
    // 死区：吸附到最近端点
    // 缺口中点是 (SPAN_DEG + 360) / 2 = 315°；delta 更靠 360 侧吸到 t=0，更靠 SPAN_DEG 侧吸到 t=1
    const distToEnd = delta - SPAN_DEG          // 到 END 端的角距
    const distToStart = 360 - delta             // 到 START 端的角距
    const t = distToStart < distToEnd ? 0 : 1
    return props.min + t * (props.max - props.min)
  }
  const t = delta / SPAN_DEG
  return props.min + Math.round(t * (props.max - props.min))
}
```

**弧线 path 计算**同样按 START=315°→END=45° 顺时针画：
```ts
// 起点：angle=315° 对应 12点顺时针 315° → SVG 坐标 (cx + r*sin(315°), cy - r*cos(315°))
// = (cx - r*√2/2, cy - r*√2/2)  即左上
// 终点：angle=45° 对应 (cx + r*sin(45°), cy - r*cos(45°)) = (cx + r*√2/2, cy - r*√2/2) 即右上
// large-arc-flag = 1（270° > 180°），sweep-flag = 1（顺时针）
```
把 `<path d="M startX startY A r r 0 1 1 endX endY" />` 用上面新的 start/end 点写。**进度弧**同理，只到当前值对应角度为止。

**把手位置**：`angle = valueToAngle(currentValue)`，坐标同上映射。

**键盘方向**：
- ArrowRight / ArrowUp: 值 +step
- ArrowLeft / ArrowDown: 值 -step
- Home = min, End = max
（现在直觉上"右 = 更多"，语义一致）

---

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "fix(swap): restore reactive pieces; feat(dial): left→right low→high"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
