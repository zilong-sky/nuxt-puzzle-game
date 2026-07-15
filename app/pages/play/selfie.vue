<!-- app/pages/play/selfie.vue - 自拍上传模式：本地图/摄像头拍照 + 难度自选 + 多图顺序游玩 -->
<template>
  <div>
    <div v-if="!gameStarted" class="card setup">
      <h2>📷 自拍上传模式</h2>
      <p class="sub">支持网页摄像头单张自拍 或 从本地相册选择多张图片。选定后依次开始拼图。</p>

      <div class="pickers">
        <button @click="onCameraClick">📸 网页摄像头拍照</button>
        <label class="file-btn">
          🖼 从相册选择（可多选）
          <input type="file" accept="image/*" multiple hidden @change="onFileSelect" />
        </label>
      </div>

      <div v-if="images.length" class="preview">
        <div class="preview-item" v-for="(img, i) in images" :key="i">
          <img :src="img" alt="预览" />
          <button class="remove" @click="removeImage(i)">×</button>
        </div>
      </div>

      <div class="difficulty">
        <DifficultyDial v-model="pieceCount" :min="4" :max="200" label="切块数" />
        <div class="range-hint">
          <span>4 (简单)</span>
          <span>200 (地狱)</span>
        </div>
        <button class="ghost-btn" @click="randomize">🎲 随机难度</button>
      </div>

      <div class="actions">
        <button :disabled="!images.length" @click="startGame">开始拼图（{{ images.length }} 张）</button>
      </div>
    </div>

    <div v-else-if="current">
      <PuzzleGame
        :image-url="current"
        :piece-count="pieceCount"
        mode-label="📷 自拍上传"
        :show-score="false"
        :next-label="hasNext ? '下一张' : '完成'"
        @success="onSuccess"
        @fail="onFail"
        @abort="onAbort"
        @next="onNext"
      />
    </div>

    <!-- 摄像头弹窗 -->
    <ModalDialog :visible="cameraOn" title="📸 摄像头拍照" closable @close="closeCamera">
      <div class="cam-wrap">
        <video ref="videoEl" autoplay playsinline muted></video>
        <canvas ref="canvasEl" hidden></canvas>
      </div>
      <template #footer>
        <button class="ghost-btn" @click="closeCamera">取消</button>
        <button @click="capture">拍照</button>
      </template>
    </ModalDialog>

    <!-- 单张通关后：推荐上传弹窗 -->
    <ModalDialog :visible="askUpload" title="🎉 完成拼图" closable @close="askUpload = false">
      <p>是否将这张自拍推荐到云图库？其他玩家将能在云冒险模式中玩到它。</p>
      <template #footer>
        <button class="ghost-btn" @click="skipUpload">暂不上传</button>
        <button @click="doUpload">☁️ 上传到云图库</button>
      </template>
    </ModalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import ModalDialog from '~/components/ModalDialog.vue'
import DifficultyDial from '~/components/DifficultyDial.vue'
import { uploadImage } from '~/services/imageService'
import { randInt } from '~/utils/random'

const images = ref<string[]>([])
const pieceCount = ref(randInt(30, 80))
const gameStarted = ref(false)
const idx = ref(0)

const cameraOn = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let stream: MediaStream | null = null

const askUpload = ref(false)

const current = computed(() => images.value[idx.value])
const hasNext = computed(() => idx.value < images.value.length - 1)

function onFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  Array.from(files).forEach((f) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') images.value.push(reader.result)
    }
    reader.readAsDataURL(f)
  })
}

function removeImage(i: number) {
  images.value.splice(i, 1)
}

async function onCameraClick() {
  cameraOn.value = true
  await nextTick()
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    if (videoEl.value) videoEl.value.srcObject = stream
  } catch (err) {
    alert('无法访问摄像头，请检查权限或改用本地相册。')
    closeCamera()
  }
}

function closeCamera() {
  cameraOn.value = false
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    stream = null
  }
}

function capture() {
  if (!videoEl.value || !canvasEl.value) return
  const v = videoEl.value
  const c = canvasEl.value
  c.width = v.videoWidth || 640
  c.height = v.videoHeight || 480
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.drawImage(v, 0, 0, c.width, c.height)
  const data = c.toDataURL('image/jpeg', 0.85)
  images.value.push(data)
  closeCamera()
}

function randomize() {
  pieceCount.value = randInt(4, 200)
}

function startGame() {
  if (!images.value.length) return
  idx.value = 0
  gameStarted.value = true
}

function onSuccess() { askUpload.value = true }
function onFail() { /* 交由内部弹窗处理，此处保留埋点位置 */ }
function onAbort() { gameStarted.value = false }

function onNext() {
  askUpload.value = false
  if (hasNext.value) {
    idx.value += 1
    pieceCount.value = randInt(30, 80)
  } else {
    gameStarted.value = false
    images.value = []
    idx.value = 0
  }
}

function skipUpload() {
  askUpload.value = false
  onNext()
}

async function doUpload() {
  const blob = await (await fetch(current.value)).blob()
  await uploadImage(blob)
  askUpload.value = false
  onNext()
}

onBeforeUnmount(closeCamera)
</script>

<style scoped>
.setup { display: flex; flex-direction: column; gap: 14px; }
.sub { color: var(--color-text-soft); font-size: 13px; margin: 0; }
.pickers { display: flex; gap: 10px; flex-wrap: wrap; }
.file-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border-radius: var(--radius-md);
  background: var(--color-primary); color: #fff; cursor: pointer; font-size: 14px;
}
.file-btn:hover { background: var(--color-primary-dark); }
.preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}
.preview-item { position: relative; }
.preview-item img { width: 100%; height: 80px; object-fit: cover; border-radius: 6px; }
.remove {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px; padding: 0;
  border-radius: 50%; background: var(--color-danger);
  font-size: 14px; line-height: 1;
}
.difficulty { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.range-hint { display: flex; justify-content: space-between; width: 240px; max-width: 100%; font-size: 12px; color: var(--color-text-soft); }
.actions { display: flex; gap: 10px; }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.cam-wrap video { width: 100%; border-radius: 6px; background: #000; }
</style>