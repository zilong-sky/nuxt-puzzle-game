<!--
  app/components/PuzzleBoard.vue
  Group-aware swap board. Pieces are grouped when they are neighbors in
  both the current slot layout and the correct layout. A drag or a
  click-click move applies to the entire group as a batch swap. Between
  pieces from different groups a 2px gap is drawn (board background
  showing through); same-group neighbors render with no visible seam.
-->
<template>
  <div class="puzzle-wrap" ref="wrapRef">
    <div class="board" ref="boardRef">
      <img class="board-ghost"
        :src="imageUrl"
        alt=""
        draggable="false"
      />
      <div
        v-for="s in slots"
        :key="`slot-${s.index}`"
        class="slot"
        :data-slot="s.index"
        :style="slotStyle(s)"
      />
      <div
        v-for="p in pieces"
        :key="p.id"
        class="piece"
        :class="{
          selected: selectedGroupId === p.groupId,
          'group-aligned': p.groupAligned
        }"
        :style="pieceStyle(p)"
        @pointerdown="onPointerDown($event, p.id)"
      >
        <div class="piece-fill" :style="fillStyle(p)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { PieceState } from '~/composables/usePuzzleGame'

const props = defineProps<{
  imageUrl: string
  pieces: PieceState[]
  cols: number
  rows: number
}>()

const emit = defineEmits<{
  moveGroup: [pieceId: number, dCol: number, dRow: number]
  moveGroupToSlot: [pieceId: number, targetSlot: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const boardRef = ref<HTMLElement | null>(null)

const selectedGroupId = ref<number | null>(null)

const slots = computed(() => {
  const list: { index: number; row: number; col: number }[] = []
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.cols; c++) {
      list.push({ index: r * props.cols + c, row: r, col: c })
    }
  }
  return list
})

const slotMap = computed(() => {
  const m = new Map<number, PieceState>()
  for (const p of props.pieces) m.set(p.slotIndex, p)
  return m
})

function slotStyle(s: { row: number; col: number }) {
  const wPct = 100 / props.cols
  const hPct = 100 / props.rows
  return {
    width: `${wPct}%`,
    height: `${hPct}%`,
    left: `${s.col * wPct}%`,
    top: `${s.row * hPct}%`
  }
}

function neighborInsets(p: PieceState): { t: number; r: number; b: number; l: number } {
  const col = p.slotIndex % props.cols
  const row = Math.floor(p.slotIndex / props.cols)
  const map = slotMap.value
  const same = (nSlot: number) => {
    const n = map.get(nSlot)
    return !!n && n.groupId === p.groupId
  }
  return {
    t: row > 0 && same(p.slotIndex - props.cols) ? 0 : 1,
    r: col < props.cols - 1 && same(p.slotIndex + 1) ? 0 : 1,
    b: row < props.rows - 1 && same(p.slotIndex + props.cols) ? 0 : 1,
    l: col > 0 && same(p.slotIndex - 1) ? 0 : 1
  }
}

function pieceStyle(p: PieceState): Record<string, string> {
  const col = p.slotIndex % props.cols
  const row = Math.floor(p.slotIndex / props.cols)
  const wPct = 100 / props.cols
  const hPct = 100 / props.rows
  const style: Record<string, string> = {
    width: `${wPct}%`,
    height: `${hPct}%`,
    left: `${col * wPct}%`,
    top: `${row * hPct}%`
  }
  return style
}

function fillStyle(p: PieceState): Record<string, string> {
  const ins = neighborInsets(p)
  const bgW = props.cols * 100
  const bgH = props.rows * 100
  const bgX = props.cols > 1 ? (p.col / (props.cols - 1)) * 100 : 0
  const bgY = props.rows > 1 ? (p.row / (props.rows - 1)) * 100 : 0
  const shadowParts: string[] = []
  if (ins.t) shadowParts.push('0 -1px 2px rgba(0,0,0,0.15)')
  if (ins.r) shadowParts.push('1px 0 2px rgba(0,0,0,0.15)')
  if (ins.b) shadowParts.push('0 1px 2px rgba(0,0,0,0.15)')
  if (ins.l) shadowParts.push('-1px 0 2px rgba(0,0,0,0.15)')
  if (p.groupAligned) {
    if (ins.t) shadowParts.push('0 -3px 8px rgba(212,175,55,0.55)')
    if (ins.r) shadowParts.push('3px 0 8px rgba(212,175,55,0.55)')
    if (ins.b) shadowParts.push('0 3px 8px rgba(212,175,55,0.55)')
    if (ins.l) shadowParts.push('-3px 0 8px rgba(212,175,55,0.55)')
  }
  const boxShadow = shadowParts.length ? shadowParts.join(', ') : 'none'
  return {
    top: `${ins.t}px`,
    right: `${ins.r}px`,
    bottom: `${ins.b}px`,
    left: `${ins.l}px`,
    backgroundImage: `url("${props.imageUrl}")`,
    backgroundSize: `${bgW}% ${bgH}%`,
    backgroundPosition: `${bgX}% ${bgY}%`,
    boxShadow,
    borderTopColor: ins.t ? '' : 'transparent',
    borderRightColor: ins.r ? '' : 'transparent',
    borderBottomColor: ins.b ? '' : 'transparent',
    borderLeftColor: ins.l ? '' : 'transparent'
  }
}

/* ---------- pointer / drag logic ---------- */
interface DragState {
  pieceId: number
  groupId: number
  pointerId: number
  startX: number
  startY: number
  boardRect: DOMRect
  moved: boolean
  curDx: number
  curDy: number
  members: PieceState[]
  lastDCol: number
  lastDRow: number
  dragEl: HTMLElement | null
  activeSlotEls: Set<HTMLElement>
  scratchTargets: Set<number>
}
let drag: DragState | null = null
const CLICK_THRESHOLD = 6

function getBoardEl(): HTMLElement | null {
  return boardRef.value
}

function pieceById(id: number): PieceState | undefined {
  return props.pieces.find((p) => p.id === id)
}

function computeGroupMoveInto(state: DragState, dCol: number, dRow: number): boolean {
  const members = state.members
  const out = state.scratchTargets
  out.clear()
  for (const m of members) {
    const c = (m.slotIndex % props.cols) + dCol
    const r = Math.floor(m.slotIndex / props.cols) + dRow
    if (c < 0 || c >= props.cols || r < 0 || r >= props.rows) {
      out.clear()
      return false
    }
    out.add(r * props.cols + c)
  }
  return true
}

function applyHoverTargets(next: Set<number>) {
  if (!drag) return
  const boardEl = getBoardEl()
  if (!boardEl) return
  for (const el of Array.from(drag.activeSlotEls)) {
    const idx = Number(el.dataset.slot)
    if (!next.has(idx)) {
      el.classList.remove('slot-active')
      drag.activeSlotEls.delete(el)
    }
  }
  next.forEach((idx) => {
    const el = boardEl.querySelector(`.slot[data-slot="${idx}"]`) as HTMLElement | null
    if (el && !drag!.activeSlotEls.has(el)) {
      el.classList.add('slot-active')
      drag!.activeSlotEls.add(el)
    }
  })
}

function clearHoverTargets() {
  if (!drag) return
  for (const el of drag.activeSlotEls) {
    el.classList.remove('slot-active')
  }
  drag.activeSlotEls.clear()
}

function onPointerDown(e: PointerEvent, id: number) {
  const boardEl = getBoardEl()
  if (!boardEl) return
  const rect = boardEl.getBoundingClientRect()
  const piece = pieceById(id)
  if (!piece) return
  drag = {
    pieceId: id,
    groupId: piece.groupId,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    boardRect: rect,
    moved: false,
    curDx: 0,
    curDy: 0,
    members: props.pieces.filter((pp) => pp.groupId === piece.groupId),
    lastDCol: -9999,
    lastDRow: -9999,
    dragEl: e.currentTarget as HTMLElement,
    activeSlotEls: new Set<HTMLElement>(),
    scratchTargets: new Set<number>()
  }
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  e.preventDefault()
}


function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const events = (typeof e.getCoalescedEvents === 'function')
    ? e.getCoalescedEvents()
    : []
  const last = (events && events.length > 0) ? events[events.length - 1] : e
  const dx = last.clientX - drag.startX
  const dy = last.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
    drag.moved = true
    selectedGroupId.value = null
    const boardEl = getBoardEl()
    if (boardEl) boardEl.classList.add('is-dragging')
    if (drag.dragEl) drag.dragEl.classList.add('dragging')
  }
  drag.curDx = dx
  drag.curDy = dy
  if (!drag.moved) return
  const pieceEl = drag.dragEl
  if (pieceEl) {
    pieceEl.style.setProperty('--drag-dx', dx + 'px')
    pieceEl.style.setProperty('--drag-dy', dy + 'px')
  }
  const cellW = drag.boardRect.width / props.cols
  const cellH = drag.boardRect.height / props.rows
  const dCol = Math.round(dx / cellW)
  const dRow = Math.round(dy / cellH)
  if (dCol !== drag.lastDCol || dRow !== drag.lastDRow) {
    drag.lastDCol = dCol
    drag.lastDRow = dRow
    const legal = computeGroupMoveInto(drag, dCol, dRow)
    if (legal) {
      applyHoverTargets(drag.scratchTargets)
    } else {
      clearHoverTargets()
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const wasDrag = drag.moved
  const pid = drag.pieceId
  const cellW = drag.boardRect.width / props.cols
  const cellH = drag.boardRect.height / props.rows
  const dCol = Math.round(drag.curDx / cellW)
  const dRow = Math.round(drag.curDy / cellH)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  const pieceElUp = drag.dragEl
  if (pieceElUp) {
    pieceElUp.style.setProperty('--drag-dx', '0px')
    pieceElUp.style.setProperty('--drag-dy', '0px')
    pieceElUp.classList.remove('dragging')
  }
  const boardEl = getBoardEl()
  if (boardEl) boardEl.classList.remove('is-dragging')
  clearHoverTargets()
  drag = null

  if (wasDrag) {
    if (dCol === 0 && dRow === 0) return
    emit('moveGroup', pid, dCol, dRow)
    return
  }

  const piece = pieceById(pid)
  if (!piece) return
  if (selectedGroupId.value === null) {
    selectedGroupId.value = piece.groupId
  } else if (selectedGroupId.value === piece.groupId) {
    selectedGroupId.value = null
  } else {
    const anchor = props.pieces.find((p) => p.groupId === selectedGroupId.value!)
    if (anchor) {
      emit('moveGroupToSlot', anchor.id, piece.slotIndex)
    }
    selectedGroupId.value = null
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})
</script>

<style scoped>
.puzzle-wrap {
  position: relative;
  user-select: none;
  touch-action: none;
}
.board {
  position: relative;
  width: 100%;
  height: 100%;
  background: #c8ccd6;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.board.is-dragging .piece:not(.dragging) {
  transition: none;
}
.board-ghost {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.1;
  filter: grayscale(0.4) blur(1px);
  pointer-events: none;
}
.slot {
  position: absolute;
  background: transparent;
  pointer-events: none;
  transition: box-shadow 0.15s ease;
}
.slot-active {
  box-shadow: 0 0 0 2px #f5c451 inset,
    0 0 12px rgba(245, 196, 81, 0.6) inset;
}
.piece {
  position: absolute;
  cursor: grab;
  transform-origin: center center;
  transition: left 0.15s ease, top 0.15s ease;
  will-change: transform, left, top;
}
.piece.dragging {
  cursor: grabbing;
  transition: none;
  transform: translate3d(var(--drag-dx, 0), var(--drag-dy, 0), 0) scale(1.05);
  z-index: 999;
}
.piece.dragging .piece-fill {
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.15),
    0 8px 18px rgba(0, 0, 0, 0.35) !important;
}
.piece-fill {
  position: absolute;
  background-repeat: no-repeat;
  background-color: #ccc;
  border-radius: 2px;
  transition: outline-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  outline: 2px solid transparent;
  outline-offset: -2px;
  border-width: 2px;
  border-style: solid;
  border-color: transparent;
  box-sizing: border-box;
}
.piece.selected .piece-fill {
  outline-color: #f5c451;
  box-shadow: 0 0 12px rgba(245, 196, 81, 0.8);
}
.piece.group-aligned .piece-fill {
  border-color: #d4af37;
}
</style>