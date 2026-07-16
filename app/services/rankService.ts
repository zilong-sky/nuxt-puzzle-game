/**
 * app/services/rankService.ts
 * 鎺掕姒滄湇鍔★細璇诲彇/鎻愪氦鐪熷疄鎺掑悕鏁版嵁銆? */

export interface RankItem {
  rank: number
  name: string
  score: number
  avatar?: string
  level_reached?: number
  created_at?: number
}

export async function fetchCloudRank(): Promise<RankItem[]> {
  return await $fetch<RankItem[]>('/api/rank/list')
}

export async function submitScore(payload: {
  player_name: string
  fingerprint: string
  score: number
  level_reached?: number
}): Promise<{ ok: boolean }> {
  return await $fetch<{ ok: boolean }>('/api/rank/submit', { method: 'POST', body: payload })
}
