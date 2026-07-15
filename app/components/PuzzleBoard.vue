<!--
  app/components/PuzzleBoard.vue
  Rectangular grid puzzle board with lifted-drag pointer interaction.

  - Top area is the board (boardW x boardH) with absolutely positioned .slot
    elements to visualise empty target cells.
  - Bottom is the .tray, horizontally scrollable, showing unplaced pieces in
    insertion order.
  - All .piece nodes live in a single .pieces-layer that overlaps both areas,
    so a piece can be dragged freely from tray to board and vice versa.
  - Dragging uses Pointer Events + requestAnimationFrame with no third-party
    library. On pick-up the piece scales to 1.15x and gets a dark drop-shadow.
-->
<template>
  <div class="puzzle-wrap" ref="wrapRef">
    <div class="board" :style="{ width: boardW + 'px', height: boardH + 'px' }">
      <img class="board-ghost" :src="imageUrl" alt="" draggable="false" />
      <div
        v-for="s in slots"
        :key="`slot-${s.index}`"
        class="slot"
        :class="{ 'slot-highlight': draggingId !== null, 'slot-active': activeSlot === s.index }"
        :style="slotStyle(s)"
      />
    </div>

    <div
      class="tray"
      ref="trayRef"
      :style="{ height: trayH + 'px' }"
      @scroll="onTrayScroll"
    >
      <div class="tray-inner" :style="{ width: trayContentW + 'px', height: (trayH - 2) + 'px' }" />
    </div>

    <div class="pieces-layer" ref="layerRef">
      <div
        v-for="p in pieces"
        :key="p.id"
        class="piece"
        :class="{ dragging: draggingId === p.id, placed: p.slotIndex === p.correctIndex }"
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
  place: [id: number, slotIndex: number]
  returnToTray: [id: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const trayRef = ref<HTMLElement | null>(null)
const layerRef = ref<HTMLElement | null>(null)

const draggingId = ref<number | null>(null)
const activeSlot = ref<number | null>(null)
const dragPos = ref<{ x: number; y: number } | null>(null)
const trayScrollLeft = ref(0)

const trayGap = 12
const trayPadding = 12

const trayH = computed(() => {
  const first = props.pieces[0]
  const h = first ? first.h : 100
  return Math.round(h + trayPadding * 2)
})
const trayContentW = computed(() => {
  const trayItems = props.pieces.filter((p) => p.slotIndex === -1)
  const first = props.pieces[0]
  const w = first ? first.w : 100
  return Math.max(props.boardW, trayPadding * 2 + trayItems.length * (w + trayGap))
})

const slots = computed(() => {
  const list: { index: number; row: number; col: number }[] = []
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.cols; c++) {
      list.push({ index: r * props.cols + c, row: r, col: c })
    }
  }
  return list
})

function slotStyle(s: { row: number; col: number }) {
  const first = props.pieces[0]
  const w = first ? first.w : props.boardW / props.cols
  const h = first ? first.h : props.boardH / props.rows
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${s.col * w}px, ${s.row * h}px)`
  }
}

/** Static position of a piece (board coordinate system; tray sits below boardH). */
function pieceBasePosition(p: PieceState): { x: number; y: number } {
  if (p.slotIndex >= 0) {
    const col = p.slotIndex % props.cols
    const row = Math.floor(p.slotIndex / props.cols)
    return { x: col * p.w, y: row * p.h }
  }
  const trayItems = props.pieces
    .filter((x) => x.slotIndex === -1)
    .slice()
    .sort((a, b) => a.trayOrder - b.trayOrder)
  const order = trayItems.findIndex((x) => x.id === p.id)
  const x = trayPadding + Math.max(0, order) * (p.w + trayGap) - trayScrollLeft.value
  const y = props.boardH + trayPadding
  return { x, y }
}

function pieceStyle(p: PieceState): Record<string, string> {
  const isDragging = draggingId.value === p.id
  const pos = isDragging && dragPos.value ? dragPos.value : pieceBasePosition(p)
  const scale = isDragging ? 1.15 : 1
  return {
    width: `${p.w}px`,
    height: `${p.h}px`,
    backgroundImage: `url(${props.imageUrl})`,
    backgroundSize: `${props.boardW}px ${props.boardH}px`,
    backgroundPosition: `${-p.bgX}px ${-p.bgY}px`,
    transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`
  }
}

function onTrayScroll() {
  if (!trayRef.value) return
  trayScrollLeft.value = trayRef.value.scrollLeft
}

/* ---------- Pointer events ---------- */
interface DragState {
  id: number
  pointerId: number
  layerRect: DOMRect
  scale: number
  currentX: number
  currentY: number
  raf: number | null
}
let drag: DragState | null = null

function getScale(): number {
  const el = layerRef.value
  if (!el) return 1
  const rect = el.getBoundingClientRect()
  return rect.width / props.boardW
}

function toLocal(clientX: number, clientY: number): { x: number; y: number } {
  if (!drag) return { x: 0, y: 0 }
  const rect = drag.layerRect
  return {
    x: (clientX - rect.left) / drag.scale,
    y: (clientY - rect.top) / drag.scale
  }
}

function onPointerDown(e: PointerEvent, id: number) {
  const p = props.pieces.find((x) => x.id === id)
  if (!p) return
  const layer = layerRef.value
  if (!layer) return
  const scale = getScale() || 1
  const layerRect = layer.getBoundingClientRect()
  drag = {
    id,
    pointerId: e.pointerId,
    layerRect,
    scale,
    currentX: (e.clientX - layerRect.left) / scale,
    currentY: (e.clientY - layerRect.top) / scale,
    raf: null
  }
  draggingId.value = id
  updateDragPosImmediate()
  ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  e.preventDefault()
}

function updateDragPosImmediate() {
  if (!drag) return
  const p = props.pieces.find((x) => x.id === drag!.id)
  if (!p) return
  dragPos.value = {
    x: drag.currentX - p.w / 2,
    y: drag.currentY - p.h / 2
  }
  updateActiveSlot()
}

function scheduleUpdate() {
  if (!drag) return
  if (drag.raf != null) return
  drag.raf = requestAnimationFrame(() => {
    if (drag) drag.raf = null
    updateDragPosImmediate()
  })
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const local = toLocal(e.clientX, e.clientY)
  drag.currentX = local.x
  drag.currentY = local.y
  scheduleUpdate()
}

function isSlotOccupied(slotIndex: number, excludeId: number): boolean {
  return props.pieces.some((p) => p.slotIndex === slotIndex && p.id !== excludeId)
}

function updateActiveSlot() {
  if (!drag) return
  const p = props.pieces.find((x) => x.id === drag!.id)
  if (!p) return
  const cx = drag.currentX
  const cy = drag.currentY
  if (cy > props.boardH || cx < 0 || cx > props.boardW || cy < 0) {
    activeSlot.value = null
    return
  }
  const col = Math.max(0, Math.min(props.cols - 1, Math.floor(cx / p.w)))
  const row = Math.max(0, Math.min(props.rows - 1, Math.floor(cy / p.h)))
  const idx = row * props.cols + col
  const slotCx = col * p.w + p.w / 2
  const slotCy = row * p.h + p.h / 2
  const dist = Math.hypot(cx - slotCx, cy - slotCy)
  const threshold = Math.min(p.w, p.h) * 0.5
  if (dist <= threshold && !isSlotOccupied(idx, p.id)) {
    activeSlot.value = idx
  } else {
    activeSlot.value = null
  }
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const id = drag.id
  const target = activeSlot.value
  const releaseInsideBoard =
    drag.currentX >= 0 &&
    drag.currentX <= props.boardW &&
    drag.currentY >= 0 &&
    drag.currentY <= props.boardH
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (drag.raf != null) cancelAnimationFrame(drag.raf)
  drag = null
  draggingId.value = null
  dragPos.value = null
  activeSlot.value = null

  if (target != null) {
    emit('place', id, target)
  } else if (!releaseInsideBoard) {
    emit('returnToTray', id)
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
  max-width: 720px;
  margin: 0 auto;
  user-select: none;
  touch-action: none;
}
.board {
  position: relative;
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
  opacity: 0.12;
  filter: grayscale(0.4) blur(1px);
  pointer-events: none;
}
.slot {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.04);
  border: 1px dashed transparent;
  transition: border-color 0.15s ease, box-shadow 0.2s ease;
  pointer-events: none;
}
.slot-highlight { border-color: #d4a24c; }
.slot-active {
  border-color: #f5c451;
  box-shadow: 0 0 12px rgba(245, 196, 81, 0.6);
  animation: breathe 1s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 6px rgba(245, 196, 81, 0.4); }
  50%      { box-shadow: 0 0 16px rgba(245, 196, 81, 0.8); }
}

.tray {
  position: relative;
  margin-top: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  background: #eef1f7;
  border-radius: var(--radius-md);
  touch-action: pan-x;
}
.tray-inner { position: relative; }

.pieces-layer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}
.piece {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  cursor: grab;
  border-radius: 2px;
  transform-origin: center center;
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  background-repeat: no-repeat;
  background-color: #ccc;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  pointer-events: auto;
}
.piece.dragging {
  cursor: grabbing;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.35));
  z-index: 999;
  transition: none;
}
.piece.placed {
  cursor: default;
  box-shadow: none;
}
</style>
