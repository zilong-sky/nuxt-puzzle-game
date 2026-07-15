<!-- app/layouts/default.vue - 默认布局，包含头/尾。手机优先，单屏无滚动。 -->
<template>
  <div class="layout">
    <AppHeader />
    <main class="container main-content">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

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
  display: flex;
  flex-direction: column;
}
</style>
