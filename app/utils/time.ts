/**
 * app/utils/time.ts - 时间相关工具
 */

/** 获取当前日期 (YYYY-MM-DD) */
export function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 秒 -> mm:ss */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/**
 * 根据拼图块数量计算倒计时（秒）
 * 块数越多，总时长越长；无紧张限时压力。
 */
export function calcCountdown(pieceCount: number): number {
  // 基础 60 秒 + 每块 4 秒
  return 60 + pieceCount * 4
}
