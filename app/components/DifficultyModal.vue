<!-- app/components/DifficultyModal.vue - 难度选择弹窗 -->
<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal-card">
      <h3>选择难度</h3>
      <p class="hint">左低右高，滑动圆环选择</p>
      <DifficultyDial v-model="local" :min="min" :max="max" label="块数" />
      <div class="btns">
        <button type="button" class="ghost-btn" @click="$emit('cancel')">取消</button>
        <button type="button" class="primary-btn" @click="$emit('confirm', local)">开始游戏</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import DifficultyDial from '~/components/DifficultyDial.vue'

const props = withDefaults(defineProps<{
  open: boolean
  min?: number
  max?: number
  initial?: number
}>(), { min: 4, max: 200, initial: 48 })

defineEmits<{ confirm: [value: number]; cancel: [] }>()

const local = ref(props.initial)
watch(() => props.open, (o) => { if (o) local.value = props.initial })
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: min(90vw, 360px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  display: flex; flex-direction: column; align-items: center;
  gap: 12px;
}
.modal-card h3 { margin: 0; font-size: 18px; color: var(--color-text, #222); }
.hint { margin: 0; font-size: 12px; color: var(--color-text-soft, #888); }
.btns { display: flex; gap: 8px; justify-content: flex-end; width: 100%; margin-top: 8px; }
.ghost-btn {
  background: transparent;
  border: 1px solid var(--color-border, #d0d0d0);
  color: var(--color-text, #333);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}
.primary-btn {
  background: #d4af37;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.primary-btn:hover { background: #c39d2e; }
</style>
