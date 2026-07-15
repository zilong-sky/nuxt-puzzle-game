/**
 * app/utils/puzzle.ts - Rectangular grid slicing utilities.
 *
 * The image is cut into cols x rows equal rectangular cells. Each piece is
 * rendered as a plain <div> with background-image + background-position, so
 * no SVG / clip-path / bezier tabs are involved anymore.
 */

/** Basic info about one piece (grid coordinates). */
export interface Piece {
  id: number
  row: number
  col: number
  /** Correct slot index on the board (row * cols + col). */
  correctIndex: number
  /** Piece width in board pixels. */
  w: number
  /** Piece height in board pixels. */
  h: number
  /** Background offset X (use as negative in background-position). */
  bgX: number
  /** Background offset Y (use as negative in background-position). */
  bgY: number
}

/**
 * Pick a reasonable cols x rows split for a target block count and image
 * aspect ratio. The chosen total stays within [target * 0.8, target * 1.2].
 */
export function pickGrid(blocks: number, imgW = 1, imgH = 1): { rows: number; cols: number } {
  const target = Math.max(4, Math.floor(blocks))
  const ratio = imgW / imgH
  const idealCols = Math.sqrt(target * ratio)
  const candidates: { cols: number; rows: number; score: number }[] = []
  const lo = Math.max(2, Math.floor(idealCols) - 2)
  const hi = Math.max(lo + 1, Math.ceil(idealCols) + 2)
  for (let c = lo; c <= hi; c++) {
    const r = Math.max(2, Math.round(target / c))
    const total = c * r
    if (total < target * 0.8 || total > target * 1.2) continue
    const aspectDiff = Math.abs(c / r - ratio)
    const countDiff = Math.abs(total - target) / target
    candidates.push({ cols: c, rows: r, score: aspectDiff + countDiff })
  }
  if (candidates.length === 0) {
    const cols = Math.max(2, Math.round(idealCols))
    return { cols, rows: Math.max(2, Math.round(target / cols)) }
  }
  candidates.sort((a, b) => a.score - b.score)
  return { cols: candidates[0].cols, rows: candidates[0].rows }
}

/**
 * Generate cols x rows rectangular grid pieces for a board of size imgW x imgH.
 */
export function generateGridPieces(
  cols: number,
  rows: number,
  imgW: number,
  imgH: number
): Piece[] {
  const cellW = imgW / cols
  const cellH = imgH / rows
  const pieces: Piece[] = []
  let id = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push({
        id: id++,
        row: r,
        col: c,
        correctIndex: r * cols + c,
        w: cellW,
        h: cellH,
        bgX: c * cellW,
        bgY: r * cellH
      })
    }
  }
  return pieces
}

/** Fisher-Yates shuffle. */
export function shufflePieces<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
