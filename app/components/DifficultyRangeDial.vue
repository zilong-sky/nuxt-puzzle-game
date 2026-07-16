<!--
  app/components/DifficultyRangeDial.vue
  一个 270° 圆环，两头都能选（低端 + 高端）。
  - v-model 传入 { min, max }
  - 点击/拖动最近的 knob；两 knob 可交叉自动 swap
-->
<template>
  <div class="dial-wrap" role="group" :aria-label="label">
    <svg
      ref="svgRef"
      class="dial-svg"
      viewBox="0 0 240 240"
      @pointerdown="onPointerDown"
    >
      <!-- 整段灰色 track -->
      <path
        :d="arcPath(START_DEG, END_DEG)"
        fill="none" stroke="#c8ccd6" stroke-width="14" stroke-linecap="round"
      />
      <!-- 中间高亮：从 lo 到 hi -->
      <path
        :d="arcPath(angleOf(lo), angleOf(hi))"
        fill="none" stroke="#d4af37" stroke-width="14" stroke-linecap="round"
      />
      <!-- 低端 knob -->
      <circle
        :cx="knobLo.x" :cy="knobLo.y" r="12"
        fill="#ffffff" stroke="#2563eb" stroke-width="3"
        style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2))"
      />
      <!-- 高端 knob -->
      <circle
        :cx="knobHi.x" :cy="knobHi.y" r="12"
        fill="#ffffff" stroke="#d4af37" stroke-width="3"
        style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2))"
      />
      <!-- 中央文字 -->
      <text x="120" y="105" text-anchor="middle" dominant-baseline="middle"
        style="font-size:34px; font-weight:700; fill: var(--color-text,#222)">
        {{ lo }} ~ {{ hi }}
      </text>
      <text x="120" y="135" text-anchor="middle" dominant-baseline="middle"
        style="font-size:12px; fill: var(--color-text-soft,#888)">
        {{ label || '难度区间' }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: { min: number; max: number }
  min: number
  max: number
  step?: number
  label?: string
}>(), { step: 1, label: '' })

const emit = defineEmits<{ 'update:modelValue': [value: { min: number; max: number }] }>()

const START_DEG = 315
const END_DEG = 45
const SPAN_DEG = 270
const CENTER = { x: 120, y: 120 }
const RADIUS = 92

const svgRef = ref<SVGSVGElement | null>(null)
let capturedPointerId: number | null = null
let dragging: 'lo' | 'hi' | null = null

const lo = computed(() => clamp(props.modelValue.min, props.min, props.max))
const hi = computed(() => clamp(props.modelValue.max, props.min, props.max))

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }

function angleOf(value: number) {
  const t = (clamp(value, props.min, props.max) - props.min) / (props.max - props.min || 1)
  return (START_DEG - t * SPAN_DEG + 360) % 360
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

const knobLo = computed(() => polar(CENTER.x, CENTER.y, RADIUS, angleOf(lo.value)))
const knobHi = computed(() => polar(CENTER.x, CENTER.y, RADIUS, angleOf(hi.value)))

function arcPath(fromDeg: number, toDeg: number) {
  const s = polar(CENTER.x, CENTER.y, RADIUS, fromDeg)
  const e = polar(CENTER.x, CENTER.y, RADIUS, toDeg)
  // 只走底部弧线：从 fromDeg 顺时针（角度减小）到 toDeg
  const from = (fromDeg + 360) % 360
  const to = (toDeg + 360) % 360
  const sweep = 0 // 逆时针在 SVG 坐标里等价于顺时针视觉（Y 轴翻转）
  // 我们要走"下半"路径：如果 from < to（如 lo=hi 且都在右侧），会绕大圈；用弧长判断 large
  let arcLen = from - to
  if (arcLen < 0) arcLen += 360
  const large = arcLen > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${RADIUS} ${RADIUS} 0 ${large} ${sweep} ${e.x} ${e.y}`
}

function pointerToValue(clientX: number, clientY: number): number | null {
  const svg = svgRef.value
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const vx = ((clientX - rect.left) / rect.width) * 240
  const vy = ((clientY - rect.top) / rect.height) * 240
  const dx = vx - CENTER.x
  const dy = vy - CENTER.y
  const rawDeg = (Math.atan2(dx, -dy) * 180) / Math.PI
  const clockDeg = (rawDeg + 360) % 360
  let t: number
  if (clockDeg >= END_DEG && clockDeg <= START_DEG) {
    t = (START_DEG - clockDeg) / SPAN_DEG
  } else {
    const dStart = angularDist(clockDeg, START_DEG)
    const dEnd = angularDist(clockDeg, END_DEG)
    t = dStart < dEnd ? 0 : 1
  }
  const raw = props.min + t * (props.max - props.min)
  const stepped = Math.round(raw / props.step) * props.step
  return clamp(stepped, props.min, props.max)
}
function angularDist(a: number, b: number) {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function emitBoth(newLo: number, newHi: number) {
  const lo2 = Math.min(newLo, newHi)
  const hi2 = Math.max(newLo, newHi)
  if (lo2 !== props.modelValue.min || hi2 !== props.modelValue.max) {
    emit('update:modelValue', { min: lo2, max: hi2 })
  }
}

function pickNearestKnob(v: number): 'lo' | 'hi' {
  const dLo = Math.abs(v - lo.value)
  const dHi = Math.abs(v - hi.value)
  return dLo <= dHi ? 'lo' : 'hi'
}

function applyDragValue(v: number) {
  if (dragging === 'lo') emitBoth(v, hi.value)
  else if (dragging === 'hi') emitBoth(lo.value, v)
}

function onPointerDown(e: PointerEvent) {
  const v = pointerToValue(e.clientX, e.clientY)
  if (v === null) return
  dragging = pickNearestKnob(v)
  applyDragValue(v)
  const svg = svgRef.value
  if (svg) {
    svg.setPointerCapture?.(e.pointerId)
    capturedPointerId = e.pointerId
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerUp)
  }
  e.preventDefault()
}
function onPointerMove(e: PointerEvent) {
  if (capturedPointerId !== null && e.pointerId !== capturedPointerId) return
  const v = pointerToValue(e.clientX, e.clientY)
  if (v !== null) applyDragValue(v)
}
function onPointerUp(e: PointerEvent) {
  const svg = svgRef.value
  if (svg) {
    svg.releasePointerCapture?.(e.pointerId)
    svg.removeEventListener('pointermove', onPointerMove)
    svg.removeEventListener('pointerup', onPointerUp)
    svg.removeEventListener('pointercancel', onPointerUp)
  }
  capturedPointerId = null
  dragging = null
}
</script>

<style scoped>
.dial-wrap { display: inline-block; width: 240px; max-width: 100%; outline: none; }
.dial-svg { width: 100%; height: auto; display: block; touch-action: none; user-select: none; }
</style>
