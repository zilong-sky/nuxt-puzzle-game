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
    <div
      class="board"
      :class="{ 'is-dragging': draggingGroupId !== null }"
      :style="{ aspectRatio: `${boardW} / ${boardH}` }"
    >
      <img
        class="board-ghost"
        :class="{ rotated }"
        :src="imageUrl"
        alt=""
        draggable="false"
      />
      <div
        v-for="s in slots"
        :key="`slot-${s.index}`"
        class="slot"
        :class="{
          'slot-active': hoverTargets.has(s.index) && draggingGroupId !== null
        }"
        :style="slotStyle(s)"
      />
      <div
        v-for="p in pieces"
        :key="p.id"
        class="piece"
        :class="{
          dragging: draggingGroupId === p.groupId,
          selected: selectedGroupId === p.groupId,
          'group-aligned': p.groupAligned
        }"
        :style="pieceStyle(p)"
        @pointerdown="onPointerDown($event, p.id)"
      >
        <div class="piece-fill" :class="{ rotated }" :style="fillStyle(p)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { PieceState } from '~/composables/usePuzzleGame'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    pieces: PieceState[]
    cols: number
    rows: number
    boardW: number
    boardH: number
    rotated?: boolean
  }>(),
  { rotated: false }
)

const emit = defineEmits<{
  moveGroup: [pieceId: number, dCol: number, dRow: number]
  moveGroupToSlot: [pieceId: number, targetSlot: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)

const draggingGroupId = ref<number | null>(null)
const selectedGroupId = ref<number | null>(null)
const dragLegal = ref(false)
const hoverTargets = ref<Set<number>>(new Set())

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

/** Inset (px) on each side, 1 when there is a gap, 0 when merged with a
 *  same-group neighbor. Total gap between pieces = 2px. */
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
  // Rotation is applied visually via CSS transform on .piece-fill. The
  // background image itself stays untouched, but the sub-region shown by
  // each piece is remapped so the rotated result reads correctly.
  // 90deg CW mapping: original (r', c') = (n-1-col, row) with a square grid.
  const bgW = (props.rotated ? props.rows : props.cols) * 100
  const bgH = (props.rotated ? props.cols : props.rows) * 100
  let bgX = 0
  let bgY = 0
  if (props.rotated) {
    bgX = props.rows > 1 ? (p.row / (props.rows - 1)) * 100 : 0
    bgY = props.cols > 1 ? ((props.cols - 1 - p.col) / (props.cols - 1)) * 100 : 0
  } else {
    bgX = props.cols > 1 ? (p.col / (props.cols - 1)) * 100 : 0
    bgY = props.rows > 1 ? (p.row / (props.rows - 1)) * 100 : 0
  }
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
    backgroundImage: `url(${props.imageUrl})`,
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
  raf: number | null
  curDx: number
  curDy: number
  members: PieceState[]
  lastDCol: number
  lastDRow: number
}
let drag: DragState | null = null
const CLICK_THRESHOLD = 6

function getBoardEl(): HTMLElement | null {
  return wrapRef.value?.querySelector('.board') as HTMLElement | null
}

function pieceById(id: number): PieceState | undefined {
  return props.pieces.find((p) => p.id === id)
}

function computeGroupMove(pieceId: number, dCol: number, dRow: number) {
  let members: PieceState[] | null = null
  if (drag && drag.pieceId === pieceId) {
    members = drag.members
  } else {
    const anchor = pieceById(pieceId)
    if (!anchor) return { legal: false, targets: new Set<number>() }
    members = props.pieces.filter((p) => p.groupId === anchor.groupId)
  }
  const targets = new Set<number>()
  for (const m of members) {
    const c = (m.slotIndex % props.cols) + dCol
    const r = Math.floor(m.slotIndex / props.cols) + dRow
    if (c < 0 || c >= props.cols || r < 0 || r >= props.rows) {
      return { legal: false, targets: new Set<number>() }
    }
    targets.add(r * props.cols + c)
  }
  return { legal: true, targets }
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
    raf: null,
    curDx: 0,
    curDy: 0,
    members: props.pieces.filter((pp) => pp.groupId === piece.groupId),
    lastDCol: -9999,
    lastDRow: -9999
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
    if (!drag) return
    drag.raf = null
    const boardEl = getBoardEl()
    if (boardEl) {
      boardEl.style.setProperty('--drag-dx', drag.curDx + 'px')
      boardEl.style.setProperty('--drag-dy', drag.curDy + 'px')
    }
    const cellW = drag.boardRect.width / props.cols
    const cellH = drag.boardRect.height / props.rows
    const dCol = Math.round(drag.curDx / cellW)
    const dRow = Math.round(drag.curDy / cellH)
    if (dCol === drag.lastDCol && dRow === drag.lastDRow) return
    drag.lastDCol = dCol
    drag.lastDRow = dRow
    const { legal, targets } = computeGroupMove(drag.pieceId, dCol, dRow)
    dragLegal.value = legal && (dCol !== 0 || dRow !== 0)
    hoverTargets.value = legal ? targets : new Set()
  })
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointerId) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  if (!drag.moved && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
    drag.moved = true
    draggingGroupId.value = drag.groupId
    selectedGroupId.value = null
  }
  drag.curDx = dx
  drag.curDy = dy
  if (drag.moved) scheduleUpdate()
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
  if (drag.raf != null) cancelAnimationFrame(drag.raf)
  const boardElUp = getBoardEl()
  if (boardElUp) {
    boardElUp.style.setProperty('--drag-dx', '0px')
    boardElUp.style.setProperty('--drag-dy', '0px')
  }
  drag = null
  draggingGroupId.value = null
  hoverTargets.value = new Set()
  dragLegal.value = false

  if (wasDrag) {
    if (dCol === 0 && dRow === 0) return
    // moveGroup emits; the parent decides legality. If illegal it will
    // simply do nothing and the piece has already sprung back visually.
    emit('moveGroup', pid, dCol, dRow)
    return
  }

  // click behaviour: select a group; a second click on another group
  // computes delta from the selected group''s anchor piece.
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
  width: 100%;
  user-select: none;
  touch-action: none;
}
.board {
  position: relative;
  width: 100%;
  background: #c8ccd6;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  --drag-dx: 0px;
  --drag-dy: 0px;
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
.board-ghost.rotated {
  transform: rotate(90deg);
  transform-origin: center center;
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
  transition: left 0.15s ease, top 0.15s ease, transform 0.2s ease;
  will-change: transform, left, top;
}
.piece.dragging {
  cursor: grabbing;
  transition: none;
  transform: translate3d(var(--drag-dx), var(--drag-dy), 0) scale(1.05);
  z-index: 999;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35));
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
.piece-fill.rotated {
  transform: rotate(90deg);
  transform-origin: center center;
}
.piece.selected .piece-fill {
  outline-color: #f5c451;
  box-shadow: 0 0 12px rgba(245, 196, 81, 0.8);
}
.piece.group-aligned .piece-fill {
  border-color: #d4af37;
}
</style>
