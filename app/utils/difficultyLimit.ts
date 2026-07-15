export interface DifficultyLimitOpts {
  imgW: number
  imgH: number
  minCellPx?: number
  reserveH?: number
  reserveW?: number
  maxWrapW?: number
  maxWrapH?: number
  hardMin?: number
  hardMax?: number
  vw?: number
  vh?: number
}

export function computeMaxPieces(o: DifficultyLimitOpts): number {
  const minCell = o.minCellPx ?? 50
  const reserveH = o.reserveH ?? 240
  const reserveW = o.reserveW ?? 32
  const maxWrapW = o.maxWrapW ?? 560
  const maxWrapH = o.maxWrapH ?? 900
  const hardMax = o.hardMax ?? 200
  const hardMin = o.hardMin ?? 4
  const vw = o.vw ?? (typeof window !== 'undefined' ? window.innerWidth : 400)
  const vh = o.vh ?? (typeof window !== 'undefined' ? window.innerHeight : 800)

  const portraitViewport = vh >= vw
  const portraitImage = o.imgH >= o.imgW
  const rotated = portraitViewport && !portraitImage
  const W = rotated ? o.imgH : o.imgW
  const H = rotated ? o.imgW : o.imgH
  const a = W / H

  const capW = Math.min(vw - reserveW, maxWrapW)
  const capH = Math.min(vh - reserveH, maxWrapH)
  let wrapW = capW
  let wrapH = capW / a
  if (wrapH > capH) { wrapH = capH; wrapW = capH * a }

  const maxCols = Math.max(2, Math.floor(wrapW / minCell))
  const maxRows = Math.max(2, Math.floor(wrapH / minCell))
  const raw = Math.floor(maxCols * maxRows * 0.85)
  return Math.min(hardMax, Math.max(hardMin, raw))
}
