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
 * Pick a square grid (cols === rows) with total block count near the
 * requested target. Rotation is handled in usePuzzleGame, so the aspect
 * arguments are ignored (kept only for source-compat). Formula:
 *   n = clamp( round(sqrt(target)), 2, floor(sqrt(target * 1.2)) ).
 */
export function pickGrid(
  blocks: number,
  _imgW: number = 1,
  _imgH: number = 1
): { rows: number; cols: number } {
  const target = Math.max(4, Math.floor(blocks))
  const raw = Math.round(Math.sqrt(target))
  const upper = Math.max(2, Math.floor(Math.sqrt(target * 1.2)))
  const n = Math.max(2, Math.min(raw, upper))
  return { rows: n, cols: n }
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
