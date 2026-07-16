/**
 * app/stores/gameStore.ts
 * 全局游戏状态：道具数量、云冒险每日次数、最高分、每局历史、冒险模式进度。
 */

import { defineStore } from 'pinia'
import { getItem, setItem, STORAGE_KEYS } from '~/utils/storage'
import { todayString } from '~/utils/time'

const DAILY_FREE = 5

interface Items {
  restore: number
  freeze: number
}

interface State {
  items: Items
  dailyDate: string
  dailyPlaysLeft: number
  premium: boolean
  highScore: number
  rankHistory: number[]
  adventureIdx: number
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
    adventureIdx: 0,
    initialized: false
  }),
  getters: {
    dailyFree: () => DAILY_FREE,
    canPlayCloud: (s) => s.premium || s.dailyPlaysLeft > 0
  },
  actions: {
    hydrate() {
      if (this.initialized) return
      const today = todayString()
      const savedDate = getItem(STORAGE_KEYS.DAILY_DATE, '')
      let plays = getItem<number>(STORAGE_KEYS.DAILY_PLAYS, DAILY_FREE)
      if (savedDate !== today) {
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
      this.adventureIdx = getItem<number>(STORAGE_KEYS.ADV_IDX, 0)
      this.initialized = true
    },
    consumeCloudPlay() {
      if (this.premium) return
      if (this.dailyPlaysLeft > 0) {
        this.dailyPlaysLeft -= 1
        setItem(STORAGE_KEYS.DAILY_PLAYS, this.dailyPlaysLeft)
      }
    },
    grantExtraPlay() {
      this.dailyPlaysLeft += 1
      setItem(STORAGE_KEYS.DAILY_PLAYS, this.dailyPlaysLeft)
    },
    unlockPremium() {
      this.premium = true
      setItem(STORAGE_KEYS.PREMIUM, true)
    },
    submitCloudScore(score: number) {
      this.rankHistory.push(score)
      if (score > this.highScore) {
        this.highScore = score
        setItem(STORAGE_KEYS.HIGH_SCORE, score)
      }
      setItem(STORAGE_KEYS.RANK_HISTORY, this.rankHistory)
    },
    setAdventureIdx(i: number) {
      this.adventureIdx = i
      setItem(STORAGE_KEYS.ADV_IDX, i)
    },
    /** @deprecated 道具已改为按张自动补满，保留接口供未来付费购买时使用 */
    useItem(kind: keyof Items) {
      if (this.items[kind] > 0) {
        this.items[kind] -= 1
        setItem(STORAGE_KEYS.ITEMS, this.items)
        return true
      }
      return false
    },
    addItem(kind: keyof Items, count = 1) {
      this.items[kind] += count
      setItem(STORAGE_KEYS.ITEMS, this.items)
    }
  }
})