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
        :key="current"
        :image-url="current"
        :piece-count="pieceCount"
        mode-label="📷 自拍上传"
        :show-score="false"
        :next-label="hasNext ? '下一张' : '完成'"
        hide-success-modal
        hide-finish-actions
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

    <!-- 单张通关后：完成 + 是否上传（底部悬浮条，不遮欣赏图） -->
    <Transition name="upbar">
      <div v-if="askUpload" class="upload-bar">
        <div class="upload-bar-title">🎉 拼完了！想把这张推荐到云图库吗？</div>
        <div class="upload-bar-btns">
          <button class="primary-btn" @click="doUpload">☁️ 上传</button>
          <button class="ghost-btn" @click="skipUpload">{{ hasNext ? '跳过·下一张' : '跳过' }}</button>
          <button class="ghost-btn" @click="onAbort">返回</button>
        </div>
      </div>
    </Transition>

    <!-- 上传中弹窗 -->
    <ModalDialog :visible="uploadState === 'uploading' || uploadState === 'compressing'" :title="uploadState === 'compressing' ? '🗜 处理图片中' : '☁️ 上传中'" :closable="false">
      <div class="upload-progress">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <div class="progress-num">{{ uploadProgress }}%</div>
        <p class="hint" v-if="uploadState === 'compressing'">正在压缩图片...</p>
      </div>
    </ModalDialog>

    <!-- 上传失败弹窗 -->
    <ModalDialog :visible="uploadState === 'failed'" title="❌ 上传失败" :closable="false">
      <p><strong>失败原因：</strong></p>
      <p class="err-msg">{{ uploadError }}</p>
      <template #footer>
        <div class="stack-btns">
          <button class="primary-btn" @click="doUpload">🔄 重试</button>
          <button class="ghost-btn" @click="giveUpUpload">不传了</button>
        </div>
      </template>
    </ModalDialog>

    <!-- 上传成功弹窗（大绿勾，禁用遮罩关闭） -->
    <ModalDialog :visible="uploadState === 'success'" :closable="false">
      <div class="success-hero">
        <div class="check-badge">✓</div>
        <h3 class="success-title">上传成功！</h3>
        <p class="success-desc">{{ uploadSuccessMsg }}</p>
        <p class="success-id" v-if="uploadedId">编号 #{{ uploadedId }}</p>
      </div>
      <template #footer>
        <div class="stack-btns">
          <button class="primary-btn" @click="afterUploadDone">{{ hasNext ? '下一张' : '完成' }}</button>
        </div>
      </template>
    </ModalDialog>

    <!-- 持续提示 toast（成功后停留在页面右上） -->
    <Transition name="toast">
      <div v-if="successToast" class="success-toast">
        ✅ 已提交云图库审核
      </div>
    </Transition>
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
type UploadState = 'idle' | 'compressing' | 'uploading' | 'failed' | 'success'
const uploadState = ref<UploadState>('idle')
const uploadProgress = ref(0)
const uploadError = ref('')
const uploadSuccessMsg = ref('')
const uploadedId = ref<number | null>(null)
const successToast = ref(false)

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
  // 防止重复点击
  if (uploadState.value === 'compressing' || uploadState.value === 'uploading') return
  askUpload.value = false
  uploadError.value = ''
  uploadState.value = 'compressing'
  uploadProgress.value = 0

  try {
    const dataUrl = images.value[idx.value]
    if (!dataUrl) throw new Error('图片数据丢失')

    // 让 UI 先渲染出"处理中"状态
    await nextTick()

    const rawBlob = await dataUrlToBlob(dataUrl)
    const { blob: compressed, width, height } = await compressImage(rawBlob)
    const fingerprint = await getFingerprint()
    const uploader = game.playerName || 'anonymous'

    uploadState.value = 'uploading'
    uploadProgress.value = 0

    const result = await uploadImage(
      compressed,
      { uploader, fingerprint, width, height },
      (pct) => { uploadProgress.value = pct }
    )

    console.log('[selfie upload] result:', result)
    if (result.success) {
      uploadSuccessMsg.value = result.message || '已提交，审核通过后会出现在云冒险'
      uploadedId.value = result.id ?? null
      uploadState.value = 'success'
      // 显示 toast，5 秒后自动隐藏
      successToast.value = true
      setTimeout(() => { successToast.value = false }, 5000)
      // 保底：原生 alert 兜底（防止 Vue 弹窗被 CSS/缓存问题吞掉）
      // 用 setTimeout 让 Vue 先渲染 success 弹窗
      setTimeout(() => {
        if (uploadState.value === 'success') {
          alert('✅ 上传成功！\n' + (result.message || '已提交云图库审核') + (result.id ? '\n编号 #' + result.id : ''))
        }
      }, 100)
    } else {
      uploadError.value = result.error || '未知错误（服务端未返回错误信息）'
      console.error('[selfie upload] failed:', result)
      uploadState.value = 'failed'
    }
  } catch (e) {
    const err = e as Error
    uploadError.value = err?.message || String(e) || '未知异常'
    console.error('[selfie upload] exception:', err)
    uploadState.value = 'failed'
  }
}

function giveUpUpload() {
  uploadState.value = 'idle'
  uploadError.value = ''
  onNext()
}

function afterUploadDone() {
  uploadState.value = 'idle'
  uploadSuccessMsg.value = ''
  uploadedId.value = null
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
.upload-progress .hint { font-size: 12px; color: var(--color-text-soft); margin: 4px 0 0; }
.stack-btns { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.stack-btns button { width: 100%; padding: 10px 14px; border-radius: var(--radius-md); font-size: 15px; cursor: pointer; }
.primary-btn { background: var(--color-primary, #4a7cff); color: #fff; border: none; }
.primary-btn:hover { opacity: 0.9; }
.err-msg { color: #e34a4a; background: #fef2f2; padding: 8px 10px; border-radius: 6px; font-size: 13px; word-break: break-word; margin: 6px 0; }

/* 成功弹窗 */
.success-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 0 4px; }
.check-badge {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #4ade80, #22c55e);
  color: #fff; font-size: 44px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(34,197,94,0.35);
  margin-bottom: 12px;
  animation: pop-badge 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop-badge {
  0% { transform: scale(0.3); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.success-title { font-size: 20px; font-weight: 600; color: #16a34a; margin: 0 0 6px; }
.success-desc { font-size: 14px; color: var(--color-text); margin: 0; }
.success-id { font-size: 12px; color: var(--color-text-soft); margin: 8px 0 0; font-family: monospace; }

/* 右上角持续 toast */
.success-toast {
  position: fixed; top: 20px; right: 20px; z-index: 200;
  background: #22c55e; color: #fff;
  padding: 10px 16px; border-radius: 8px;
  box-shadow: 0 6px 18px rgba(34,197,94,0.4);
  font-size: 14px; font-weight: 500;
  max-width: calc(100vw - 40px);
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }
.upload-progress .progress-num { font-size: 13px; color: var(--color-text-soft); }

/* 底部悬浮上传条 */
.upload-bar {
  position: fixed;
  left: 12px; right: 12px; bottom: 12px;
  z-index: 90;
  background: rgba(255,255,255,0.98);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.18);
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px;
  max-width: 520px; margin: 0 auto;
}
.upload-bar-title { font-size: 14px; font-weight: 600; color: var(--color-text); text-align: center; }
.upload-bar-btns { display: flex; gap: 8px; }
.upload-bar-btns button { flex: 1; padding: 10px; border-radius: 8px; font-size: 14px; cursor: pointer; border: none; }
.upload-bar-btns .primary-btn { background: var(--color-primary, #4a7cff); color: #fff; flex: 1.5; }
.upload-bar-btns .ghost-btn { background: #f3f4f6; color: var(--color-text); border: 1px solid var(--color-border); }
.upbar-enter-active, .upbar-leave-active { transition: all 0.25s ease; }
.upbar-enter-from, .upbar-leave-to { opacity: 0; transform: translateY(20px); }
</style>
