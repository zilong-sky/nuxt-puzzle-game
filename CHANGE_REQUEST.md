# 两处调整

## 一、休闲模式难度上限改成 50

改 `app/pages/play/casual.vue`：
```html
<DifficultyModal
  :open="!pieceCountChosen"
  :min="4" :max="50" :initial="25"
  ...
/>
```
（把原来的 `:max="200"` 改 `:max="50"`；`:initial="48"` 改成 `:initial="25"`，让默认落在合理位置。）

## 二、整组一起拖动（可视 + 松手交换）

### 现状
- `recomputeGroups()` 已经把相邻且相对位置正确的块合并成同一个 `groupId`。
- 内部无缝：`neighborInsets` 已经在组内边把 border-color 置 transparent、去掉 box-shadow —— 这部分**不用改**。
- `computeGroupMoveInto` 已经把整组当作一个整体做碰撞/交换判定，松手时 `emit('moveGroup')` 也是整组移动。
- 唯一缺失：**拖动过程中的可视 offset** 只写在 `drag.dragEl`（当前被按的那一块）上，其他组成员不动，视觉上组"散开"。

### 修改（`app/components/PuzzleBoard.vue`）

#### 1. 在 `DragState` 里加成员 DOM 引用
```ts
interface DragState {
  ...
  members: PieceState[]
  memberEls: HTMLElement[]       // 新增
  dragEl: HTMLElement | null
  ...
}
```

#### 2. `onPointerDown` 里收集 memberEls

在计算 `drag = { ... }` 后：
```ts
const boardEl = /* 原有 */
const memberEls: HTMLElement[] = []
if (boardEl) {
  for (const m of drag.members) {
    const el = boardEl.querySelector<HTMLElement>(`[data-piece-id="${m.id}"]`)
    if (el) memberEls.push(el)
  }
}
drag.memberEls = memberEls
```
（如果 piece 元素上没有 `data-piece-id`，那就在模板里给 `.piece` 加 `:data-piece-id="p.id"`。）

**给每个成员元素加 `dragging` class** 而不是只加在 dragEl：
```ts
for (const el of memberEls) el.classList.add('dragging')
```
（也保留原来在 dragEl 上加 dragging 的语义。用循环覆盖即可，不要重复加。）

#### 3. `onPointerMove` 同步给所有成员写 CSS 变量

替换现有的：
```ts
pieceEl.style.setProperty('--drag-dx', dx + 'px')
pieceEl.style.setProperty('--drag-dy', dy + 'px')
```
为：
```ts
for (const el of drag.memberEls) {
  el.style.setProperty('--drag-dx', dx + 'px')
  el.style.setProperty('--drag-dy', dy + 'px')
}
```

#### 4. `onPointerUp` 归位

原来只清 dragEl，改成遍历 memberEls：
```ts
for (const el of drag.memberEls) {
  el.classList.remove('dragging')
  el.style.setProperty('--drag-dx', '0px')
  el.style.setProperty('--drag-dy', '0px')
}
```
保留原有的 clearHoverTargets / boardEl 去 is-dragging / 摘监听 / drag=null / emit 顺序。

#### 5. z-index 保证整组浮起

`.piece.dragging` 已有 `z-index` / `transform: translate3d(...) scale(1.05)`。为了整组一起浮起来但不互相遮，保持 scale(1.05) 只用一次没问题（每块单独 scale，视觉上组整体略放大也合理）。若组太大导致边缘视觉出格，可以把 scale 改成 1.02 —— **本次先不改 scale**，观察后再定。

#### 6. 小心 `.piece` 上的 CSS transition
`.piece { transition: left/top 0.12s ...; }` 里没有 transform，OK。`--drag-dx/dy` 变化不会有 transition。松手归零瞬间跳回也不会飘。

## 交付

1. `npm run build` 通过。
2. `git add -A && git commit -m "feat(casual): max 50; feat(drag): whole group follows finger"`。
3. `git push origin master`（失败重试一次）。
4. 全程自主完成，不要询问。
