<!-- app/components/DifficultyRangeModal.vue - 单圆环双端点难度区间选择 -->
<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('cancel')">
    <div class="modal-card">
      <h3>选择难度区间</h3>
      <p class="hint">拖动蓝点选最低、金点选最高；每张图在区间内随机</p>
      <DifficultyRangeDial v-model="range" :min="min" :max="max" label="块" />
      <div class="legend">
        <span><i class="dot lo"></i> 最低 <b>{{ range.min }}</b></span>
        <span><i class="dot hi"></i> 最高 <b>{{ range.max }}</b></span>
      </div>
      <div class="btns">
        <button type="button" class="ghost-btn" @click="$emit('cancel')">取消</button>
        <button type="button" class="primary-btn" @click="$emit('confirm', { min: range.min, max: range.max })">
          开始游戏
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import DifficultyRangeDial from '~/components/DifficultyRangeDial.vue'

const props = withDefaults(defineProps<{
  open: boolean
  min?: number
  max?: number
  initialMin?: number
  initialMax?: number
}>(), { min: 4, max: 200, initialMin: 20, initialMax: 60 })

defineEmits<{ confirm: [value: { min: number; max: number }]; cancel: [] }>()

const range = ref({ min: props.initialMin, max: props.initialMax })
watch(() => props.open, (o) => {
  if (o) range.value = { min: props.initialMin, max: props.initialMax }
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal-card {
  background: #fff; border-radius: 16px; padding: 20px;
  width: min(92vw, 380px); box-shadow: 0 10px 40px rgba(0,0,0,0.25);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.modal-card h3 { margin: 0; font-size: 18px; color: var(--color-text,#222); }
.hint { margin: 0; font-size: 12px; color: var(--color-text-soft,#888); text-align: center; }
.legend { display: flex; gap: 20px; font-size: 13px; color: var(--color-text,#333); margin-top: 4px; }
.legend b { color: #d4af37; font-size: 15px; margin-left: 4px; }
.dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; vertical-align:middle; }
.dot.lo { background:#2563eb; }
.dot.hi { background:#d4af37; }
.btns { display: flex; gap: 8px; justify-content: flex-end; width: 100%; margin-top: 6px; }
.ghost-btn { background: transparent; border: 1px solid var(--color-border,#d0d0d0);
  color: var(--color-text,#333); padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.primary-btn { background: #d4af37; color: #fff; border: none;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; }
.primary-btn:hover { background: #c39d2e; }
</style>
