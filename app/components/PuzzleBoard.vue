<!--
  app/components/PuzzleBoard.vue
  Swap-only rectangular grid puzzle board. All pieces always sit on the
  board; there is no tray. Interaction modes:

  - Click-click: tap a piece to select (highlighted), tap another to swap;
    tap the same piece again to deselect.
  - Drag-drop: press and drag a piece; on release over another piece the
    two swap; released elsewhere returns to origin.

  The board scales itself to fit the viewport (mobile-first). Internal
  coordinates use a fixed logical size (boardW x boardH); an outer wrapper
  applies CSS scale via width so % positions naturally adapt.
-->
<template>
  <div class="puzzle-wrap" ref="wrapRef">
    <div
      class="board"
      :style="{ aspectRatio: `${boardW} / ${boardH}` }"
    >
      <img class="board-ghost" :src="imageUrl" alt="" draggable="false" />
      <div
        v-for="s in slots"
        :key="`slot-${s.index}`"
        class="slot"
        :class="{
          'slot-selectable': selectedId !== null,
          'slot-active': hoverSlot === s.index && draggingId !== null
        }"
        :style="slotStyle(s)"
      />
      <div
        v-for="p in pieces"
        :key="p.id"
        class="piece"
        :class="{
          dragging: draggingId === p.id,
          selected: selectedId === p.id,
          placed: p.slotIndex === p.correctIndex
        }"
        :style="pieceStyle(p)"
        @pointerdown="onPointerDown($event, p.id)"
      />
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
  boardW: number
  boardH: number
}>()

const emit = defineEmits<{
  swap: [aId: number, bId: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)

const draggingId = ref<number | null>(null)
const selectedId = ref<number | null>(null)
const hoverSlot = ref<number | null>(null)
const dragPos = ref<{ x: number; y: number } | null>(null)

const slots = computed(() => {
  const list: { index: number; row: number; col: number }[] = []
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.cols; c++) {
      list.push({ index: r * props.cols + c, row: r, col: c })
    }
  }
  return list
})

/* Percent-based positioning so the board can scale freely. */
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

function pieceBasePosition(p: PieceState): { xPct: number; yPct: number } {
  const col = p.slotIndex % props.cols
  const row = Math.floor(p.slotIndex / props.cols)
  return { xPct: col * (100 / props.cols), yPct: row * (100 / props.rows) }
}

function pieceStyle(p: PieceState): Record<string, string> {
  const isDragging = draggingId.value === p.id
  const wPct = 100 / props.cols
  const hPct = 100 / props.rows
  if (isDragging && dragPos.value) {
    return {
      width: `${wPct}%`,
      height: `${hPct}%`,
      left: `${dragPos.value.x}px`,
      top: `${dragPos.value.y}px`,
      transform: `translate(-50%, -50%) scale(1.08)`,
      backgroundImage: `url(${props.imageUrl})`,
      backgroundSize: `${props.cols * 100}% ${props.rows * 100}%`,
      backgroundPosition: `${(p.col / Math.max(1, props.cols - 1)) * 100}% ${(p.row / Math.max(1, props.rows - 1)) * 100}%`
    }
  }
  const base = pieceBasePosition(p)
  return {
    width: `${wPct}%`,
    height: `${hPct}%`,
    left: `${base.xPct}%`,
    top: `${base.yPct}%`,
    transform: `translate(0, 0)`,
    backgroundImage: `url(${props.imageUrl})`,
    backgroundSize: `${props.cols * 100}% ${props.rows * 100}%`,
    backgroundPosition: `${(p.col / Math.max(1, props.cols - 1)) * 100}% ${(p.row / Math.max(1, props.rows - 1)) * 100}%`
  }
}

/* ---------- Pointer events (click-or-drag) ---------- */
interface DragState {
  id: number
  pointerId: number
  startX: number
  startY: number
  boardRect: DOMRect
  moved: boolean
  currentX: number
  currentY: number
  raf: number | null
}
let drag: DragState | null = null
const CLICK_THRESHOLD = 6 // px before we treat it as a drag

function getBoardEl(): HTMLElement | null {
  return wrapRef.value?.querySelector('.board') as HTMLElement | null
}

function onPointerDown(e: PointerEvent, id: number) {
  const boardEl = getBoardEl()
  if (!boardEl) return
  const rect = boardEl.getBoundingClientRect()
  drag = {
    id,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    boardRect: rect,
    moved: false,
    currentX: e.clientX - rect.left,
    currentY: e.clientY - rect.top,
    raf: null
  }
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  e.preventDefault()
}

function scheduleUpdate() {
  if (!drag) return
  if (drag.raf != null) return
  drag.raf = requestAnimationFrame(() => {
    if (drag) drag.raf = null
    if (!drag) return
    dragPos.value = { x: drag.currentX, y: drag.currentY }
    updateHoverSlot()
  })
}

function updateHoverSlot() {
  if (!drag) return
  const rect = drag.boardRect
  const cx = drag.currentX
  const cy = drag.currentY
  if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) {
    hoverSlot.value = null
    return
  }
  const col = Math.max(0, Math.min(props.cols - 1, Math.floor((cx / rect.width) * props.cols)))
  const row = Math.max(0, Math.min(props.rows - 1, Math.floor((cy / rect.height) * props.rows)))
  hoverSlot.value = row * props.cols + col
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
    drag.moved = true
    draggingId.value = drag.id
    // clear click-selection when a drag begins
    selectedId.value = null
  }
  drag.currentX = e.clientX - drag.boardRect.left
  drag.currentY = e.clientY - drag.boardRect.top
  if (drag.moved) scheduleUpdate()
}

function findPieceInSlot(slotIndex: number): PieceState | undefined {
  return props.pieces.find((p) => p.slotIndex === slotIndex)
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const wasDrag = drag.moved
  const id = drag.id
  const target = hoverSlot.value
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (drag.raf != null) cancelAnimationFrame(drag.raf)
  drag = null
  draggingId.value = null
  dragPos.value = null
  hoverSlot.value = null

  if (wasDrag) {
    if (target == null) return
    const other = findPieceInSlot(target)
    if (!other || other.id === id) return
    emit('swap', id, other.id)
    return
  }

  // click behaviour
  if (selectedId.value === null) {
    selectedId.value = id
  } else if (selectedId.value === id) {
    selectedId.value = null
  } else {
    emit('swap', selectedId.value, id)
    selectedId.value = null
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
  width: 100%;
  user-select: none;
  touch-action: none;
}
.board {
  position: relative;
  width: 100%;
  background: #f0f2f7;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
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
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  pointer-events: none;
}
.slot-selectable { border-color: rgba(245, 196, 81, 0.5); }
.slot-active {
  border-color: #f5c451;
  box-shadow: 0 0 12px rgba(245, 196, 81, 0.7) inset;
}
.piece {
  position: absolute;
  will-change: transform, left, top;
  cursor: grab;
  border-radius: 2px;
  transform-origin: center center;
  transition: left 0.15s ease, top 0.15s ease, transform 0.15s ease,
    box-shadow 0.15s ease, outline-color 0.15s ease;
  background-repeat: no-repeat;
  background-color: #ccc;
  outline: 2px solid transparent;
  outline-offset: -2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
.piece.placed {
  outline-color: rgba(16, 185, 129, 0.55);
}
.piece.selected {
  outline-color: #f5c451;
  box-shadow: 0 0 12px rgba(245, 196, 81, 0.8);
  z-index: 20;
}
.piece.dragging {
  cursor: grabbing;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.35));
  z-index: 999;
  transition: none;
}
</style>
