<!-- app/pages/index.vue - 首页：三大模式入口 -->
<template>
  <div>
    <section class="hero card">
      <h1>选择你的拼图模式</h1>
      <p class="sub">
        休闲随手拼 · 云冒险冲榜 · 自拍上传创作，一键 Vercel 部署，随时随地开玩！
      </p>
    </section>

    <section class="modes">
      <div class="mode-card card" @click="goCasual">
        <div class="ico">🌿</div>
        <h3>休闲模式</h3>
        <p>随图库编号顺序自动加载，30~80 块不规则异形切割，纯放松，不计分。</p>
        <button>开始休闲</button>
      </div>
      <div class="mode-card card highlight" @click="showCloudTip = true">
        <div class="ico">☁️</div>
        <h3>云冒险模式</h3>
        <p>体验其他玩家的自拍上传图片，冲刺排行榜，日常五局免费。</p>
        <div class="stats">
          <span>历史最高：<b>{{ game.highScore }}</b></span>
          <span>今日剩余：<b>{{ game.premium ? '∞' : game.dailyPlaysLeft }}</b> / 5</span>
        </div>
        <button>了解并开始</button>
      </div>
      <div class="mode-card card" @click="goSelfie">
        <div class="ico">📸</div>
        <h3>自拍上传</h3>
        <p>用摄像头或本地图片自定义难度，玩爽后可发布到云图库供他人拼。</p>
        <button>开始创作</button>
      </div>
    </section>

    <ModalDialog
      :visible="showCloudTip"
      title="☁️ 云冒险模式说明"
      closable
      mask-close
      @close="showCloudTip = false"
    >
      <p>
        按时间顺序游玩其他玩家自拍模式上传的公开拼图，完全沿用玩家上传时的图片、
        自定义切块难度进行闯关。
      </p>
      <ul>
        <li>单局得分 = 当前拼图总块数</li>
        <li>本地记录最高分与每局历史，接入后端后同步云端</li>
        <li>每日免费 5 局，耗尽后可看广告 +1 或付费永久解锁</li>
      </ul>
      <template #footer>
        <button class="ghost-btn" @click="showCloudTip = false">取消</button>
        <button :disabled="!game.canPlayCloud" @click="goCloud">
          {{ game.canPlayCloud ? '进入云冒险' : '今日次数已用完' }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useGameStore } from '~/stores/gameStore'
import ModalDialog from '~/components/ModalDialog.vue'

const game = useGameStore()
const showCloudTip = ref(false)
onMounted(() => game.hydrate())

function goCasual() { navigateTo('/play/casual') }
function goCloud() {
  if (!game.canPlayCloud) return
  navigateTo('/play/cloud')
}
function goSelfie() { navigateTo('/play/selfie') }
</script>

<style scoped>
.hero { text-align: center; margin-bottom: 20px; }
.hero h1 { margin: 0 0 8px; font-size: 24px; }
.sub { color: var(--color-text-soft); }
.modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.mode-card {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mode-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.mode-card.highlight { border: 2px solid var(--color-primary); }
.ico { font-size: 32px; }
.mode-card h3 { margin: 0; }
.mode-card p { color: var(--color-text-soft); font-size: 14px; margin: 0; }
.stats { display: flex; justify-content: space-between; font-size: 13px; color: var(--color-text-soft); }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.ghost-btn:hover { background: #f3f4f6; }

@media (max-width: 720px) {
  .modes { grid-template-columns: 1fr; }
}
</style>
