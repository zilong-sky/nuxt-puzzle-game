/**
 * app/composables/usePuzzleGame.ts
 * 拼图游戏核心状态机 hook。
 * 负责：初始化布局、跟踪块位置、判定拼合、倒计时、道具触发。
 */

import { computed, ref, onUnmounted } from 'vue'
import {
  generatePuzzleLayout,
  pickGrid,
  shufflePieces,
  type PuzzlePiece,
  type PuzzleLayout
} from '~/utils/puzzle'
import { calcCountdown } from '~/utils/time'
import { randInt } from '~/utils/random'

export interface PieceState extends PuzzlePiece {
  /** 当前位置（画布坐标，SVG viewBox 内） */
  x: number
  y: number
  placed: boolean
}

export interface UsePuzzleOptions {
  imageUrl: string
  pieceCount: number
  onSuccess?: () => void
  onFail?: () => void
}

export function usePuzzleGame(opts: UsePuzzleOptions) {
  const viewW = 800
  const viewH = 800
  const trayW = 300 // 右侧料架宽度
  const totalW = viewW + trayW

  const layout = ref<PuzzleLayout | null>(null)
  const pieces = ref<PieceState[]>([])
  const timeLeft = ref(0)
  const running = ref(false)
  const finished = ref(false)
  const failed = ref(false)
  const frozen = ref(false)

  let timerId: ReturnType<typeof setInterval> | null = null
  let freezeTimeoutId: ReturnType<typeof setTimeout> | null = null

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function startTimer() {
    stopTimer()
    timerId = setInterval(() => {
      if (frozen.value || !running.value) return
      timeLeft.value -= 1
      if (timeLeft.value <= 0) {
        timeLeft.value = 0
        stopTimer()
        running.value = false
        failed.value = true
        opts.onFail?.()
      }
    }, 1000)
  }

  /** 初始化：生成布局，打乱块位置放到右侧料架 */
  function init() {
    const { rows, cols } = pickGrid(opts.pieceCount)
    const l = generatePuzzleLayout(viewW, viewH, rows, cols)
    layout.value = l
    const shuffled = shufflePieces(l.pieces)
    pieces.value = shuffled.map((p, idx) => {
      // 将块随机散布在右侧料架内
      const perRow = 3
      const col = idx % perRow
      const row = Math.floor(idx / perRow)
      const gridW = trayW / perRow
      const gridH = gridW
      const x = viewW + col * gridW + randInt(-8, 8)
      const y = row * gridH + randInt(-8, 8)
      return {
        ...p,
        x,
        y,
        placed: false
      }
    })
    timeLeft.value = calcCountdown(opts.pieceCount)
    running.value = true
    finished.value = false
    failed.value = false
    frozen.value = false
    startTimer()
  }

  /** 拖拽某块到 (x, y) - 传入的是 svg 坐标 */
  function movePiece(id: number, x: number, y: number) {
    if (!running.value) return
    const p = pieces.value.find((it) => it.id === id)
    if (!p || p.placed) return
    p.x = x
    p.y = y
  }

  /** 松手时检测是否吸附到正确位置 */
  function tryDrop(id: number) {
    const p = pieces.value.find((it) => it.id === id)
    if (!p || p.placed) return false
    const dx = p.x - p.targetX
    const dy = p.y - p.targetY
    const dist = Math.hypot(dx, dy)
    const threshold = 30 // svg 坐标下的吸附阈值
    if (dist < threshold) {
      p.x = p.targetX
      p.y = p.targetY
      p.placed = true
      checkFinished()
      return true
    }
    return false
  }

  function checkFinished() {
    if (pieces.value.every((p) => p.placed)) {
      running.value = false
      finished.value = true
      stopTimer()
      opts.onSuccess?.()
    }
  }

  /** 道具：智能还原 - 自动摆正 3 块错位拼图碎片 */
  function useRestore() {
    if (!running.value) return
    const unplaced = pieces.value.filter((p) => !p.placed)
    const count = Math.min(3, unplaced.length)
    // 打乱后取前 count 个
    const chosen = unplaced.sort(() => Math.random() - 0.5).slice(0, count)
    chosen.forEach((p) => {
      p.x = p.targetX
      p.y = p.targetY
      p.placed = true
    })
    checkFinished()
  }

  /** 道具：时间冻结 60 秒 */
  function useFreeze() {
    if (!running.value) return
    frozen.value = true
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
    freezeTimeoutId = setTimeout(() => {
      frozen.value = false
    }, 60_000)
  }

  /** 广告复活：时间全额重置，继续当前拼图 */
  function reviveByAd() {
    if (!failed.value) return
    failed.value = false
    running.value = true
    timeLeft.value = calcCountdown(opts.pieceCount)
    startTimer()
  }

  /** 手动结束当前局（页面离开时调用） */
  function dispose() {
    stopTimer()
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
  }

  onUnmounted(dispose)

  const progress = computed(() => {
    if (!pieces.value.length) return 0
    return pieces.value.filter((p) => p.placed).length / pieces.value.length
  })
  const placedCount = computed(() => pieces.value.filter((p) => p.placed).length)

  return {
    viewW,
    viewH,
    trayW,
    totalW,
    layout,
    pieces,
    timeLeft,
    running,
    finished,
    failed,
    frozen,
    progress,
    placedCount,
    init,
    movePiece,
    tryDrop,
    useRestore,
    useFreeze,
    reviveByAd,
    dispose
  }
}
