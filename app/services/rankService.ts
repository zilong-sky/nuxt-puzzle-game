/**
 * app/services/rankService.ts
 * 云冒险模式排行榜相关接口占位。
 * 后续对接后端修改此处。
 */

export interface RankItem {
  rank: number
  name: string
  score: number
  avatar?: string
}

/**
 * 拉取云冒险排行榜（当前使用 mock 数据）。
 * 后续对接后端修改此处：改为 fetch(`${apiBase}/api/rank/cloud`)。
 */
export async function fetchCloudRank(): Promise<RankItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const names = ['拼图大师', '像素猎人', '碎片女王', '午夜玩家', '青铜选手', '云端骑士', '疾风', '静水', '奶茶特工', '路人甲']
      const list: RankItem[] = names.map((n, i) => ({
        rank: i + 1,
        name: n,
        score: 800 - i * 47 + Math.floor(Math.random() * 20)
      }))
      resolve(list)
    }, 100)
  })
}

/**
 * 上报本局云冒险得分（占位）。
 * 后续对接后端修改此处：改为 POST `${apiBase}/api/rank/submit`。
 */
export async function submitScore(_score: number): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true }), 100)
  })
}
