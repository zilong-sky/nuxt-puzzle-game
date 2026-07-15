<!-- app/components/AppHeader.vue - 全局顶部导航（样式简洁，方便后续替换） -->
<template>
  <header class="app-header">
    <div class="inner">
      <NuxtLink to="/" class="brand">🧩 拼图小游戏</NuxtLink>
      <nav class="nav">
        <NuxtLink to="/">首页</NuxtLink>
        <NuxtLink to="/rank">排行榜</NuxtLink>
      </nav>
    </div>
  </header>
</template>

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
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
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
@media (max-width: 480px) {
  .brand { font-size: 16px; }
  .nav a { font-size: 13px; }
}
</style>
