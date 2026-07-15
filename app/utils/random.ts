/**
 * app/utils/random.ts - 随机相关工具
 */

/** 基于种子生成可复现的随机数（简单 LCG） */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** 数组洗牌 */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 区间随机 */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 整数随机 [min, max] */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
