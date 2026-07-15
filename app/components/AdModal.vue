<!-- app/components/AdModal.vue - 广告占位弹窗 -->
<template>
  <ModalDialog :visible="visible" title="广告播放中" :closable="false">
    <div class="ad-body">
      <div class="ad-box">
        <div class="ad-tip">🎬 广告占位（后续对接后端修改此处）</div>
        <div class="progress">
          <div class="bar" :style="{ width: pct + '%' }" />
        </div>
        <div class="left">剩余 {{ Math.ceil(secondsLeft) }} 秒</div>
      </div>
    </div>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{
  visible: boolean
  /** 广告总时长秒 */
  duration?: number
}>()
const emit = defineEmits<{ done: [] }>()

const total = props.duration ?? 2
const secondsLeft = ref(total)
const pct = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function start() {
  secondsLeft.value = total
  pct.value = 0
  const startTs = Date.now()
  timer = setInterval(() => {
    const elapsed = (Date.now() - startTs) / 1000
    secondsLeft.value = Math.max(0, total - elapsed)
    pct.value = Math.min(100, (elapsed / total) * 100)
    if (elapsed >= total) {
      stop()
      emit('done')
    }
  }, 50)
}
function stop() {
  if (timer) { clearInterval(timer); timer = null }
}

watch(() => props.visible, (v) => {
  if (v) start()
  else stop()
}, { immediate: true })

onBeforeUnmount(stop)
</script>

<style scoped>
.ad-body { text-align: center; }
.ad-box { padding: 8px; }
.ad-tip { color: var(--color-text-soft); font-size: 14px; margin-bottom: 12px; }
.progress { width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
.bar { height: 100%; background: var(--color-primary); transition: width 0.1s linear; }
.left { margin-top: 8px; font-size: 13px; color: var(--color-text-soft); }
</style>
