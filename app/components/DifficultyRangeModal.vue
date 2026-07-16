<!-- app/components/DifficultyRangeModal.vue - 休闲模式难度区间选择（闭区间 [min,max]） -->
<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal-card">
      <h3>选择难度区间</h3>
      <p class="hint">每张图会在区间内随机取一个难度，两端都包含</p>

      <div class="dials">
        <div class="dial-col">
          <div class="dial-label">最低</div>
          <DifficultyDial v-model="lo" :min="min" :max="max" label="块" />
        </div>
        <div class="dial-col">
          <div class="dial-label">最高</div>
          <DifficultyDial v-model="hi" :min="min" :max="max" label="块" />
        </div>
      </div>

      <div class="preview">区间：<b>{{ finalLo }}</b> ~ <b>{{ finalHi }}</b></div>

      <div class="btns">
        <button type="button" class="ghost-btn" @click="$emit('cancel')">取消</button>
        <button type="button" class="primary-btn" @click="$emit('confirm', { min: finalLo, max: finalHi })">
          开始游戏
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import DifficultyDial from '~/components/DifficultyDial.vue'

const props = withDefaults(defineProps<{
  open: boolean
  min?: number
  max?: number
  initialMin?: number
  initialMax?: number
}>(), { min: 4, max: 200, initialMin: 20, initialMax: 60 })

defineEmits<{ confirm: [value: { min: number; max: number }]; cancel: [] }>()

const lo = ref(props.initialMin)
const hi = ref(props.initialMax)

watch(() => props.open, (o) => {
  if (o) { lo.value = props.initialMin; hi.value = props.initialMax }
})

// 用户选反了自动 swap，展示时保证 lo<=hi
const finalLo = computed(() => Math.min(lo.value, hi.value))
const finalHi = computed(() => Math.max(lo.value, hi.value))
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  width: min(94vw, 420px);
  box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  display: flex; flex-direction: column; align-items: center;
  gap: 10px;
}
.modal-card h3 { margin: 0; font-size: 18px; color: var(--color-text,#222); }
.hint { margin: 0; font-size: 12px; color: var(--color-text-soft,#888); text-align: center; }
.dials { display: flex; gap: 16px; width: 100%; justify-content: center; margin-top: 4px; }
.dial-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dial-label { font-size: 12px; color: var(--color-text-soft,#888); }
.preview { font-size: 14px; color: var(--color-text,#333); margin-top: 4px; }
.preview b { color: #d4af37; font-size: 16px; margin: 0 4px; }
.btns { display: flex; gap: 8px; justify-content: flex-end; width: 100%; margin-top: 8px; }
.ghost-btn {
  background: transparent; border: 1px solid var(--color-border,#d0d0d0);
  color: var(--color-text,#333); padding: 8px 16px; border-radius: 8px; cursor: pointer;
}
.primary-btn {
  background: #d4af37; color: #fff; border: none;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600;
}
.primary-btn:hover { background: #c39d2e; }
</style>
