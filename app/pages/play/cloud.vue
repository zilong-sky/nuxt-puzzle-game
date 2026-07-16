<!-- app/pages/play/cloud.vue - 冒险模式：暂用休闲图池，顺序固定 + 全局进度持久化 -->
<template>
  <div v-if="current">
    <PuzzleGame
      :image-url="current.url"
      :piece-count="pieceCount"
      :mode-label="`☁️ 云冒险 · 第 ${idx + 1} 关`"
      :show-score="true"
      next-label="下一张"
      @success="onSuccess"
      @fail="onFail"
      @abort="onAbort"
      @next="loadNext"
    />
  </div>
  <div v-else class="card">加载中...</div>

  <ModalDialog :visible="noPlays" title="😥 今日次数已用完" :closable="false">
    <p>今日 5 次免费云冒险机会已用完。可通过以下方式继续：</p>
    <template #footer>
      <button class="ghost-btn" @click="goHome">返回首页</button>
      <button @click="onWatchAd">📺 看广告 +1 次</button>
      <button class="premium-btn" @click="onUnlockPremium">💎 永久解锁</button>
    </template>
  </ModalDialog>

  <AdModal :visible="adVisible" :duration="2" @done="onAdDone" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import ModalDialog from '~/components/ModalDialog.vue'
import AdModal from '~/components/AdModal.vue'
import { fetchCasualImages, type PuzzleImage } from '~/services/imageService'
import { submitScore } from '~/services/rankService'
import { useGameStore } from '~/stores/gameStore'
import { randInt } from '~/utils/random'

const game = useGameStore()
const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(randInt(30, 80))
const noPlays = ref(false)
const adVisible = ref(false)

const current = computed(() => list.value[idx.value])

onMounted(async () => {
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
  game.hydrate()
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  game.consumeCloudPlay()
  list.value = await fetchCasualImages()
  if (list.value.length > 0) {
    idx.value = Math.min(game.adventureIdx, list.value.length - 1)
  }
  pieceCount.value = randInt(30, 80)
})

function onSuccess(score: number) {
  game.submitCloudScore(score)
  submitScore(score)
}
function onFail() { /* 由 PuzzleGame 内部弹窗处理 */ }
function loadNext() {
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  game.consumeCloudPlay()
  idx.value = (idx.value + 1) % list.value.length
  game.setAdventureIdx(idx.value)
  pieceCount.value = randInt(30, 80)
}
function onAbort() { goHome() }
function goHome() { navigateTo('/') }
function onWatchAd() { adVisible.value = true }
function onAdDone() {
  adVisible.value = false
  game.grantExtraPlay()
  noPlays.value = false
  game.consumeCloudPlay()
  loadNextAfterReward()
}
function loadNextAfterReward() {
  if (!list.value.length) {
    fetchCasualImages().then((l) => { list.value = l })
  }
}
function onUnlockPremium() {
  game.unlockPremium()
  noPlays.value = false
}
</script>

<style scoped>
.premium-btn { background: linear-gradient(45deg,#f59e0b,#ef4444); }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
</style>