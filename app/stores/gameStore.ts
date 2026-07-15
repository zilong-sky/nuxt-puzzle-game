/**
 * app/stores/gameStore.ts
 * 全局游戏状态：道具数量、云冒险每日次数、最高分、每局历史。
 */

import { defineStore } from 'pinia'
import { getItem, setItem, STORAGE_KEYS } from '~/utils/storage'
import { todayString } from '~/utils/time'

const DAILY_FREE = 5

interface Items {
  restore: number   // 智能还原
  freeze: number    // 时间冻结
}

interface State {
  items: Items
  dailyDate: string
  dailyPlaysLeft: number
  premium: boolean
  highScore: number
  rankHistory: number[]
  initialized: boolean
}

export const useGameStore = defineStore('game', {
  state: (): State => ({
    items: { restore: 1, freeze: 1 },
    dailyDate: '',
    dailyPlaysLeft: DAILY_FREE,
    premium: false,
    highScore: 0,
    rankHistory: [],
    initialized: false
  }),
  getters: {
    dailyFree: () => DAILY_FREE,
    canPlayCloud: (s) => s.premium || s.dailyPlaysLeft > 0
  },
  actions: {
    /** 从 localStorage 恢复状态，客户端首次挂载时调用 */
    hydrate() {
      if (this.initialized) return
      const today = todayString()
      const savedDate = getItem(STORAGE_KEYS.DAILY_DATE, '')
      let plays = getItem<number>(STORAGE_KEYS.DAILY_PLAYS, DAILY_FREE)
      if (savedDate !== today) {
        // 跨日重置
        plays = DAILY_FREE
        setItem(STORAGE_KEYS.DAILY_DATE, today)
        setItem(STORAGE_KEYS.DAILY_PLAYS, plays)
      }
      this.dailyDate = today
      this.dailyPlaysLeft = plays
      this.premium = getItem(STORAGE_KEYS.PREMIUM, false)
      this.highScore = getItem(STORAGE_KEYS.HIGH_SCORE, 0)
      this.rankHistory = getItem<number[]>(STORAGE_KEYS.RANK_HISTORY, [])
      this.items = getItem<Items>(STORAGE_KEYS.ITEMS, { restore: 1, freeze: 1 })
      this.initialized = true
    },
    /** 消耗一次云冒险游戏机会 */
    consumeCloudPlay() {
      if (this.premium) return
      if (this.dailyPlaysLeft > 0) {
        this.dailyPlaysLeft -= 1
        setItem(STORAGE_KEYS.DAILY_PLAYS, this.dailyPlaysLeft)
      }
    },
    /** 广告 / 付费 → 追加一次机会（+1） */
    grantExtraPlay() {
      this.dailyPlaysLeft += 1
      setItem(STORAGE_KEYS.DAILY_PLAYS, this.dailyPlaysLeft)
    },
    /** 永久解锁 */
    unlockPremium() {
      this.premium = true
      setItem(STORAGE_KEYS.PREMIUM, true)
    },
    /** 云冒险单局结算 */
    submitCloudScore(score: number) {
      this.rankHistory.push(score)
      if (score > this.highScore) {
        this.highScore = score
        setItem(STORAGE_KEYS.HIGH_SCORE, score)
      }
      setItem(STORAGE_KEYS.RANK_HISTORY, this.rankHistory)
    },
    /** 使用道具 */
    useItem(kind: keyof Items) {
      if (this.items[kind] > 0) {
        this.items[kind] -= 1
        setItem(STORAGE_KEYS.ITEMS, this.items)
        return true
      }
      return false
    },
    /** 增加道具（例如观看广告奖励） */
    addItem(kind: keyof Items, count = 1) {
      this.items[kind] += count
      setItem(STORAGE_KEYS.ITEMS, this.items)
    }
  }
})
