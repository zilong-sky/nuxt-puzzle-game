<!--
  app/components/PuzzleBoard.vue
  拼图棋盘：使用 SVG + clipPath 绘制不规则拼图块，
  支持鼠标 & 触摸拖拽，右侧料架区展示未放置块。
-->
<template>
  <div class="board-wrap" ref="wrapRef">
    <svg
      class="board"
      :viewBox="`0 0 ${totalW} ${viewH}`"
      preserveAspectRatio="xMidYMid meet"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <defs>
        <!-- 每块使用独立的 clipPath -->
        <clipPath
          v-for="p in pieces"
          :id="`clip-${uid}-${p.id}`"
          :key="`clip-${p.id}`"
          clipPathUnits="userSpaceOnUse"
        >
          <path :d="translatePath(p)" />
        </clipPath>
      </defs>

      <!-- 拼图目标区域轮廓（半透明底图，帮助玩家定位） -->
      <rect
        :x="0" :y="0" :width="viewW" :height="viewH"
        fill="#f0f2f7" stroke="#d0d6e2" stroke-dasharray="4 4"
      />
      <!-- 目标位置提示：显示所有块的目标形状轮廓 -->
      <g class="ghost">
        <path
          v-for="p in pieces" :key="`ghost-${p.id}`"
          :d="p.path"
          fill="rgba(0,0,0,0.03)"
          stroke="rgba(0,0,0,0.08)"
          stroke-width="1"
        />
      </g>

      <!-- 料架背景 -->
      <rect
        :x="viewW" :y="0" :width="trayW" :height="viewH"
        fill="#eef1f7"
      />
      <text
        :x="viewW + trayW / 2" :y="20"
        text-anchor="middle" font-size="14" fill="#6b7280"
      >料架（可拖拽）</text>

      <!-- 拼图块，未放置的置于上层，方便拖拽 -->
      <g
        v-for="p in sortedPieces" :key="p.id"
        :class="['piece', { placed: p.placed, active: activeId === p.id }]"
        @pointerdown="onPointerDown($event, p.id)"
      >
        <image
          :href="imageUrl"
          :x="p.x - p.targetX"
          :y="p.y - p.targetY"
          :width="viewW"
          :height="viewH"
          :clip-path="`url(#clip-${uid}-${p.id})`"
          preserveAspectRatio="xMidYMid slice"
        />
        <!-- 块外轮廓 -->
        <path
          :d="translatePath(p)"
          fill="none"
          :stroke="p.placed ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)'"
          stroke-width="1.2"
          pointer-events="none"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PieceState } from '~/composables/usePuzzleGame'

const props = defineProps<{
  imageUrl: string
  pieces: PieceState[]
  viewW: number
  viewH: number
  trayW: number
  totalW: number
}>()

const emit = defineEmits<{
  move: [id: number, x: number, y: number]
  drop: [id: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const uid = Math.random().toString(36).slice(2, 8)
const activeId = ref<number | null>(null)
const dragOffset = ref({ dx: 0, dy: 0 })

/** 已放置块排在前面（先绘制），未放置在后（覆盖显示，方便拖拽） */
const sortedPieces = computed(() =>
  [...props.pieces].sort((a, b) => Number(a.placed) - Number(b.placed))
)

/** 将 path 平移到该块当前 (x, y)：SVG path 已是绝对坐标，
 *  这里通过 transform 的方式修改成本较高，因此我们生成一个偏移过的 path。
 *  为了简单，我们直接用一个 <g transform> 包裹，但因为 clipPath 引用的是块自身坐标，
 *  这里采用平移后的 path。 */
function translatePath(p: PieceState): string {
  const dx = p.x - p.targetX
  const dy = p.y - p.targetY
  if (dx === 0 && dy === 0) return p.path
  // 简单方法：使用 SVG path 前置 M 语义 - 直接对每个数字做偏移的解析很复杂，
  // 这里通过 path 前置 translate 技巧：不可行于 d 属性，因此手动解析并偏移坐标。
  return offsetPath(p.path, dx, dy)
}

/** 解析 path 并对所有坐标进行整体平移 */
function offsetPath(d: string, dx: number, dy: number): string {
  // 支持 M / L / C 命令 + 数字（当前 puzzle.ts 只生成这些命令 + Z）
  return d.replace(/([MLC])([^MLCZ]*)/g, (_, cmd: string, coords: string) => {
    const nums = coords.trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const shifted = nums.map((n, i) => (i % 2 === 0 ? n + dx : n + dy))
    return `${cmd} ${shifted.join(' ')} `
  })
}

/** 将屏幕坐标转换为 SVG 坐标 */
function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
  const svg = wrapRef.value?.querySelector('svg') as SVGSVGElement | null
  if (!svg) return { x: 0, y: 0 }
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function onPointerDown(e: PointerEvent, id: number) {
  const p = props.pieces.find((it) => it.id === id)
  if (!p || p.placed) return
  activeId.value = id
  const svgPt = toSvgPoint(e.clientX, e.clientY)
  dragOffset.value = {
    dx: svgPt.x - p.x,
    dy: svgPt.y - p.y
  }
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (activeId.value == null) return
  const svgPt = toSvgPoint(e.clientX, e.clientY)
  const nx = svgPt.x - dragOffset.value.dx
  const ny = svgPt.y - dragOffset.value.dy
  // 目标坐标是块左上角 target；p.x/p.y 存的也是块左上角
  emit('move', activeId.value, nx, ny)
}

function onPointerUp() {
  if (activeId.value == null) return
  emit('drop', activeId.value)
  activeId.value = null
}
</script>

<style scoped>
.board-wrap {
  width: 100%;
  user-select: none;
  touch-action: none;
}
.board {
  width: 100%;
  height: auto;
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: block;
}
.piece {
  cursor: grab;
}
.piece.active {
  cursor: grabbing;
}
.piece.placed {
  cursor: default;
}
</style>
