<!--
  app/components/PuzzleGame.vue
  Mobile-first swap-only puzzle wrapper. Owns HUD, item bar, success/fail
  dialogs and the ad revive flow. The board is sized by CSS so it fills the
  viewport without scrolling.
-->
<template>
  <div class="game">
    <div class="hud card">
      <div class="left">
        <div class="mode-tag">{{ modeLabel }}</div>
        <div class="time" :class="{ danger: timeLeft <= 10, freeze: frozen }">
          ⏱ {{ formatTime(timeLeft) }}
          <span v-if="frozen" class="badge freeze-badge">冻结中</span>
        </div>
      </div>
      <div class="right">
        <div class="progress-text">
          进度：{{ placedCount }} / {{ pieces.length }}
        </div>
        <div class="score" v-if="showScore">得分：{{ placedCount }}</div>
      </div>
    </div>

    <div class="board-holder">
      <PuzzleBoard
        :image-url="imageUrl"
        :pieces="pieces"
        :cols="cols"
        :rows="rows"
        :board-w="boardW"
        :board-h="boardH"
        @swap="onSwap"
      />
    </div>

    <div class="items card">
      <button
        class="item-btn"
        :disabled="!running || game.items.restore <= 0"
        @click="doRestore"
      >
        🧠 智能还原 × {{ game.items.restore }}
      </button>
      <button
        class="item-btn"
        :disabled="!running || game.items.freeze <= 0 || frozen"
        @click="doFreeze"
      >
        ❄️ 时间冻结 × {{ game.items.freeze }}
      </button>
      <button class="ghost-btn" @click="$emit('abort')">退出本局</button>
    </div>

    <ModalDialog :visible="finished" title="🎉 拼图完成" :closable="false">
      <p>你成功拼完了这张图片！</p>
      <p v-if="showScore">本局得分：<strong>{{ placedCount }}</strong> 分</p>
      <template #footer>
        <button class="ghost-btn" @click="$emit('abort')">返回</button>
        <button @click="$emit('next')">{{ nextLabel }}</button>
      </template>
    </ModalDialog>

    <ModalDialog :visible="failed && !adVisible" title="⏰ 时间到" :closable="false">
      <p>倒计时结束啦，可通过观看广告获得复活机会：时间将全额重置，继续当前拼图。</p>
      <template #footer>
        <button class="ghost-btn" @click="$emit('abort')">放弃本局</button>
        <button @click="watchReviveAd">📺 看广告复活</button>
      </template>
    </ModalDialog>

    <AdModal :visible="adVisible" :duration="2" @done="onAdDone" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PuzzleBoard from './PuzzleBoard.vue'
import ModalDialog from './ModalDialog.vue'
import AdModal from './AdModal.vue'
import { usePuzzleGame } from '~/composables/usePuzzleGame'
import { useGameStore } from '~/stores/gameStore'
import { formatTime } from '~/utils/time'
import { playRewardAd } from '~/services/adService'

const props = defineProps<{
  imageUrl: string
  pieceCount: number
  modeLabel: string
  showScore?: boolean
  nextLabel?: string
}>()
const emit = defineEmits<{ success: [score: number]; fail: []; abort: []; next: [] }>()

const game = useGameStore()

const {
  boardW, boardH, cols, rows,
  pieces, timeLeft, running, finished, failed, frozen,
  placedCount,
  init, swapPieces, useRestore, useFreeze, reviveByAd
} = usePuzzleGame({
  imageUrl: props.imageUrl,
  pieceCount: props.pieceCount,
  onSuccess: () => emit('success', pieces.value.length),
  onFail: () => emit('fail')
})

const adVisible = ref(false)
const nextLabel = props.nextLabel ?? '下一张'

onMounted(() => {
  init()
})

watch(
  () => [props.imageUrl, props.pieceCount],
  () => init()
)

function onSwap(aId: number, bId: number) {
  swapPieces(aId, bId)
}
function doRestore() {
  if (game.useItem('restore')) useRestore()
}
function doFreeze() {
  if (game.useItem('freeze')) useFreeze()
}
function watchReviveAd() {
  adVisible.value = true
  playRewardAd()
}
function onAdDone() {
  adVisible.value = false
  reviveByAd()
}
</script>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.hud {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  flex-wrap: wrap;
}
.mode-tag {
  display: inline-block;
  background: var(--color-primary);
  color: #fff;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  margin-bottom: 2px;
}
.time { font-size: 20px; font-weight: bold; }
.time.danger { color: var(--color-danger); }
.time.freeze { color: var(--color-primary); }
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  margin-left: 4px;
  font-weight: normal;
  vertical-align: middle;
}
.freeze-badge { background: #e0edff; color: var(--color-primary); }
.right { text-align: right; }
.progress-text { font-size: 12px; color: var(--color-text-soft); }
.score { font-size: 14px; font-weight: bold; }

.board-holder {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  /* Cap the visible board to whichever is smaller: viewport width or
     available height. This keeps everything on one mobile screen. */
}
.board-holder :deep(.puzzle-wrap) {
  width: min(100%, calc(100dvh - 220px));
  max-width: 720px;
}

.items {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 12px;
}
.item-btn { background: var(--color-warning); flex: 1 1 auto; min-width: 0; font-size: 13px; }
.item-btn:hover { background: #d97706; }
.ghost-btn {
  background: transparent; color: var(--color-text);
  border: 1px solid var(--color-border);
  flex: 1 1 auto;
  font-size: 13px;
}
.ghost-btn:hover { background: #f3f4f6; }

@media (min-width: 720px) {
  .board-holder :deep(.puzzle-wrap) {
    width: min(100%, calc(100dvh - 240px), 640px);
  }
}
</style>

