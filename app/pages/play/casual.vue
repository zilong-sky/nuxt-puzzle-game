<!-- app/pages/play/casual.vue - 休闲模式：区间难度，每张图随机取值 -->
<template>
  <DifficultyRangeModal
    :open="!rangeChosen"
    :min="4" :max="80"
    :initial-min="20" :initial-max="60"
    @confirm="onRangeConfirm"
    @cancel="onRangeCancel"
  />
  <div v-if="current && rangeChosen">
    <PuzzleGame
      :key="current.url"
      :image-url="current.url"
      :piece-count="pieceCount"
      mode-label="🌿 休闲模式"
      :show-score="false"
      next-label="下一张"
      @success="onSuccess"
      @fail="onFail"
      @abort="onAbort"
      @next="loadNext"
    />
  </div>
  <div v-else-if="rangeChosen" class="card">加载中...</div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import DifficultyRangeModal from '~/components/DifficultyRangeModal.vue'
import { fetchCasualImages, type PuzzleImage } from '~/services/imageService'
import { randInt } from '~/utils/random'

const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(48)
const rangeChosen = ref(false)
const rangeMin = ref(20)
const rangeMax = ref(60)

const current = computed(() => list.value[idx.value])

function pickPieceCount() {
  const lo = Math.max(4, Math.min(rangeMin.value, rangeMax.value))
  const hi = Math.max(rangeMin.value, rangeMax.value)
  pieceCount.value = lo === hi ? lo : randInt(lo, hi)
}

onMounted(async () => {
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
  const raw = await fetchCasualImages()
  const arr = raw.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  list.value = arr
})

function onRangeConfirm(v: { min: number; max: number }) {
  rangeMin.value = v.min
  rangeMax.value = v.max
  pickPieceCount()
  rangeChosen.value = true
}
function onRangeCancel() { navigateTo('/') }
function loadNext() {
  idx.value = (idx.value + 1) % list.value.length
  pickPieceCount()
}
function onSuccess() {}
function onFail() {}
function onAbort() { navigateTo('/') }
</script>
