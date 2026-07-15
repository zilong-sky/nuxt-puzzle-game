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
 * Pick a cols x rows grid whose aspect ratio (cols/rows) approximates the
 * (post-rotation) image aspect imgW/imgH, and whose total block count is
 * near the requested target. Prefers grids whose individual cells are
 * close to square, with a small penalty for deviating from the target
 * count.
 */
export function pickGrid(
  blocks: number,
  imgW: number = 1,
  imgH: number = 1
): { rows: number; cols: number } {
  const target = Math.max(4, Math.floor(blocks))
  const ratio = imgW / imgH
  let best = { cols: 2, rows: 2, score: Infinity }
  for (let c = 2; c <= 20; c++) {
    const r = Math.max(2, Math.round(c / ratio))
    const total = c * r
    if (total < target * 0.75 || total > target * 1.3) continue
    const cellRatio = (imgW / c) / (imgH / r)
    const cellScore = Math.abs(Math.log(cellRatio))
    const countScore = Math.abs(total - target) / target
    const s = cellScore + countScore * 0.5
    if (s < best.score) best = { cols: c, rows: r, score: s }
  }
  return { rows: best.rows, cols: best.cols }
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