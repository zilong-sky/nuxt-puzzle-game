<!-- app/pages/play/casual.vue - 休闲模式：先选难度，30 张随机图 -->
<template>
  <DifficultyModal
    :open="!pieceCountChosen"
    :min="4" :max="50" :initial="25"
    @confirm="onDifficultyConfirm"
    @cancel="onDifficultyCancel"
  />
  <div v-if="current && pieceCountChosen">
    <PuzzleGame
      :image-url="current.url"
      :piece-count="pieceCount"
      mode-label="?? 休闲模式"
      :show-score="false"
      next-label="下一张"
      @success="onSuccess"
      @fail="onFail"
      @abort="onAbort"
      @next="loadNext"
    />
  </div>
  <div v-else-if="pieceCountChosen" class="card">加载中...</div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import DifficultyModal from '~/components/DifficultyModal.vue'
import { fetchCasualImages, type PuzzleImage } from '~/services/imageService'

const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(48)
const pieceCountChosen = ref(false)

const current = computed(() => list.value[idx.value])

onMounted(async () => {
  const raw = await fetchCasualImages()
  const arr = raw.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  list.value = arr
})

function onDifficultyConfirm(v: number) {
  pieceCount.value = v
  pieceCountChosen.value = true
}
function onDifficultyCancel() { navigateTo('/') }
function loadNext() {
  idx.value = (idx.value + 1) % list.value.length
}
function onSuccess() {}
function onFail() {}
function onAbort() { navigateTo('/') }
</script>
