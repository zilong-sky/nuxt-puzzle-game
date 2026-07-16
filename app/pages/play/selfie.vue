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

      <div v-if="images.length" class="preview-actions">
        <span class="preview-note">已保存 {{ images.length }} 张，下次进入自动回显</span>
        <button class="ghost-btn small" @click="clearImages">清空</button>
      </div>

      <div class="difficulty">
        <DifficultyDial v-model="pieceCount" :min="4" :max="maxPieces" label="切块数" />
        <div class="range-hint">
          <span>4 (简单)</span>
          <span>{{ maxPieces }} (最难)</span>
        </div>
        <button class="ghost-btn" @click="randomize">🎲 随机难度</button>
        <p class="limit-hint" v-if="imgDim">
          根据当前手机屏幕和图片比例，最高难度 <strong>{{ maxPieces }}</strong> 块；再高会超出屏幕。
        </p>
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
        hide-success-modal
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

    <!-- 单张通关后：完成 + 是否上传（唯一完成弹窗） -->
    <ModalDialog :visible="askUpload" title="🎉 完成拼图" :closable="false">
      <p>你成功拼完了这张自拍！</p>
      <p>是否将这张图片推荐到云图库？通过审核后其他玩家将能在云冒险中玩到它。</p>
      <template #footer>
        <button class="ghost-btn" @click="onAbort">返回</button>
        <button class="ghost-btn" @click="skipUpload">{{ hasNext ? '暂不上传，下一张' : '暂不上传' }}</button>
        <button @click="doUpload">☁️ 上传</button>
      </template>
    </ModalDialog>

    <!-- 假上传进度弹窗 -->
    <ModalDialog :visible="uploading" title="☁️ 上传中" :closable="false">
      <div class="upload-progress">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <div class="progress-num">{{ uploadProgress }}%</div>
      </div>
    </ModalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PuzzleGame from '~/components/PuzzleGame.vue'
import ModalDialog from '~/components/ModalDialog.vue'
import DifficultyDial from '~/components/DifficultyDial.vue'
import { randInt } from '~/utils/random'
import { computeMaxPieces } from '~/utils/difficultyLimit'
import { compressImage } from '~/utils/imageCompress'
import { getFingerprint } from '~/composables/useFingerprint'
import { uploadImage } from '~/services/imageService'
import { useGameStore } from '~/stores/gameStore'

const game = useGameStore()

const images = ref<string[]>([])
const CACHE_KEY = 'puzzle-selfie-images-v1'
const MAX_BYTES = 4 * 1024 * 1024
const PER_ITEM_MAX_BYTES = 1.5 * 1024 * 1024
const pieceCount = ref(randInt(30, 80))
const gameStarted = ref(false)
const idx = ref(0)

const cameraOn = ref(false)
const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let stream: MediaStream | null = null

const askUpload = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)

const imgDim = ref<{ w: number; h: number } | null>(null)
const viewportTick = ref(0)

function measureImage(url: string) {
  const im = new Image()
  im.onload = () => { imgDim.value = { w: im.naturalWidth, h: im.naturalHeight } }
  im.src = url
}

const current = computed(() => images.value[idx.value])
const hasNext = computed(() => idx.value < images.value.length - 1)

const maxPieces = computed(() => {
  // 依赖 viewport 变化
  void viewportTick.value
  if (!imgDim.value) return 200
  return computeMaxPieces({ imgW: imgDim.value.w, imgH: imgDim.value.h })
})

watch(maxPieces, (m) => {
  if (pieceCount.value > m) pieceCount.value = m
})

function onFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  Array.from(files).forEach((f) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        images.value.push(reader.result)
        measureImage(reader.result)
      }
    }
    reader.readAsDataURL(f)
  })
}

function removeImage(i: number) {
  images.value.splice(i, 1)
  const last = images.value[images.value.length - 1]
  if (last) measureImage(last)
  else imgDim.value = null
}

function clearImages() {
  images.value = []
  imgDim.value = null
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

function persistImages() {
  try {
    let total = 0
    const kept: string[] = []
    for (const url of images.value) {
      const size = url.length
      if (size > PER_ITEM_MAX_BYTES) continue
      if (total + size > MAX_BYTES) break
      kept.push(url)
      total += size
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(kept))
  } catch {
    try { localStorage.removeItem(CACHE_KEY) } catch {}
  }
}

watch(images, () => persistImages(), { deep: false })

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
  measureImage(data)
  closeCamera()
}

function randomize() {
  pieceCount.value = randInt(4, maxPieces.value)
}

function startGame() {
  if (!images.value.length) return
  if (pieceCount.value > maxPieces.value) {
    alert(`当前屏幕和图片比例下，最高难度 ${maxPieces.value} 块。已自动下调。`)
    pieceCount.value = maxPieces.value
    return
  }
  idx.value = 0
  gameStarted.value = true
}

function onSuccess() { askUpload.value = true }
function onFail() { /* 交由内部弹窗处理，此处保留埋点位置 */ }
function onAbort() {
  askUpload.value = false
  gameStarted.value = false
}

function onNext() {
  askUpload.value = false
  if (hasNext.value) {
    idx.value += 1
    pieceCount.value = Math.min(randInt(30, 80), maxPieces.value)
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

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return await res.blob()
}

async function doUpload() {
  askUpload.value = false
  uploading.value = true
  uploadProgress.value = 0
  try {
    const dataUrl = images.value[idx.value]
    if (!dataUrl) throw new Error('图片数据丢失')
    const rawBlob = await dataUrlToBlob(dataUrl)
    const { blob: compressed, width, height } = await compressImage(rawBlob)
    const fingerprint = await getFingerprint()
    const uploader = game.playerName || 'anonymous'
    const result = await uploadImage(
      compressed,
      { uploader, fingerprint, width, height },
      (pct) => { uploadProgress.value = pct }
    )
    uploading.value = false
    if (result.success) {
      alert(result.message || '✅ 已提交，审核通过后会出现在云冒险')
    } else {
      alert('❌ ' + (result.error || '上传失败'))
    }
  } catch (e) {
    uploading.value = false
    alert('? ?????' + (e as Error).message)
  }
  onNext()
}

let viewportHandler: (() => void) | null = null
onMounted(() => {
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
  viewportHandler = () => { viewportTick.value++ }
  window.addEventListener('resize', viewportHandler)
  window.addEventListener('orientationchange', viewportHandler)
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string' && x.startsWith('data:'))) {
        images.value = arr
        if (arr.length > 0) measureImage(arr[arr.length - 1])
      }
    }
  } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  closeCamera()
  if (viewportHandler) {
    window.removeEventListener('resize', viewportHandler)
    window.removeEventListener('orientationchange', viewportHandler)
    viewportHandler = null
  }
})
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
.preview-actions {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 4px;
}
.preview-note { font-size: 12px; color: var(--color-text-soft); }
.ghost-btn.small { padding: 4px 10px; font-size: 12px; flex: 0 0 auto; }
.remove {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px; padding: 0;
  border-radius: 50%; background: var(--color-danger);
  font-size: 14px; line-height: 1;
}
.difficulty { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.range-hint { display: flex; justify-content: space-between; width: 240px; max-width: 100%; font-size: 12px; color: var(--color-text-soft); }
.limit-hint { font-size: 12px; color: var(--color-text-soft); text-align: center; margin: 4px 0 0; }
.actions { display: flex; gap: 10px; }
.ghost-btn { background: transparent; color: var(--color-text); border: 1px solid var(--color-border); }
.cam-wrap video { width: 100%; border-radius: 6px; background: #000; }
.upload-progress { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; }
.upload-progress .progress-track { width: 220px; height: 8px; border-radius: 999px; background: #e5e7eb; overflow: hidden; }
.upload-progress .progress-fill { height: 100%; background: #d4af37; transition: width 0.12s linear; }
.upload-progress .progress-num { font-size: 13px; color: var(--color-text-soft); }
</style>
