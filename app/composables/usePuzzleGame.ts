/**
 * app/composables/usePuzzleGame.ts
 *
 * Puzzle game state (rectangular grid version). Owns pieces, timer, freeze,
 * item usage and completion checks. UI concerns live in PuzzleBoard.vue.
 */
import { computed, ref, onUnmounted } from 'vue'
import { generateGridPieces, pickGrid, shufflePieces, type Piece } from '~/utils/puzzle'
import { calcCountdown } from '~/utils/time'

export interface PieceState extends Piece {
  /** -1 means the piece sits in the tray; otherwise the target slot index. */
  slotIndex: number
  /** Ordering within the tray (used to lay pieces out horizontally). */
  trayOrder: number
}

export interface UsePuzzleOptions {
  imageUrl: string
  pieceCount: number
  onSuccess?: () => void
  onFail?: () => void
}

export function usePuzzleGame(opts: UsePuzzleOptions) {
  // Logical board size in CSS pixels (component may scale visually).
  const boardW = 720
  const boardH = 720

  const cols = ref(4)
  const rows = ref(4)
  const cellW = computed(() => boardW / cols.value)
  const cellH = computed(() => boardH / rows.value)

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

  /** Reset: build grid, shuffle pieces into the tray, start countdown. */
  function init() {
    const grid = pickGrid(opts.pieceCount, boardW, boardH)
    cols.value = grid.cols
    rows.value = grid.rows
    const cw = boardW / grid.cols
    const ch = boardH / grid.rows
    const base = generateGridPieces(grid.cols, grid.rows, boardW, boardH)
    const shuffled = shufflePieces(base)
    pieces.value = shuffled.map((p, i) => ({
      ...p,
      w: cw,
      h: ch,
      slotIndex: -1,
      trayOrder: i
    }))
    timeLeft.value = calcCountdown(base.length)
    running.value = true
    finished.value = false
    failed.value = false
    frozen.value = false
    startTimer()
  }

  /** Place a piece into a slot; if another piece occupied it, push that back to the tray. */
  function placePieceToSlot(id: number, targetSlot: number): boolean {
    if (!running.value) return false
    const p = pieces.value.find((x) => x.id === id)
    if (!p) return false
    const occupant = pieces.value.find((x) => x.slotIndex === targetSlot && x.id !== id)
    if (occupant) {
      occupant.slotIndex = -1
      occupant.trayOrder = nextTrayOrder()
    }
    p.slotIndex = targetSlot
    p.trayOrder = -1
    checkFinished()
    return true
  }

  /** Send a piece back to the tray. */
  function returnPieceToTray(id: number) {
    const p = pieces.value.find((x) => x.id === id)
    if (!p) return
    if (p.slotIndex === -1) return
    p.slotIndex = -1
    p.trayOrder = nextTrayOrder()
  }

  function nextTrayOrder(): number {
    let m = -1
    pieces.value.forEach((p) => {
      if (p.trayOrder > m) m = p.trayOrder
    })
    return m + 1
  }

  function checkFinished() {
    const ok = pieces.value.every((p) => p.slotIndex === p.correctIndex)
    if (ok) {
      running.value = false
      finished.value = true
      stopTimer()
      opts.onSuccess?.()
    }
  }

  /** Item: auto-place 3 random misplaced pieces to their correct slots. */
  function useRestore() {
    if (!running.value) return
    const wrong = pieces.value.filter((p) => p.slotIndex !== p.correctIndex)
    const chosen = wrong.sort(() => Math.random() - 0.5).slice(0, Math.min(3, wrong.length))
    chosen.forEach((p) => {
      const occupant = pieces.value.find((x) => x.slotIndex === p.correctIndex && x.id !== p.id)
      if (occupant) {
        occupant.slotIndex = -1
        occupant.trayOrder = nextTrayOrder()
      }
      p.slotIndex = p.correctIndex
      p.trayOrder = -1
    })
    checkFinished()
  }

  /** Item: freeze the countdown for 60 seconds. */
  function useFreeze() {
    if (!running.value) return
    frozen.value = true
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
    freezeTimeoutId = setTimeout(() => {
      frozen.value = false
    }, 60_000)
  }

  /** Ad revive: refill countdown and keep the current board. */
  function reviveByAd() {
    if (!failed.value) return
    failed.value = false
    running.value = true
    timeLeft.value = calcCountdown(pieces.value.length)
    startTimer()
  }

  function dispose() {
    stopTimer()
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
  }

  onUnmounted(dispose)

  const placedCount = computed(
    () => pieces.value.filter((p) => p.slotIndex === p.correctIndex).length
  )
  const progress = computed(() =>
    pieces.value.length ? placedCount.value / pieces.value.length : 0
  )

  return {
    boardW,
    boardH,
    cols,
    rows,
    cellW,
    cellH,
    pieces,
    timeLeft,
    running,
    finished,
    failed,
    frozen,
    progress,
    placedCount,
    init,
    placePieceToSlot,
    returnPieceToTray,
    useRestore,
    useFreeze,
    reviveByAd,
    dispose
  }
}
