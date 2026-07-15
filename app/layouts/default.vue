<!-- app/layouts/default.vue - 默认布局，包含头/尾 -->
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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  width: 100%;
}
</style>
