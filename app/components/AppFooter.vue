<!-- app/components/AppFooter.vue - 底部版权 -->
<template>
  <footer class="app-footer">
    <div class="inner">
      <span>© {{ year }} 网页拼图小游戏 · Powered by Nuxt 4</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style scoped>
.app-footer {
  border-top: 1px solid var(--color-border);
  background: #ffffff;
  margin-top: 0;
}
.inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 16px;
  color: var(--color-text-soft);
  font-size: 12px;
  text-align: center;
}
</style>
