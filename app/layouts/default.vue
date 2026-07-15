<!-- app/layouts/default.vue - 默认布局，包含头/尾。手机优先，单屏无滚动。 -->
<template>
  <div class="layout">
    <AppHeader />
    <main class="main-content" :class="{ 'is-play': isPlay }">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const route = useRoute()
const isPlay = computed(() => route.path.startsWith('/play'))
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
  justify-content: center;
  align-items: center;
}
@media (max-width: 640px) {
  .main-content { padding: 12px; }
  .main-content.is-play { padding: 6px 8px; }
}
</style>