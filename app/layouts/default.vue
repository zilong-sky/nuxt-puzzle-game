<!-- app/layouts/default.vue - 默认布局，包含页头/页尾。首屏请求昵称。 -->
<template>
  <div class="layout">
    <AppHeader />
    <main class="main-content" :class="{ 'is-play': isPlay }">
      <slot />
    </main>
    <AppFooter />
    <PlayerNameModal :visible="askName" @done="askName = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PlayerNameModal from '~/components/PlayerNameModal.vue'
import { useGameStore } from '~/stores/gameStore'

const route = useRoute()
const isPlay = computed(() => route.path.startsWith('/play'))

const game = useGameStore()
const askName = ref(false)

onMounted(() => {
  game.hydrate()
  if (!game.playerName) askName.value = true
})
</script>

<style scoped>
.layout {
  min-height: 100dvh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.main-content.is-play {
  padding: 8px 12px;
  min-height: 100dvh;
}
@media (max-width: 640px) {
  .main-content { padding: 12px; }
  .main-content.is-play { padding: 6px 8px; }
}
</style>
