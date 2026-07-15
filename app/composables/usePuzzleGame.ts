/**
 * app/composables/usePuzzleGame.ts
 *
 * Swap-only puzzle state. Every piece always occupies exactly one slot on
 * the board; there is no tray and no empty slot. Players swap two pieces
 * until every piece.slotIndex === piece.correctIndex.
 */
import { computed, onUnmounted, ref } from 'vue'
import { generateGridPieces, pickGrid, shufflePieces, type Piece } from '~/utils/puzzle'
import { calcCountdown } from '~/utils/time'

export interface PieceState extends Piece {
  /** Current slot index on the board (0..N-1). Every piece has one. */
  slotIndex: number
}

export interface UsePuzzleOptions {
  imageUrl: string
  pieceCount: number
  onSuccess?: () => void
  onFail?: () => void
}

export function usePuzzleGame(opts: UsePuzzleOptions) {
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

  function init() {
    const grid = pickGrid(opts.pieceCount, boardW, boardH)
    cols.value = grid.cols
    rows.value = grid.rows
    const cw = boardW / grid.cols
    const ch = boardH / grid.rows
    const base = generateGridPieces(grid.cols, grid.rows, boardW, boardH)
    let indices = base.map((_, i) => i)
    if (indices.length > 1) {
      let tries = 0
      do {
        indices = shufflePieces(indices)
        tries++
      } while (indices.every((v, i) => v === i) && tries < 5)
    }
    pieces.value = base.map((p, i) => ({
      ...p,
      w: cw,
      h: ch,
      slotIndex: indices[i]!
    }))
    timeLeft.value = calcCountdown(base.length)
    running.value = true
    finished.value = false
    failed.value = false
    frozen.value = false
    startTimer()
  }

  function swapPieces(aId: number, bId: number): boolean {
    if (!running.value) return false
    if (aId === bId) return false
    const a = pieces.value.find((x) => x.id === aId)
    const b = pieces.value.find((x) => x.id === bId)
    if (!a || !b) return false
    const tmp = a.slotIndex
    a.slotIndex = b.slotIndex
    b.slotIndex = tmp
    checkFinished()
    return true
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

  function useRestore() {
    if (!running.value) return
    const wrong = pieces.value
      .filter((p) => p.slotIndex !== p.correctIndex)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    for (const p of wrong) {
      if (p.slotIndex === p.correctIndex) continue
      const occupant = pieces.value.find(
        (x) => x.slotIndex === p.correctIndex && x.id !== p.id
      )
      if (!occupant) continue
      const tmp = p.slotIndex
      p.slotIndex = occupant.slotIndex
      occupant.slotIndex = tmp
    }
    checkFinished()
  }

  function useFreeze() {
    if (!running.value) return
    frozen.value = true
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
    freezeTimeoutId = setTimeout(() => {
      frozen.value = false
    }, 60_000)
  }

  function reviveByAd() {
    if (!failed.value) return
    failed.value = false
    running.value = true
    timeLeft.value = calcCountdown(pieces.value.length)
    startTimer()
  }

  const placedCount = computed(
    () => pieces.value.filter((p) => p.slotIndex === p.correctIndex).length
  )

  onUnmounted(() => {
    stopTimer()
    if (freezeTimeoutId) clearTimeout(freezeTimeoutId)
  })

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
    placedCount,
    init,
    swapPieces,
    useRestore,
    useFreeze,
    reviveByAd
  }
}
