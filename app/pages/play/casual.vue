<!-- app/pages/play/casual.vue - 休闲模式：按图库编号顺序加载 -->
<template>
  <div v-if="current">
    <PuzzleGame
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
  <div v-else class="card">加载中...</div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import { fetchCasualImages, type PuzzleImage } from '~/services/imageService'
import { randInt } from '~/utils/random'

const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(randInt(30, 80))

const current = computed(() => list.value[idx.value])

onMounted(async () => {
  list.value = await fetchCasualImages()
})

function loadNext() {
  idx.value = (idx.value + 1) % list.value.length
  pieceCount.value = randInt(30, 80)
}
function onSuccess() { /* 休闲模式不计分，不记录 */ }
function onFail() { /* 休闲模式失败也仅弹窗 */ }
function onAbort() { navigateTo('/') }
</script>
