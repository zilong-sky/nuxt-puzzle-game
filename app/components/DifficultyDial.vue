<!--
  app/components/DifficultyDial.vue
  A 270° arc SVG dial for selecting a numeric value.
  - v-model compatible (props.modelValue / emit update:modelValue)
  - Pointer and keyboard interaction
  - Arc spans 45° clockwise through 180° to 315° (12 o'clock = 0°, clockwise positive).
    Opening/dead zone is at the top (12 o'clock °45°).
-->
<template>
  <div
    class="dial-wrap"
    :aria-label="label"
    role="slider"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    tabindex="0"
    @keydown="onKey"
  >
    <svg
      ref="svgRef"
      class="dial-svg"
      viewBox="0 0 240 240"
      @pointerdown="onPointerDown"
    >
      <!-- track -->
      <path
        class="track"
        :d="arcPath(START_DEG, END_DEG)"
        fill="none"
        stroke="#c8ccd6"
        stroke-width="14"
        stroke-linecap="round"
      />
      <!-- progress -->
      <path
        class="progress"
        :d="arcPath(START_DEG, currentAngleDeg)"
        fill="none"
        stroke="#d4af37"
        stroke-width="14"
        stroke-linecap="round"
      />
      <!-- knob -->
      <circle
        class="knob"
        :cx="knob.x"
        :cy="knob.y"
        r="12"
        fill="#ffffff"
        stroke="#d4af37"
        stroke-width="3"
      />
      <!-- center number -->
      <text
        class="value-text"
        x="120"
        y="118"
        text-anchor="middle"
        dominant-baseline="middle"
      >{{ modelValue }}</text>
      <text
        class="label-text"
        x="120"
        y="150"
        text-anchor="middle"
        dominant-baseline="middle"
      >{{ label || '难度' }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min: number
  max: number
  step?: number
  label?: string
}>(), { step: 1, label: '' })

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

// Opening at 12 o'clock (°45°). Arc starts at 45° (upper-right, ~1:30),
// sweeps 270° clockwise through 90° (3), 180° (6), 270° (9) and ends
// at 315° (upper-left, ~10:30). Dead zone is the top gap.
const START_DEG = 45
const END_DEG = 315
const SPAN_DEG = 270

const CENTER = { x: 120, y: 120 }
const RADIUS = 92

const svgRef = ref<SVGSVGElement | null>(null)
let capturedPointerId: number | null = null

const currentAngleDeg = computed(() => {
  const t = (clamp(props.modelValue, props.min, props.max) - props.min) / (props.max - props.min || 1)
  return START_DEG + t * SPAN_DEG
})

const knob = computed(() => polarToCartesian(CENTER.x, CENTER.y, RADIUS, currentAngleDeg.value))

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Convert degrees where 0 = 12 o'clock, positive = clockwise. */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(fromDeg: number, toDeg: number) {
  const start = polarToCartesian(CENTER.x, CENTER.y, RADIUS, fromDeg)
  const end = polarToCartesian(CENTER.x, CENTER.y, RADIUS, toDeg)
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = toDeg >= fromDeg ? 1 : 0
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} ${sweep} ${end.x} ${end.y}`
}

function pointerToValue(clientX: number, clientY: number): number | null {
  const svg = svgRef.value
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  // Map to viewBox coords (240 x 240)
  const vx = ((clientX - rect.left) / rect.width) * 240
  const vy = ((clientY - rect.top) / rect.height) * 240
  const dx = vx - CENTER.x
  const dy = vy - CENTER.y
  // atan2 where 0 = 12 o'clock, clockwise positive. Normalize to [0, 360).
  const rawDeg = (Math.atan2(dx, -dy) * 180) / Math.PI // -180..180
  const clockDeg = (rawDeg + 360) % 360
  // Arc covers clockDeg in [45, 315]. The gap is the top (315, 360) ∪ [0, 45).
  let t: number
  if (clockDeg >= START_DEG && clockDeg <= END_DEG) {
    t = (clockDeg - START_DEG) / SPAN_DEG
  } else {
    // Dead zone at the top: snap to whichever endpoint is closer.
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

function emitValue(v: number) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function onPointerDown(e: PointerEvent) {
  const v = pointerToValue(e.clientX, e.clientY)
  if (v !== null) emitValue(v)
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
  if (v !== null) emitValue(v)
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
}

function onKey(e: KeyboardEvent) {
  let delta = 0
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      delta = -props.step; break
    case 'ArrowRight':
    case 'ArrowUp':
      delta = props.step; break
    case 'PageDown': delta = -props.step * 10; break
    case 'PageUp': delta = props.step * 10; break
    case 'Home': emitValue(props.min); e.preventDefault(); return
    case 'End': emitValue(props.max); e.preventDefault(); return
    default: return
  }
  emitValue(clamp(props.modelValue + delta, props.min, props.max))
  e.preventDefault()
}
</script>

<style scoped>
.dial-wrap {
  display: inline-block;
  width: 240px;
  max-width: 100%;
  outline: none;
}
.dial-wrap:focus-visible .dial-svg {
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.6));
}
.dial-svg {
  width: 100%;
  height: auto;
  display: block;
  touch-action: none;
  user-select: none;
}
.knob {
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2));
  cursor: grab;
}
.knob:active { cursor: grabbing; }
.value-text {
  font-size: 48px;
  font-weight: 700;
  fill: var(--color-text, #222);
  font-family: inherit;
}
.label-text {
  font-size: 12px;
  fill: var(--color-text-soft, #888);
}
</style>