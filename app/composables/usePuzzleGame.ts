/**
 * app/composables/usePuzzleGame.ts
 *
 * Group-aware swap puzzle state. Every piece always occupies exactly one
 * slot. Pieces are unioned into groups (classic jigsaw semantics): two
 * pieces A, B belong to the same group iff their current slots are
 * neighbors (row or column adjacent by 1) AND their correctIndex values
 * are neighbors in the same direction.
 *
 * A move (drag or click-click) shifts a whole group by (dCol, dRow). It
 * succeeds only if every new slot stays inside the board. The move is a
 * batch swap: pieces displaced by the group land in the slots the group
 * vacated (paired one-to-one by ascending slotIndex).
 */
import { computed, onUnmounted, ref } from 'vue'
import { generateGridPieces, pickGrid, shufflePieces, type Piece } from '~/utils/puzzle'
import { calcCountdown } from '~/utils/time'

let lastObjectUrl: string | null = null

export interface PieceState extends Piece {
  /** Current slot index on the board (0..N-1). */
  slotIndex: number
  /** Group identifier (a stable piece id serving as representative). */
  groupId: number
  /** Whether every member of this piece''s group is at its correct slot. */
  groupAligned: boolean
}

export interface UsePuzzleOptions {
  imageUrl: string
  pieceCount: number
  onSuccess?: () => void
  onFail?: () => void
}

export function usePuzzleGame(opts: UsePuzzleOptions) {
  /** Board pixel dimensions matching the (post-rotation) image aspect. */
  const boardW = ref(720)
  const boardH = ref(720)
  /** Aspect ratio (W/H) of the post-rotation render image. */
  const aspect = ref(1)
  /**
   * Render source URL. When the viewport is portrait but the image is
   * landscape, we bake a 90deg-CW-rotated copy into a data URL so all
   * background-mapping math stays as if the image were natively portrait.
   */
  const renderImageUrl = ref(opts.imageUrl)

  const cols = ref(4)
  const rows = ref(4)
  const cellW = computed(() => boardW.value / cols.value)
  const cellH = computed(() => boardH.value / rows.value)

  const pieces = ref<PieceState[]>([])
  const timeLeft = ref(0)
  const running = ref(false)
  const finished = ref(false)
  const failed = ref(false)
  const frozen = ref(false)
  const loading = ref(true)
  const loadProgress = ref(0)
  const roundItems = ref({ restore: 1, freeze: 1, replay: 1 })

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

  /* -------------- group computation (Union-Find) -------------- */
  function recomputeGroups() {
    const list = pieces.value
    const N = list.length
    const C = cols.value
    const R = rows.value
    if (N === 0) return
    const parent = new Array(N)
    for (let i = 0; i < N; i++) parent[i] = i
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]]
        x = parent[x]
      }
      return x
    }
    const union = (a: number, b: number) => {
      const ra = find(a); const rb = find(b)
      if (ra !== rb) parent[ra] = rb
    }
    const slotToIdx = new Map<number, number>()
    for (let i = 0; i < N; i++) slotToIdx.set(list[i]!.slotIndex, i)
    for (let i = 0; i < N; i++) {
      const p = list[i]!
      const sc = p.slotIndex % C
      const sr = Math.floor(p.slotIndex / C)
      const pc = p.correctIndex % C
      const pr = Math.floor(p.correctIndex / C)
      if (sc < C - 1) {
        const j = slotToIdx.get(p.slotIndex + 1)
        if (j != null) {
          const q = list[j]!
          const qc = q.correctIndex % C
          const qr = Math.floor(q.correctIndex / C)
          if (qr === pr && qc === pc + 1) union(i, j)
        }
      }
      if (sr < R - 1) {
        const j = slotToIdx.get(p.slotIndex + C)
        if (j != null) {
          const q = list[j]!
          const qc = q.correctIndex % C
          const qr = Math.floor(q.correctIndex / C)
          if (qc === pc && qr === pr + 1) union(i, j)
        }
      }
    }
    const rootPieceId: number[] = new Array(N)
    for (let i = 0; i < N; i++) rootPieceId[i] = list[find(i)]!.id
    const alignedMap = new Map<number, boolean>()
    for (let i = 0; i < N; i++) {
      const gid = rootPieceId[i]!
      const p = list[i]!
      const ok = p.slotIndex === p.correctIndex
      const prev = alignedMap.get(gid)
      alignedMap.set(gid, prev === undefined ? ok : prev && ok)
    }
    for (let i = 0; i < N; i++) {
      const p = list[i]!
      const newGid = rootPieceId[i]!
      const newAlign = alignedMap.get(newGid) === true
      if (p.groupId !== newGid) p.groupId = newGid
      if (p.groupAligned !== newAlign) p.groupAligned = newAlign
    }
  }

  async function init() {
    finished.value = false
    failed.value = false
    running.value = false
    roundItems.value = { restore: 1, freeze: 1, replay: 1 }
    loading.value = true
    loadProgress.value = 0

    if (lastObjectUrl) {
      try { URL.revokeObjectURL(lastObjectUrl) } catch { /* noop */ }
      lastObjectUrl = null
    }

    // 1) Load image to know its natural aspect.
    let rawW = 1
    let rawH = 1
    let imgObjectUrl: string | null = null
    let imgSrcForRotate: string = opts.imageUrl

    // Stage A: fetch (0 -> 60)
    if (opts.imageUrl && typeof fetch !== 'undefined') {
      try {
        const isDataUrl = opts.imageUrl.startsWith('data:')
        const isBlobUrl = opts.imageUrl.startsWith('blob:')
        if (isDataUrl || isBlobUrl) {
          loadProgress.value = 60
        } else {
          const resp = await fetch(opts.imageUrl, { mode: 'cors' })
          const total = Number(resp.headers.get('content-length') || 0)
          const reader = resp.body?.getReader()
          if (reader && total > 0) {
            const chunks: Uint8Array[] = []
            let received = 0
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value) {
                chunks.push(value)
                received += value.length
                loadProgress.value = Math.min(60, Math.round((received / total) * 60))
              }
            }
            const blob = new Blob(chunks as BlobPart[])
            imgObjectUrl = URL.createObjectURL(blob)
            lastObjectUrl = imgObjectUrl
            imgSrcForRotate = imgObjectUrl
          } else {
            loadProgress.value = 30
            const blob = await resp.blob()
            imgObjectUrl = URL.createObjectURL(blob)
            lastObjectUrl = imgObjectUrl
            imgSrcForRotate = imgObjectUrl
            loadProgress.value = 60
          }
        }
      } catch {
        imgSrcForRotate = opts.imageUrl
        loadProgress.value = 30
      }
    }

    // Stage B: Image decode (60 -> 80)
    if (typeof Image !== 'undefined' && opts.imageUrl) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = imgSrcForRotate
        const anyImg = img as unknown as { decode?: () => Promise<void> }
        if (typeof anyImg.decode === 'function') {
          await anyImg.decode.call(img).catch(() => {})
        } else {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
        }
        loadProgress.value = 80
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          rawW = img.naturalWidth
          rawH = img.naturalHeight
        }
        // Stage C: rotate (80 -> 90)
        const portraitViewport =
          typeof window !== 'undefined'
            ? window.innerHeight >= window.innerWidth
            : true
        const landscapeImage = rawW > rawH
        if (portraitViewport && landscapeImage && typeof document !== 'undefined') {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = rawH
            canvas.height = rawW
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.translate(rawH, 0)
              ctx.rotate(Math.PI / 2)
              ctx.drawImage(img, 0, 0)
              renderImageUrl.value = canvas.toDataURL('image/jpeg', 0.92)
              const tmp = rawW
              rawW = rawH
              rawH = tmp
            } else {
              renderImageUrl.value = imgObjectUrl || opts.imageUrl
            }
          } catch {
            renderImageUrl.value = imgObjectUrl || opts.imageUrl
          }
        } else {
          renderImageUrl.value = imgObjectUrl || opts.imageUrl
        }
        loadProgress.value = 90
      } catch {
        renderImageUrl.value = imgObjectUrl || opts.imageUrl
      }
    }

    // Stage D: pickGrid + generateGridPieces (90 -> 100)
    boardW.value = rawW
    boardH.value = rawH
    aspect.value = rawW / rawH

    const grid = pickGrid(opts.pieceCount, rawW, rawH)
    cols.value = grid.cols
    rows.value = grid.rows
    const cw = rawW / grid.cols
    const ch = rawH / grid.rows
    const base = generateGridPieces(grid.cols, grid.rows, rawW, rawH)
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
      slotIndex: indices[i]!,
      groupId: p.id,
      groupAligned: false
    }))
    recomputeGroups()
    timeLeft.value = calcCountdown(base.length)
    running.value = true
    finished.value = false
    failed.value = false
    frozen.value = false
    startTimer()
    loadProgress.value = 100
    loading.value = false
  }

  function moveGroup(pieceId: number, dCol: number, dRow: number): boolean {
    if (!running.value) return false
    if (dCol === 0 && dRow === 0) return false
    const anchor = pieces.value.find((p) => p.id === pieceId)
    if (!anchor) return false
    const gid = anchor.groupId
    const C = cols.value
    const R = rows.value
    const groupPieces = pieces.value.filter((p) => p.groupId === gid)
    const S = new Set<number>()
    const shifts: { piece: PieceState; newSlot: number }[] = []
    for (const p of groupPieces) {
      const c = (p.slotIndex % C) + dCol
      const r = Math.floor(p.slotIndex / C) + dRow
      if (c < 0 || c >= C || r < 0 || r >= R) return false
      shifts.push({ piece: p, newSlot: r * C + c })
      S.add(p.slotIndex)
    }
    const D = new Set<number>(shifts.map((s) => s.newSlot))
    const displaced = pieces.value
      .filter((p) => D.has(p.slotIndex) && !S.has(p.slotIndex))
      .sort((a, b) => a.slotIndex - b.slotIndex)
    const freeSlots: number[] = []
    S.forEach((s) => {
      if (!D.has(s)) freeSlots.push(s)
    })
    freeSlots.sort((a, b) => a - b)
    if (displaced.length !== freeSlots.length) return false
    for (const s of shifts) s.piece.slotIndex = s.newSlot
    for (let k = 0; k < displaced.length; k++) {
      displaced[k]!.slotIndex = freeSlots[k]!
    }
    recomputeGroups()
    checkFinished()
    return true
  }

  function moveGroupToSlot(pieceId: number, targetSlot: number): boolean {
    const anchor = pieces.value.find((p) => p.id === pieceId)
    if (!anchor) return false
    const C = cols.value
    const dCol = (targetSlot % C) - (anchor.slotIndex % C)
    const dRow = Math.floor(targetSlot / C) - Math.floor(anchor.slotIndex / C)
    return moveGroup(pieceId, dCol, dRow)
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
    if (roundItems.value.restore <= 0) return
    roundItems.value.restore -= 1
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
    recomputeGroups()
    checkFinished()
  }

  function useFreeze() {
    if (!running.value) return
    if (roundItems.value.freeze <= 0) return
    roundItems.value.freeze -= 1
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

  function restart() {
    if (roundItems.value.replay <= 0) return
    roundItems.value.replay -= 1
    const list = pieces.value
    if (list.length <= 1) return
    let indices = list.map((p) => p.slotIndex)
    let tries = 0
    do {
      indices = shufflePieces(indices)
      tries++
    } while (indices.every((v, i) => v === list[i]!.slotIndex) && tries < 5)
    for (let i = 0; i < list.length; i++) list[i]!.slotIndex = indices[i]!
    recomputeGroups()
    finished.value = false
    failed.value = false
    running.value = true
    frozen.value = false
    timeLeft.value = calcCountdown(list.length)
    startTimer()
  }
  const useReplay = () => restart()

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
    aspect,
    renderImageUrl,
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
    loading,
    loadProgress,
    roundItems,
    init,
    moveGroup,
    moveGroupToSlot,
    useRestore,
    useFreeze,
    reviveByAd,
    useReplay,
    restart
  }
}