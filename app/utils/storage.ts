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
  DAILY_PLAYS: 'puzzle_daily_plays',
  DAILY_DATE: 'puzzle_daily_date',
  HIGH_SCORE: 'puzzle_high_score',
  RANK_HISTORY: 'puzzle_rank_history',
  ITEMS: 'puzzle_items',
  PREMIUM: 'puzzle_premium',
  ADV_IDX: 'puzzle:adv-idx',
  PLAYER_NAME: 'puzzle:player-name',
  PAID_PLAYS_USED: 'puzzle:paid-plays-used'
} as const
