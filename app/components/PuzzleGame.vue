<!--
  app/components/PuzzleGame.vue
  组合式拼图游戏组件。承担游戏 HUD、道具栏、失败/成功弹窗、广告复活等。
  由页面注入图片和参数，触发 next / abort / success 事件。
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

    <PuzzleBoard
      :image-url="imageUrl"
      :pieces="pieces"
      :cols="cols"
      :rows="rows"
      :board-w="boardW"
      :board-h="boardH"
      @place="onPlace"
      @return-to-tray="onReturnToTray"
    />

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

    <!-- 成功 -->
    <ModalDialog :visible="finished" title="🎉 拼图完成" :closable="false">
      <p>你成功拼完了这张图片！</p>
      <p v-if="showScore">本局得分：<strong>{{ placedCount }}</strong> 分</p>
      <template #footer>
        <button class="ghost-btn" @click="$emit('abort')">返回</button>
        <button @click="$emit('next')">{{ nextLabel }}</button>
      </template>
    </ModalDialog>

    <!-- 失败 -->
    <ModalDialog :visible="failed && !adVisible" title="⏰ 时间到" :closable="false">
      <p>倒计时结束啦，可通过观看广告获得复活机会：时间将全额重置，继续当前拼图。</p>
      <template #footer>
        <button class="ghost-btn" @click="$emit('abort')">放弃本局</button>
        <button @click="watchReviveAd">📺 看广告复活</button>
      </template>
    </ModalDialog>

    <!-- 广告播放 -->
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
  /** 是否显示得分（云冒险=true） */
  showScore?: boolean
  /** 下一步按钮文案（休闲/云冒险=下一张，自拍多图=下一张） */
  nextLabel?: string
}>()
const emit = defineEmits<{ success: [score: number]; fail: []; abort: []; next: [] }>()

const game = useGameStore()

const {
  boardW, boardH, cols, rows,
  pieces, timeLeft, running, finished, failed, frozen,
  placedCount,
  init, placePieceToSlot, returnPieceToTray, useRestore, useFreeze, reviveByAd
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

// 图片或块数变化时重新初始化
watch(
  () => [props.imageUrl, props.pieceCount],
  () => init()
)

function onPlace(id: number, slotIndex: number) {
  placePieceToSlot(id, slotIndex)
}
function onReturnToTray(id: number) {
  returnPieceToTray(id)
}
function doRestore() {
  if (game.useItem('restore')) useRestore()
}
function doFreeze() {
  if (game.useItem('freeze')) useFreeze()
}
function watchReviveAd() {
  adVisible.value = true
  // 也可以调用 playRewardAd() 触发真实 SDK - 此处占位
  playRewardAd()
}
function onAdDone() {
  adVisible.value = false
  reviveByAd()
}
</script>

<style scoped>
.game { display: flex; flex-direction: column; gap: 12px; }
.hud {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px;
}
.mode-tag {
  display: inline-block;
  background: var(--color-primary);
  color: #fff;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  margin-bottom: 6px;
}
.time { font-size: 22px; font-weight: bold; }
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
.progress-text { font-size: 13px; color: var(--color-text-soft); }
.score { font-size: 16px; font-weight: bold; margin-top: 4px; }

.items { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.item-btn { background: var(--color-warning); }
.item-btn:hover { background: #d97706; }
.ghost-btn {
  background: transparent; color: var(--color-text);
  border: 1px solid var(--color-border);
}
.ghost-btn:hover { background: #f3f4f6; }

@media (max-width: 640px) {
  .hud { flex-direction: column; align-items: flex-start; gap: 6px; }
  .right { text-align: left; }
  .items { justify-content: space-between; }
  .item-btn { flex: 1; }
}
</style>
