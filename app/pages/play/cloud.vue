<!-- app/pages/play/cloud.vue - ??????? seq ASC ??????????????? -->
<template>
  <div v-if="loading" class="card">???...</div>

  <div v-else-if="list.length === 0" class="card empty">
    <h2>?? ???</h2>
    <p class="sub">?????????????????????????</p>
    <div class="actions">
      <button class="ghost-btn" @click="goHome">????</button>
      <button @click="goSelfie">?? ?????</button>
    </div>
  </div>

  <div v-else-if="current">
    <PuzzleGame
      :image-url="current.url"
      :piece-count="pieceCount"
      :mode-label="`☁️ 云冒险 · 第 ${idx + 1} 张`"
      :show-score="true"
      next-label="下一张"
      @success="onSuccess"
      @fail="onFail"
      @abort="onAbort"
      @next="loadNext"
    />
  </div>

  <ModalDialog :visible="noPlays" title="?? ???????" :closable="false">
    <p>?? 5 ??????????????????????</p>
    <template #footer>
      <button class="ghost-btn" @click="goHome">????</button>
      <button @click="onWatchAd">?? ??? +1 ?</button>
      <button class="premium-btn" @click="onUnlockPremium">?? ????</button>
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
import { getFingerprint } from '~/composables/useFingerprint'
import { useGameStore } from '~/stores/gameStore'
import { randInt } from '~/utils/random'

const game = useGameStore()
const list = ref<PuzzleImage[]>([])
const idx = ref(0)
const pieceCount = ref(randInt(30, 80))
const noPlays = ref(false)
const adVisible = ref(false)
const loading = ref(true)

const current = computed(() => list.value[idx.value])

onMounted(async () => {
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
  game.hydrate()
  try {
    list.value = await fetchCloudImages()
  } catch {
    list.value = []
  }
  loading.value = false
  if (list.value.length === 0) return
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  game.consumeCloudPlay()
  idx.value = Math.min(game.adventureIdx, list.value.length - 1)
  pieceCount.value = randInt(30, 80)
})

async function reportScore(score: number) {
  try {
    const fingerprint = await getFingerprint()
    await submitScore({
      player_name: game.playerName || 'anonymous',
      fingerprint,
      score,
      level_reached: idx.value + 1
    })
  } catch { /* ?????? */ }
}

function onSuccess(score: number) {
  game.submitCloudScore(score)
  reportScore(score)
}
function onFail() {
  reportScore(0)
}
function loadNext() {
  if (!game.canPlayCloud) {
    noPlays.value = true
    return
  }
  if (idx.value + 1 >= list.value.length) {
    game.consumeCloudPlay()
    idx.value = 0
  } else {
    game.consumeCloudPlay()
    idx.value += 1
  }
  game.setAdventureIdx(idx.value)
  pieceCount.value = randInt(30, 80)
}
function onAbort() { goHome() }
function goHome() { navigateTo('/') }
function goSelfie() { navigateTo('/play/selfie') }
function onWatchAd() { adVisible.value = true }
function onAdDone() {
  adVisible.value = false
  game.grantExtraPlay()
  noPlays.value = false
  game.consumeCloudPlay()
}
function onUnlockPremium() {
  game.unlockPremium()
  noPlays.value = false
}
</script>

<style scoped>
.premium-btn { background: linear-gradient(45deg,#f59e0b,#ef4444); }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.empty { text-align: center; }
.empty .sub { color: var(--color-text-soft); margin: 12px 0; }
.empty .actions { display: flex; gap: 10px; justify-content: center; margin-top: 12px; }
</style>
