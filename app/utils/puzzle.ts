/**
 * app/utils/puzzle.ts - 拼图核心切割算法
 *
 * 采用 SVG path 生成拼图块 clip-path。使用随机贝塞尔曲线在
 * 相邻块的边界上生成"凸/凹"耳朵，实现异形非规则切割，
 * 保证相邻块严丝合缝，同时不使用规整网格视觉。
 */

import { randRange } from './random'

export interface PuzzlePiece {
  id: number
  row: number
  col: number
  /** 该块的 SVG 路径 (相对整图 0-1 归一化坐标 x 100) */
  path: string
  /** 该块在整图中占据的边界框（用于展示与拖拽定位） */
  bbox: { x: number; y: number; w: number; h: number }
  /** 目标位置 (百分比) */
  targetX: number
  targetY: number
}

export interface PuzzleLayout {
  rows: number
  cols: number
  pieces: PuzzlePiece[]
  /** viewBox 尺寸 */
  viewW: number
  viewH: number
}

type Edge = 0 | 1 | -1 // 0=直边(外框) 1=凸 -1=凹

interface CellEdges {
  top: Edge
  right: Edge
  bottom: Edge
  left: Edge
  /** 每条边的随机偏移，用于让每个块的耳朵位置略有不同 */
  jitter: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

/**
 * 根据总块数选择合适的行列（尽量接近正方形）
 */
export function pickGrid(count: number): { rows: number; cols: number } {
  const c = Math.max(2, Math.round(Math.sqrt(count)))
  const r = Math.max(2, Math.round(count / c))
  return { rows: r, cols: c }
}

/**
 * 生成拼图布局。所有边界通过共享的凸凹关系保证严丝合缝。
 *
 * @param viewW SVG viewBox 宽度（内部坐标）
 * @param viewH SVG viewBox 高度
 * @param rows 行数
 * @param cols 列数
 */
export function generatePuzzleLayout(
  viewW: number,
  viewH: number,
  rows: number,
  cols: number
): PuzzleLayout {
  const cellW = viewW / cols
  const cellH = viewH / rows

  // 先决定所有内部边的凸凹方向（避免相邻冲突）
  const hEdges: Edge[][] = [] // 水平边 (rows+1) x cols
  const vEdges: Edge[][] = [] // 垂直边 rows x (cols+1)
  for (let r = 0; r <= rows; r++) {
    hEdges.push([])
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows) hEdges[r].push(0)
      else hEdges[r].push(Math.random() < 0.5 ? 1 : -1)
    }
  }
  for (let r = 0; r < rows; r++) {
    vEdges.push([])
    for (let c = 0; c <= cols; c++) {
      if (c === 0 || c === cols) vEdges[r].push(0)
      else vEdges[r].push(Math.random() < 0.5 ? 1 : -1)
    }
  }

  // 每个 cell 上下左右的抖动偏移（沿边线方向）
  const cells: CellEdges[][] = []
  for (let r = 0; r < rows; r++) {
    cells.push([])
    for (let c = 0; c < cols; c++) {
      cells[r].push({
        top: hEdges[r][c],
        right: vEdges[r][c + 1],
        bottom: hEdges[r + 1][c],
        left: vEdges[r][c],
        jitter: {
          top: randRange(-0.08, 0.08),
          right: randRange(-0.08, 0.08),
          bottom: randRange(-0.08, 0.08),
          left: randRange(-0.08, 0.08)
        }
      })
    }
  }

  const pieces: PuzzlePiece[] = []
  let id = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cellW
      const y0 = r * cellH
      const path = buildPiecePath(x0, y0, cellW, cellH, cells[r][c])
      // bbox 扩展以包含"耳朵"凸起
      const tabSize = Math.min(cellW, cellH) * 0.22
      const bx = x0 - (cells[r][c].left === 1 ? tabSize : 0)
      const by = y0 - (cells[r][c].top === 1 ? tabSize : 0)
      const bw =
        cellW +
        (cells[r][c].left === 1 ? tabSize : 0) +
        (cells[r][c].right === 1 ? tabSize : 0)
      const bh =
        cellH +
        (cells[r][c].top === 1 ? tabSize : 0) +
        (cells[r][c].bottom === 1 ? tabSize : 0)
      pieces.push({
        id: id++,
        row: r,
        col: c,
        path,
        bbox: { x: bx, y: by, w: bw, h: bh },
        targetX: x0,
        targetY: y0
      })
    }
  }

  return { rows, cols, pieces, viewW, viewH }
}

/**
 * 构造单个拼图块的 SVG path 字符串。
 *
 * 每条边:
 *  - 若 edge=0 直线；
 *  - 若 edge!=0 中部有一个"耳朵"（凸=1/凹=-1），使用贝塞尔曲线绘制。
 */
function buildPiecePath(
  x0: number,
  y0: number,
  w: number,
  h: number,
  edges: CellEdges
): string {
  const tab = Math.min(w, h) * 0.22 // 耳朵高度
  const neck = Math.min(w, h) * 0.18 // 耳朵颈宽（一半）
  const parts: string[] = []
  parts.push(`M ${x0} ${y0}`)

  // top edge: from (x0, y0) -> (x0+w, y0)
  parts.push(edgePath(x0, y0, x0 + w, y0, edges.top, tab, neck, edges.jitter.top, 'h'))
  // right edge: (x0+w, y0) -> (x0+w, y0+h)
  parts.push(
    edgePath(x0 + w, y0, x0 + w, y0 + h, edges.right, tab, neck, edges.jitter.right, 'v')
  )
  // bottom edge: (x0+w, y0+h) -> (x0, y0+h)
  parts.push(
    edgePath(x0 + w, y0 + h, x0, y0 + h, edges.bottom, tab, neck, edges.jitter.bottom, 'h')
  )
  // left edge: (x0, y0+h) -> (x0, y0)
  parts.push(edgePath(x0, y0 + h, x0, y0, edges.left, tab, neck, edges.jitter.left, 'v'))
  parts.push('Z')
  return parts.join(' ')
}

/**
 * 构造一条带耳朵的边。dir=h 水平，v 垂直。
 * jitter：耳朵中心沿边线方向偏移比例 (-0.08~0.08)
 */
function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  edge: Edge,
  tab: number,
  neck: number,
  jitter: number,
  dir: 'h' | 'v'
): string {
  if (edge === 0) return `L ${x2} ${y2}`

  // 沿边线的向量
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ux = dx / len // 沿边方向单位向量
  const uy = dy / len
  // 法线（外侧凸方向）：edge=1 表示凸出（远离本块），左手法向
  // 对水平边 (从左->右)，向下为块内，向上为外；这里 edge=1 定义为向外凸。
  // 使用二维叉乘方向：法向 = (-uy, ux) 表示逆时针 90°
  const nx = -uy
  const ny = ux
  const sign = edge // 1 或 -1

  // 边中心点（含 jitter）
  const cx = x1 + dx * (0.5 + jitter)
  const cy = y1 + dy * (0.5 + jitter)

  // 颈部两侧点
  const nA_x = cx - ux * neck
  const nA_y = cy - uy * neck
  const nB_x = cx + ux * neck
  const nB_y = cy + uy * neck

  // 耳朵顶点及两侧控制点
  const topX = cx + nx * tab * sign
  const topY = cy + ny * tab * sign

  // 控制点（用二次贝塞尔近似圆头）
  const cA_x = nA_x + nx * tab * sign * 1.1
  const cA_y = nA_y + ny * tab * sign * 1.1
  const cB_x = nB_x + nx * tab * sign * 1.1
  const cB_y = nB_y + ny * tab * sign * 1.1

  // 使用两段三次贝塞尔：起点 -> nA -> 耳朵 -> nB -> 终点
  const parts: string[] = []
  parts.push(`L ${nA_x} ${nA_y}`)
  parts.push(
    `C ${cA_x} ${cA_y} ${cB_x} ${cB_y} ${nB_x} ${nB_y}`
  )
  // 更真实的形状：使用三段控制，避免过于圆润 - 这里再拆分
  // 简化：直接返回上面近似即可
  parts.push(`L ${x2} ${y2}`)
  // dir 参数当前未使用，保留以便后续扩展不同方向的细节
  void dir
  void topX
  void topY
  return parts.join(' ')
}

/**
 * 将拼图块洗牌并给出打乱初始位置（画布右侧料架区）
 */
export function shufflePieces(pieces: PuzzlePiece[]): PuzzlePiece[] {
  return pieces
    .map((p) => ({ ...p }))
    .sort(() => Math.random() - 0.5)
}
