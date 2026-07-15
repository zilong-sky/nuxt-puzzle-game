/**
 * app/services/adService.ts
 * 广告相关占位服务。
 * 后续对接后端/广告 SDK 修改此处。
 */

/**
 * 播放一段激励视频广告。当前用假窗口 setTimeout 模拟。
 * 由调用方负责在 UI 层展示广告占位弹窗。
 */
export async function playRewardAd(): Promise<{ rewarded: boolean }> {
  return new Promise((resolve) => {
    // 模拟广告 2 秒
    setTimeout(() => resolve({ rewarded: true }), 2000)
  })
}
