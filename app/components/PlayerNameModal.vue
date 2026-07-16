<!-- app/components/PlayerNameModal.vue - 首次进入设置昵称 -->
<template>
  <ModalDialog :visible="visible" title="👋 设置你的昵称" :closable="false">
    <p>请输入一个 1-12 字符的昵称，将用于云冒险排行榜显示。</p>
    <input
      v-model="name"
      class="name-input"
      type="text"
      maxlength="12"
      placeholder="例如：拼图达人"
      @keyup.enter="confirm"
    />
    <p class="hint" v-if="err">{{ err }}</p>
    <template #footer>
      <button @click="confirm">确认</button>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModalDialog from '~/components/ModalDialog.vue'
import { useGameStore } from '~/stores/gameStore'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ done: [] }>()
const game = useGameStore()
const name = ref('')
const err = ref('')

function confirm() {
  const v = name.value.trim()
  if (!v) { err.value = '昵称不能为空'; return }
  if (v.length > 12) { err.value = '昵称最多 12 个字符'; return }
  err.value = ''
  game.setPlayerName(v)
  emit('done')
}
</script>

<style scoped>
.name-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 15px;
  margin-top: 8px;
  box-sizing: border-box;
}
.hint {
  color: #e34a4a;
  font-size: 13px;
  margin-top: 6px;
}
button {
  padding: 8px 18px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary, #4a7cff);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
button:hover {
  opacity: 0.9;
}
</style>
