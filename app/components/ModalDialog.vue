<!-- app/components/ModalDialog.vue - 通用弹窗 -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="mask" @click.self="onMask">
      <div class="dialog">
        <div class="head" v-if="title">
          <strong>{{ title }}</strong>
          <button v-if="closable" class="close" @click="$emit('close')">×</button>
        </div>
        <div class="body">
          <slot />
        </div>
        <div class="foot" v-if="$slots.footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  title?: string
  closable?: boolean
  maskClose?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
function onMask() {
  if (props.maskClose) emit('close')
}
</script>

<style scoped>
.mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.dialog {
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  animation: pop 0.15s ease-out;
}
@keyframes pop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.head {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex; justify-content: space-between; align-items: center;
}
.close {
  background: transparent; color: var(--color-text-soft);
  padding: 0; font-size: 22px; line-height: 1;
}
.close:hover { background: transparent; color: var(--color-danger); }
.body { padding: 16px; font-size: 14px; color: var(--color-text); line-height: 1.6; }
.foot { padding: 12px 16px; border-top: 1px solid var(--color-border); display: flex; gap: 8px; justify-content: flex-end; }
</style>
