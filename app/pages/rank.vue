<!-- app/pages/rank.vue - 云冒险排行榜（当前使用 mock 数据） -->
<template>
  <div>
    <div class="card">
      <h2>☁️ 云冒险排行榜</h2>
      <p class="sub">
        当前排行榜使用模拟数据展示，后续对接后端修改此处即可接入真实排名数据。
      </p>
      <p class="mine">我的最高分：<strong>{{ game.highScore }}</strong></p>
      <ol class="rank-list" v-if="!loading">
        <li v-for="it in list" :key="it.rank">
          <span class="rk" :class="rankClass(it.rank)">#{{ it.rank }}</span>
          <span class="name">{{ it.name }}</span>
          <span class="score">{{ it.score }}</span>
        </li>
      </ol>
      <div v-else class="loading">加载中...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useGameStore } from '~/stores/gameStore'
import { fetchCloudRank, type RankItem } from '~/services/rankService'

const game = useGameStore()
const list = ref<RankItem[]>([])
const loading = ref(true)

onMounted(async () => {
  game.hydrate()
  list.value = await fetchCloudRank()
  loading.value = false
})

function rankClass(r: number) {
  if (r === 1) return 'gold'
  if (r === 2) return 'silver'
  if (r === 3) return 'bronze'
  return ''
}
</script>

<style scoped>
.sub { color: var(--color-text-soft); font-size: 13px; }
.mine { margin: 12px 0; }
.rank-list { list-style: none; padding: 0; margin: 0; }
.rank-list li {
  display: flex; align-items: center; padding: 10px 8px;
  border-bottom: 1px solid var(--color-border);
}
.rank-list li:last-child { border-bottom: none; }
.rk { width: 44px; font-weight: bold; color: var(--color-text-soft); }
.rk.gold { color: #f59e0b; }
.rk.silver { color: #94a3b8; }
.rk.bronze { color: #a16207; }
.name { flex: 1; }
.score { font-weight: bold; color: var(--color-primary); }
.loading { padding: 20px; text-align: center; color: var(--color-text-soft); }
</style>
