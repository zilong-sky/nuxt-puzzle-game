<!-- app/components/AppHeader.vue - 全局顶部导航；非首页显示返回按钮，标题居中 -->
<template>
  <header class="app-header">
    <div class="inner">
      <button v-if="!isHome" class="back-btn" @click="goBack" aria-label="返回">
        ← 返回
      </button>
      <NuxtLink v-else to="/" class="brand">🧩 拼图小游戏</NuxtLink>
      <div v-if="!isHome" class="title-center">{{ pageTitle }}</div>
      <nav v-if="isHome" class="nav">
        <NuxtLink to="/">首页</NuxtLink>
        <NuxtLink to="/rank">排行榜</NuxtLink>
      </nav>
      <div v-else class="right-placeholder" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const route = useRoute()
const router = useRouter()
const isHome = computed(() => route.path === '/')
const TITLE_MAP: Record<string, string> = {
  '/play/casual': '🌿 休闲模式',
  '/play/cloud': '☁️ 云冒险',
  '/play/selfie': '📸 自拍上传',
  '/rank': '🏆 排行榜'
}
const pageTitle = computed(() => TITLE_MAP[route.path] || '')
function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) router.back()
  else navigateTo('/')
}
</script>

<style scoped>
.app-header {
  background: #ffffff;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 50;
}
.inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.brand {
  font-size: 18px;
  font-weight: bold;
  color: var(--color-primary);
  text-decoration: none;
}
.nav {
  display: flex;
  gap: 16px;
}
.nav a {
  color: var(--color-text);
  text-decoration: none;
  font-size: 14px;
}
.nav a.router-link-active {
  color: var(--color-primary);
  font-weight: bold;
}
.back-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.back-btn:hover { background: #f3f4f6; }
.title-center {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.right-placeholder { width: 68px; }
@media (max-width: 480px) {
  .brand { font-size: 16px; }
  .nav a { font-size: 13px; }
}
</style>