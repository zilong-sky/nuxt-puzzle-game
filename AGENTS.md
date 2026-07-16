# Codex 工作指南 - nuxt-puzzle-game

## 项目速览
- Nuxt 4 + Pinia + Vercel 部署（`nitro.preset='vercel'`），生产地址 https://nuxt-puzzle-game.vercel.app
- 三大模式：休闲 / 云冒险（云图库 seq 顺序） / 自拍上传（走审核）
- 后端：Vercel Postgres 存 `cloud_images`/`upload_quota`/`scores`，Vercel Blob 存自拍图
- 姊妹后台项目 `puzzle-admin`（共用同一 Postgres+Blob）负责审核

## Windows 环境常见坑（务必规避）

### ⚠️ 中文文件禁用 heredoc/echo
Windows Codex 沙箱走 PowerShell，heredoc/echo 输出中文会被强制转 GBK 编码写入文件，UTF-8 项目读到就是乱码（锟/烫/榛/璇/鎴/绯/绔/銆 等）。
**修法**：写含中文的文件时**只用 `apply_patch` / `write` 工具**，或用 python `sys.stdout.buffer.write(text.encode('utf-8'))`。绝不 `echo "中文" > file` 或 heredoc。

### ⚠️ Nuxt runtimeConfig 环境变量必须显式绑定
Nuxt 只自动映射 `NUXT_` 前缀的环境变量。自定义名字（如 `ADMIN_PASSWORD`）必须在 `nuxt.config.ts` 里显式写：
```ts
runtimeConfig: {
  adminPassword: process.env.ADMIN_PASSWORD || '',
}
```
否则线上永远读到空字符串。

## 工作流约定
- 用户交付方式：写 `CHANGE_REQUEST.md`，Codex `exec` 一次性执行
- 完成条件：`npm run build` 通过 + git commit + push origin master
- 遇到不确定项做保守选择，不要中途询问用户

## 部署
- push origin master → Vercel 自动部署到生产
- 或本地 `vercel --prod --yes --token=$VERCEL_TOKEN` 手动部署

## 数据库
建表 SQL 见 `SETUP.md`。所有时间字段用 `BIGINT`（ms），不用 TIMESTAMPTZ。
