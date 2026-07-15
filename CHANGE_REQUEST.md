# 两处修复

## 一、松手后交换卡顿

### 现象
拖动跟手很顺。但**松手瞬间**要等一小会儿才看到目标块交换过来，明显有延迟感。

### 根因
`onPointerUp` 里同步执行的链路是：
1. `emit('moveGroup', ...)` → 父组件 `usePuzzleGame.moveGroup` → `recomputeGroups()`（遍历所有 piece）+ `checkFinished()`（再遍历一遍）
2. 之后 Vue 触发所有 `.piece` 的 `pieceStyle` 重算（left/top 变了，slotIndex 变了，groupId 可能变了，groupAligned 可能变了）
3. `.piece` 上的 `transition: left 0.15s, top 0.15s` 走 150ms 过渡动画

在 9×9 = 81 个 piece 时，第 1、2 步的响应式 diff + 样式重算耗时明显，用户先看到"松手 → 卡一下 → 才开始飞过去"。

另外 `dragEl.classList.remove('dragging')` 在 `emit` 之后执行，`dragging` 状态下 transition 被冻结；等 emit 触发响应式重算 + Vue 下一次 flush 之后才移除 class，这段时间 piece 已经"逻辑上"到了新位置但**视觉上**还在旧的 `translate3d` 上 —— 移除 class 后瞬间才播放 left/top transition，用户感觉的"松手到看到动"就是这段时间差。

### 修改（`app/components/PuzzleBoard.vue`）

1. **松手时先立即清视觉状态，再 emit**（顺序反过来）：
   ```ts
   function onPointerUp(e: PointerEvent) {
     if (!drag || e.pointerId !== drag.pointerId) return
     const wasDrag = drag.moved
     const pid = drag.pieceId
     const cellW = drag.boardRect.width / props.cols
     const cellH = drag.boardRect.height / props.rows
     const dCol = Math.round(drag.curDx / cellW)
     const dRow = Math.round(drag.curDy / cellH)

     // 1) 先把 dragEl 的 --drag-dx/dy 归零并移除 dragging class
     //    并且清 hover slot、board.is-dragging —— 这些都是 DOM 直操作，同步立即生效
     const dragEl = drag.dragEl
     const boardEl = getBoardEl()
     if (dragEl) {
       dragEl.classList.remove('dragging')
       dragEl.style.setProperty('--drag-dx', '0px')
       dragEl.style.setProperty('--drag-dy', '0px')
     }
     if (boardEl) boardEl.classList.remove('is-dragging')
     clearHoverTargets()

     window.removeEventListener('pointermove', onPointerMove)
     window.removeEventListener('pointerup', onPointerUp)
     window.removeEventListener('pointercancel', onPointerUp)
     drag = null

     if (wasDrag) {
       if (dCol === 0 && dRow === 0) return
       // 2) 再触发状态变更 —— 此时视觉上 dragEl 已经就绪好过渡
       emit('moveGroup', pid, dCol, dRow)
       return
     }
     // ... 点击分支保持不变
   }
   ```

2. **`.piece` 的 left/top transition 缩短并换更快曲线**：
   ```css
   .piece {
     transition: left 0.12s cubic-bezier(0.2, 0, 0, 1),
                 top  0.12s cubic-bezier(0.2, 0, 0, 1);
   }
   ```
   150ms → 120ms，曲线换成 fast-out（起手快，末尾平滑）。

3. **`recomputeGroups` 内部微优化**（`app/composables/usePuzzleGame.ts`）：
   - 当前实现每次 move 后遍历所有 piece 构建 `slotToIdx` map + union-find。9×9 = 81 元素，操作量 O(N)，本身不慢。**真正慢的是响应式 trigger**：`recomputeGroups` 里对每个 piece 都写 `p.groupId = ...; p.groupAligned = ...`，触发 81 * 2 次响应式依赖 flush。
   - 改用批量：把 `pieces.value` 整个替换成新数组，而不是逐字段写 —— Vue 3 shallowRef 或 markRaw 优化空间大。但改动风险偏大，**先做低风险优化**：
     ```ts
     // 在 recomputeGroups 内一次性写入，包装 nextTick 之前先算完
     // 具体：先把 nextGroupId/nextAligned 存到局部 array，遍历结束一次性赋值
     ```
     其实这个和逐条写效果差不多。**真要提速**：把 `PieceState.groupId/groupAligned` 从 ref 元素的属性改成用两张外部 Map（groupIdMap / groupAlignedMap，Vue 响应式），模板里通过 `groupIdMap.get(p.id)` 读。这样只有 Map 变更一次触发一次依赖 flush。
   - **实际改法（更简单更有效）**：在 `usePuzzleGame.ts` 里把 `pieces` 从 `ref` 改成 `shallowRef`，`moveGroup` 结束时手动 `triggerRef(pieces)` 一次。这样 81 次字段写入不会各自触发响应式，只在最后统一 flush。
     ```ts
     import { shallowRef, triggerRef } from 'vue'
     const pieces = shallowRef<PieceState[]>([])
     // ... moveGroup 结束前：
     recomputeGroups()
     triggerRef(pieces)
     checkFinished()
     ```
     `PuzzleBoard.vue` 里 `v-for="p in pieces"` 依然正常工作（shallowRef 支持模板解包）。**注意**：`pieceStyle(p)` 里读 `p.slotIndex` 等仍然生效，因为整个数组引用变了（触发 refresh），子字段读取不会漏。
     ⚠️ 检查是否有别处依赖 `pieces.value[i].xxx` 的深响应式（例如 timer 里改 pieces？看代码没有，安全）。

## 二、圆环开口方向：改成开口在上、弧在下

### 现状
`DifficultyDial.vue` 用的是 `startAngle=-135°, endAngle=135°`（12点为 0°，顺时针为正）—— 弧从左下顺时针经过 12点 到右下，**缺口在底部**。用户想反过来：**缺口在正上方（12点方向），弧在底部**。

### 修改（`app/components/DifficultyDial.vue`）
- 有效弧参数换成：
  ```ts
  const START_ANGLE = 135   // 12点为 0°，顺时针为正 → 135° 是右下（约 4:30 位置）
  //                       等一下，让我确认方向：目标是缺口在正上方，
  //                       弧经过底部。缺口 90° = -45°..+45°，
  //                       所以有效弧 startAngle = 45°（12点顺时针 45°，约 1:30），
  //                       扫过 270° 顺时针经 3点、6点、9点，到 -45°（约 10:30）。
  const START_ANGLE = 45          // min 一端在右上（1:30）
  const SWEEP = 270               // 顺时针 270° 到 -45°（10:30）
  ```
  等等，用户说"**从下面**"——最直觉的理解应该是 **min 在正下方（6点）**，从底部两侧对称向上延伸？那对称的话最舒服：
  ```
  START_ANGLE = -135       // 左下 7:30 位置（12点为 0，逆时针为负）
  SWEEP = 270 顺时针        // 经过 6点(180°) → 3点 → 到右下  ...
  ```
  ⚠️ 让我用不同的约定：**数学习惯 3点为 0°，逆时针为正**。这么改容易糊涂。**统一用 SVG 屏幕坐标**：
  - `angleDeg = 0` = 正右（3点）
  - 顺时针增加
  - 12点 = 270°（或 -90°）
  - 6点 = 90°
  - 目标：弧从左下经底到右下，缺口在顶部
  - **startAngle = 135°（左下 7:30）**
  - **endAngle = 45°（右下 4:30）**
  - **顺时针扫过：135° → 180°(6点) → 225° → 270°(12点)？不对，顺时针 135→180→225→270→315→360/0→45，共 270°。** 但这条路经过 12点，不是我们要的。
  - **改逆时针**：从 135° 逆时针到 45°，经过 180°(6点) → 225° → 270°... 也不对，逆时针是 135 → 90 → 45（只 90°）。
  - **正确**：想让弧覆盖底部半圈+两侧，缺口 90° 在顶部（正上方 ±45°）：
    - 缺口范围：45°..135°（SVG 坐标，即 12点两侧 45°）… 不对，SVG 坐标里 270° 才是 12点。让我重新校准。
    - SVG y 轴向下，屏幕 3点方向是 x+, 屏幕 6点方向是 y+, atan2(y, x)：3点=0°, 6点=90°, 9点=180°, 12点=270° 或 -90°。
    - 缺口在 12点即 270° ±45° → 缺口范围 225°..315°
    - 有效弧：315° 顺时针 270° 到 225°，经过 0°(3点) → 90°(6点) → 180°(9点) → 225°(9点稍下)
    - **startAngle = 315°（右上偏顶）**
    - **endAngle = 225°（左上偏顶）**
    - **顺时针 270°**

  - 具体实现里角度用 SVG 坐标（3点=0，顺时针+）：
    ```ts
    const START_ANGLE = 315   // 缺口右边界（右上 45° 位置）
    const END_ANGLE = 225 + 360  // 585，为了让 sweep 顺时针为正差值 = 270
    const SWEEP = 270
    // 值 v 映射到角度：t = (v - min) / (max - min)
    // angle = START_ANGLE + t * SWEEP
    // 得到的 angle 可能 > 360，画 arc 时对 360 取模
    ```
- 弧线路径 `<path d="...">` 和把手位置 `cos/sin` 计算全部按新 START/SWEEP 重推。
- 死区吸附：pointer 落在缺口范围（angle in (225°, 315°) 缺口方向）时，就近吸到 START_ANGLE 或 END_ANGLE。
- 中心数字位置从"上""下"改一下：既然缺口朝上，中心数字下方留白多了些，可以把 label 放到数字下面（保持不变）；缺口顶部可以显示 "块数" 小字标签，或者留空即可。**保持中心显示不变**，只改弧方向即可。

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "perf(drag): pre-emit visual reset; fix(dial): opening on top"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
