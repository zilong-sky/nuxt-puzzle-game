<!-- app/pages/play/cloud.vue - 云冒险模式：按上传时间顺序，含计分/排行/次数限制 -->
<template>
  <div v-if="current">
    <PuzzleGame
      :image-url="current.url"
      :piece-count="pieceCount"
      :mode-label="`☁️ 云冒险 · ${current.uploader ?? '匿名'}`"
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
import { fetchCloudImages, type PuzzleImage } from '~/services/imageService'
import { submitScore } from '~/services/rankService'
import { useGameStore } from '~/stores/gameStore'
import { randInt } from '~/utils/random'

const game = useGameStore()
const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(randInt(30, 200))
const noPlays = ref(false)
const adVisible = ref(false)

const current = computed(() => list.value[idx.value])

onMounted(async () => {
  game.hydrate()
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  // 本次云冒险入口消耗一次
  game.consumeCloudPlay()
  list.value = await fetchCloudImages()
  pieceCount.value = randInt(30, 200)
})

function onSuccess(score: number) {
  game.submitCloudScore(score)
  // 后续对接后端修改此处：submitScore 目前为 mock，可发送真实上报
  submitScore(score)
}
function onFail() { /* 交由 PuzzleGame 内部弹窗处理 */ }
function loadNext() {
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  game.consumeCloudPlay()
  idx.value = (idx.value + 1) % list.value.length
  pieceCount.value = randInt(30, 200)
}
function onAbort() { goHome() }
function goHome() { navigateTo('/') }
function onWatchAd() { adVisible.value = true }
function onAdDone() {
  adVisible.value = false
  game.grantExtraPlay()
  noPlays.value = false
  // 消耗刚刚获得的次数并继续
  game.consumeCloudPlay()
  loadNextAfterReward()
}
function loadNextAfterReward() {
  if (!list.value.length) {
    fetchCloudImages().then((l) => { list.value = l })
  }
}
function onUnlockPremium() {
  // 后续对接后端修改此处：应先跳转支付流程，成功后再解锁
  game.unlockPremium()
  noPlays.value = false
}
</script>

<style scoped>
.premium-btn { background: linear-gradient(45deg,#f59e0b,#ef4444); }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
</style>
