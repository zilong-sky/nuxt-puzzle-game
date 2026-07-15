// nuxt.config.ts
// Nuxt 4 项目主配置 - 后续如需接入后端可在 runtimeConfig 中补充
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: '网页拼图小游戏',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'Nuxt 4 拼图小游戏 - 休闲 / 云冒险 / 自拍上传 三种模式' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      // 后续对接后端修改此处
      apiBase: ''
    }
  },
  nitro: {
    preset: 'vercel'
  }
})
