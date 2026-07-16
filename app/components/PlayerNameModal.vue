<!-- app/components/PlayerNameModal.vue - ???????? -->
<template>
  <ModalDialog :visible="visible" title="?? ????" :closable="false">
    <p>??????????1-12 ?????????????????</p>
    <input
      v-model="name"
      class="name-input"
      type="text"
      maxlength="12"
      placeholder="????????"
      @keyup.enter="confirm"
    />
    <p class="hint" v-if="err">{{ err }}</p>
    <template #footer>
      <button @click="confirm">??</button>
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
  if (!v) { err.value = '??????'; return }
  if (v.length > 12) { err.value = '?? 12 ???'; return }
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
.name-input:focus { outline: none; border-color: var(--color-primary); }
.hint { color: var(--color-danger); font-size: 12px; margin: 6px 0 0; }
</style>
