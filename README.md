> 切割方式已由 SVG 异形（凸凹卡口）重构为矩形网格。支持“拿起放大 1.15× + 深色阴影 + 跟手 + 槽位吸附”的手感。

# 网页拼图小游戏 (Nuxt 4)

基于 **Nuxt 4 + Pinia + SVG clip-path** 的纯前端拼图游戏，可直接一键部署到 **Vercel**。包含 **休闲 / 云冒险 / 自拍上传** 三大玩法、SVG 不规则异形切割、道具系统、广告复活、localStorage 持久化、排行榜（模拟数据）、响应式适配。

> 所有后端接口 / 图片上传 / 广告 SDK 全部以**占位函数**形式封装，代码中通过注释 `// 后续对接后端修改此处` 明确标注，接入真实后端时只需修改 `app/services/**` 与 `app/pages/**` 中的少量位置。

---

## 一、目录结构

```
nuxt-puzzle-game/
├── app/
│   ├── app.vue                  # 应用入口，套用 default 布局
│   ├── layouts/
│   │   └── default.vue          # 全站布局：AppHeader + <slot> + AppFooter
│   ├── pages/
│   │   ├── index.vue            # 首页：三大模式入口
│   │   ├── rank.vue             # 云冒险排行榜（mock 数据）
│   │   └── play/
│   │       ├── casual.vue       # 休闲模式游玩页
│   │       ├── cloud.vue        # 云冒险模式游玩页
│   │       └── selfie.vue       # 自拍上传模式（选图 + 顺序游玩）
│   ├── components/
│   │   ├── AppHeader.vue        # 全站顶部导航
│   │   ├── AppFooter.vue        # 全站底部版权
│   │   ├── ModalDialog.vue      # 通用弹窗
│   │   ├── AdModal.vue          # 广告播放占位弹窗
│   │   ├── PuzzleBoard.vue      # SVG 拼图棋盘 + 拖拽
│   │   └── PuzzleGame.vue       # 单局游戏（HUD/道具/成功失败弹窗/广告复活）
│   ├── composables/
│   │   └── usePuzzleGame.ts     # 游戏核心状态机 hook
│   ├── services/                # 全部为占位函数，返回 Promise mock
│   │   ├── imageService.ts      # 图库拉取 / 图片上传
│   │   ├── rankService.ts       # 排行榜拉取 / 得分上报
│   │   └── adService.ts         # 广告播放
│   ├── stores/
│   │   └── gameStore.ts         # Pinia：道具/每日次数/最高分/永久解锁
│   ├── utils/
│   │   ├── puzzle.ts            # 核心：SVG 异形切割算法
│   │   ├── random.ts            # 随机工具
│   │   ├── storage.ts           # SSR 安全的 localStorage 封装
│   │   └── time.ts              # 时间格式化 / 倒计时策略
│   └── assets/
│       └── css/main.css         # 全站基础样式与 CSS 变量
├── nuxt.config.ts               # nitro preset: vercel
├── package.json                 # nuxt ^4
├── tsconfig.json
└── README.md
```

---

## 二、页面功能一览

| 路由                | 说明                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `/`                 | 三大模式入口、云冒险状态展示、云冒险模式的文案说明弹窗               |
| `/rank`             | 云冒险排行榜（当前使用 mock 数据）                                   |
| `/play/casual`      | 休闲模式：按图库编号顺序加载，不计分、不上排行榜                     |
| `/play/cloud`       | 云冒险模式：按上传时间升序播放公开自拍图，含每日次数/得分/广告复活   |
| `/play/selfie`      | 自拍上传：摄像头拍照 / 相册多选、难度滑块、依次通关、通关询问上传    |

---

## 三、核心机制说明

### 1. SVG 不规则异形切割
- `app/utils/puzzle.ts` 中先决定每条相邻边"凸/凹"方向（网格全局一致，保证严丝合缝），再为每条边在中点附近生成一段随机贝塞尔耳朵。
- 每块生成独立 `<clipPath>`，`<PuzzleBoard>` 中所有块引用同一张底图（`<image>`）并用 clip-path 裁出对应形状 —— 天然实现异形非规则拼图效果。
- 拼图块中心带随机 jitter，摆脱视觉上的规整网格。

### 2. 倒计时压力
- `calcCountdown(pieceCount) = 60 + pieceCount * 4`，块越多总时长同步加长，避免紧张限时压力。
- 冻结道具触发后 60 秒内暂停倒计时递减，仍可正常拖拽。

### 3. 道具系统
- 🧠 **智能还原**：一键自动摆正 3 块未放置碎片。
- ❄️ **时间冻结**：暂停倒计时 60 秒，可自由拖拽。
- 道具数量存 `localStorage`，通过 `stores/gameStore.ts` 集中管理。

### 4. 广告复活
- 倒计时耗尽 → 弹出失败对话框 → "看广告复活" 打开 `AdModal`（占位 SDK）→ 完成后调用 `reviveByAd()` 全额重置倒计时，无需重选模式或图片。

### 5. 云冒险每日限制
- 首次进入云冒险入口消耗一次机会，历史/剩余次数、最高分均存 `localStorage`。
- 用完 5 次后弹窗提供两种解锁方式：
  - 观看广告：`grantExtraPlay()` +1 次继续；
  - 付费永久解锁：`unlockPremium()` 永久免次数、免广告特权。

### 6. 三种模式差异
| 差异点     | 休闲             | 云冒险                                  | 自拍上传                                  |
| ---------- | ---------------- | --------------------------------------- | ----------------------------------------- |
| 图源       | 图库编号顺序     | 玩家自拍公开图，按上传时间升序          | 摄像头 or 本地多选                        |
| 块数       | 随机 30~80       | 随机 30~200（沿用玩家上传难度自定义）   | 滑块自定义 30~200，默认随机 30~80         |
| 计分       | ❌ 不计分        | ✅ = 拼图总块数，上报排行榜             | ❌ 不计分                                 |
| 排行榜     | ❌               | ✅                                     | ❌                                        |
| 次数限制   | ❌               | ✅ 每日 5 次 / 永久解锁                | ❌                                        |
| 通关后动作 | 直接下一张       | 直接下一张                              | 询问是否上传到公开云图库                  |

---

## 四、组件用途速览

- **AppHeader / AppFooter**：全站统一，色彩与文字使用 CSS 变量集中管理，方便统一改配色。
- **ModalDialog**：通用弹窗，支持点击遮罩关闭 / 可关闭按钮 / 自定义 footer。
- **AdModal**：广告占位弹窗，倒计时条 + "广告占位（后续对接后端修改此处）"文案。
- **PuzzleBoard**：SVG 拼图棋盘，鼠标 / 触摸拖拽，支持吸附。
- **PuzzleGame**：一局完整游戏（HUD、道具、成功/失败弹窗、广告复活），页面只需传 `imageUrl` 和 `pieceCount`。

---

## 五、本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器 (默认 http://localhost:3000)
npm run dev

# 生产构建
npm run build
npm run preview
```

Node 版本建议：≥ 18.18（Nuxt 4 要求）。

---

## 六、一键部署 Vercel

1. 将本项目推送到 GitHub / GitLab；
2. 在 Vercel 后台 **Import Project** 选择该仓库；
3. Framework Preset 自动识别为 **Nuxt**，无需额外配置（本项目已在 `nuxt.config.ts` 设置 `nitro.preset = 'vercel'`，双保险）；
4. 点击 **Deploy**，几分钟后即可访问。

如需自定义域名 / 环境变量，在 Vercel 控制台后台配置即可。

---

## 七、后续对接后端 / 修改位置

代码中已经用 `// 后续对接后端修改此处` 明确标注了后端对接点，接入真实服务时按顺序替换即可：

| 文件                                 | 说明                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| `app/services/imageService.ts`       | `fetchCasualImages` / `fetchCloudImages` / `uploadImage` |
| `app/services/rankService.ts`        | `fetchCloudRank` / `submitScore`                       |
| `app/services/adService.ts`          | `playRewardAd` 接入激励视频广告 SDK                    |
| `app/pages/play/cloud.vue`           | `onUnlockPremium` 中调用真实支付流程                   |
| `nuxt.config.ts`                     | `runtimeConfig.public.apiBase` 填入后端域名            |

---

## 八、数据存储

所有本地持久化统一走 `app/utils/storage.ts`，键名集中在 `STORAGE_KEYS`：

| Key                    | 含义                          |
| ---------------------- | ----------------------------- |
| `puzzle_daily_plays`   | 云冒险当日剩余次数            |
| `puzzle_daily_date`    | 当日日期，用于跨天重置        |
| `puzzle_high_score`    | 云冒险历史最高分              |
| `puzzle_rank_history`  | 云冒险每一局得分数组          |
| `puzzle_items`         | 道具数量 `{ restore, freeze }` |
| `puzzle_premium`       | 是否已永久解锁云冒险          |

---

## 九、License

仅供学习交流使用，勿用于商业目的。图片素材为占位 SVG，接入真实后端后请注意版权合规。
