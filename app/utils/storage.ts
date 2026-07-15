/**
 * app/utils/storage.ts - localStorage 简易封装（SSR 安全）
 */

const isClient = typeof window !== 'undefined'

export function getItem<T = unknown>(key: string, fallback: T): T {
  if (!isClient) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setItem(key: string, value: unknown): void {
  if (!isClient) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function removeItem(key: string): void {
  if (!isClient) return
  window.localStorage.removeItem(key)
}

export const STORAGE_KEYS = {
  DAILY_PLAYS: 'puzzle_daily_plays',      // 云冒险每日剩余次数
  DAILY_DATE: 'puzzle_daily_date',        // 记录日期，跨天重置
  HIGH_SCORE: 'puzzle_high_score',        // 云冒险最高分
  RANK_HISTORY: 'puzzle_rank_history',    // 云冒险每一局得分历史
  ITEMS: 'puzzle_items',                  // 道具数量
  PREMIUM: 'puzzle_premium'               // 是否永久解锁
} as const
