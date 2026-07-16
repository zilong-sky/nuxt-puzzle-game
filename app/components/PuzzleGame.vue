<!--
  app/components/PuzzleGame.vue
  Mobile-first swap-only puzzle wrapper. Owns HUD, item bar, success/fail
  dialogs and the ad revive flow. The board is sized by CSS so it fills the
  viewport without scrolling.
-->
<template>
  <div class="game">
    <div class="hud card" ref="hudRef">
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
      <!-- 完成后展示完整原图供欣赏 -->
      <div
        v-if="finished"
        class="finish-view"
        :style="{ width: wrapSize.w + 'px', height: wrapSize.h + 'px' }"
      >
        <img :src="renderImageUrl" alt="完成图" class="finish-img" />
        <div class="finish-badge">🎉 拼好了！</div>
      </div>
      <PuzzleBoard
        v-else
        :image-url="renderImageUrl"
        :pieces="pieces"
        :cols="cols"
        :rows="rows"
        :style="{ width: wrapSize.w + 'px', height: wrapSize.h + 'px' }"

        @move-group="onMoveGroup"
        @move-group-to-slot="onMoveGroupToSlot"
      />
      <div v-if="loading" class="loading-overlay">
        <div class="loading-card">
          <div class="loading-title">正在加载图片…</div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: loadProgress + '%' }"></div>
          </div>
          <div class="progress-num">{{ loadProgress }}%</div>
        </div>
      </div>
    </div>

    <div class="items card" ref="itemsRef">
      <template v-if="finished">
        <button class="ghost-btn" @click="$emit('abort')">返回</button>
        <button class="next-big" @click="$emit('next')">{{ nextLabel }} →</button>
      </template>
      <template v-else>
        <button
          class="item-btn"
          :disabled="!running || roundItems.restore <= 0"
          @click="doRestore"
        >
          🧠 智能还原 × {{ roundItems.restore }}
        </button>
        <button
          class="item-btn"
          :disabled="!running || roundItems.freeze <= 0 || frozen"
          @click="doFreeze"
        >
          ❄️ 时间冻结 × {{ roundItems.freeze }}
        </button>
        <button
          class="item-btn"
          :disabled="!running || roundItems.replay <= 0"
          @click="doReplay"
        >
          🔄 重玩本局 × {{ roundItems.replay }}
        </button>
        <button class="ghost-btn" @click="$emit('abort')">退出本局</button>
      </template>
    </div>

    <!-- 完成弹窗：默认不再阻塞欣赏，仅在 hideSuccessModal=false 时短暂显示（保留兼容） -->
    <ModalDialog :visible="false" title="🎉 拼图完成" :closable="false">
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
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import PuzzleBoard from './PuzzleBoard.vue'
import ModalDialog from './ModalDialog.vue'
import AdModal from './AdModal.vue'
import { usePuzzleGame } from '~/composables/usePuzzleGame'
import { formatTime } from '~/utils/time'
import { playRewardAd } from '~/services/adService'

const props = defineProps<{
  imageUrl: string
  pieceCount: number
  modeLabel: string
  showScore?: boolean
  nextLabel?: string
  hideSuccessModal?: boolean
}>()
const emit = defineEmits<{ success: [score: number]; fail: []; abort: []; next: [] }>()

const {
  cols, rows, aspect, renderImageUrl,
  pieces, timeLeft, running, finished, failed, frozen,
  placedCount,
  loading, loadProgress,
  roundItems,
  init, moveGroup, moveGroupToSlot, useRestore, useFreeze, useReplay, reviveByAd
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
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' })
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }
})

watch(
  () => [props.imageUrl, props.pieceCount],
  () => init()
)

function onMoveGroup(pieceId: number, dCol: number, dRow: number) {
  moveGroup(pieceId, dCol, dRow)
}
function onMoveGroupToSlot(pieceId: number, targetSlot: number) {
  moveGroupToSlot(pieceId, targetSlot)
}
function doRestore() { useRestore() }
function doFreeze() { useFreeze() }
function doReplay() { useReplay() }
function watchReviveAd() {
  adVisible.value = true
  playRewardAd()
}
function onAdDone() {
  adVisible.value = false
  reviveByAd()
}


const hudRef = ref<HTMLElement | null>(null)
const itemsRef = ref<HTMLElement | null>(null)

const viewportTick = ref(0)
function onViewportChange() { viewportTick.value++ }

const wrapSize = computed(() => {
  void viewportTick.value
  const a = aspect.value || 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const maxW = Math.min(vw - 32, 560)
  const maxH = Math.min(vh - 240, 900)
  let w = maxW
  let h = w / a
  if (h > maxH) {
    h = maxH
    w = h * a
  }
  const minW = Math.max(1, cols.value) * 50
  const minH = Math.max(1, rows.value) * 50
  w = Math.max(w, minW)
  h = Math.max(h, minH)
  return { w, h }
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('orientationchange', onViewportChange)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('orientationchange', onViewportChange)
  }
})
</script>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding-top: 8px;
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
  position: relative;
  display: flex;
  justify-content: center;
  padding: 0 16px;
  width: 100%;
}
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  z-index: 20;
  border-radius: var(--radius-md);
}
.loading-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  min-width: 200px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}
.loading-title {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 600;
}
.progress-track {
  width: 180px;
  height: 8px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #d4af37;
  transition: width 0.15s linear;
}
.progress-num {
  font-size: 12px;
  color: var(--color-text-soft);
}

.items {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 12px;
}
.finish-view {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  background: #000;
}
.finish-img { width: 100%; height: 100%; object-fit: contain; display: block; animation: reveal 0.6s ease; }
@keyframes reveal { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.finish-badge {
  position: absolute;
  top: 12px; left: 50%; transform: translateX(-50%);
  background: rgba(34, 197, 94, 0.95);
  color: #fff;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  animation: pop 0.5s ease;
}
@keyframes pop { 0% { transform: translateX(-50%) scale(0.6); opacity: 0; } 60% { transform: translateX(-50%) scale(1.15); opacity: 1; } 100% { transform: translateX(-50%) scale(1); } }
.next-big {
  flex: 2 1 auto;
  font-size: 16px;
  font-weight: 600;
  background: var(--color-primary);
  color: #fff;
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

@media (max-width: 480px) {
  .game { gap: 6px; }
  .hud { padding: 6px 10px; gap: 6px; }
  .hud .time { font-size: 16px; }
  .hud .mode-tag { font-size: 11px; }
  .items { padding: 6px 8px; gap: 6px; }
  .item-btn, .ghost-btn { font-size: 12px; padding: 6px 8px; }
}
</style>