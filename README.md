# GitHub Hunt Data Pipeline (Minimal)

用于生成一套可同时驱动网站、公众号、短视频、小程序卡片的日更 GitHub 项目数据与内容草稿。

## 前端骨架位置

前端页面在 `web/` 目录（Vite + React）。

页面默认读取：`web/public/data/repos.daily.json`。

生成脚本会同时产出：

- 网站数据：`data/projects.json`
- 前端同步数据：`web/public/data/repos.daily.json`
- 公众号草稿：`outputs/wechat/daily-YYYY-MM-DD.md`
- 短视频脚本：`outputs/video/daily-YYYY-MM-DD.md`
- 小程序卡片流：`outputs/miniapp/daily-YYYY-MM-DD.json`
- 每日操作总览：`outputs/daily-YYYY-MM-DD-report.md`

同时会同步公开访问版本到 `web/public/outputs/`，用于 GitHub Pages 在线查看：

- `/outputs/wechat/daily-YYYY-MM-DD.md`
- `/outputs/video/daily-YYYY-MM-DD.md`
- `/outputs/miniapp/daily-YYYY-MM-DD.json`
- `/outputs/reports/daily-YYYY-MM-DD.md`

## 快速开始

```bash
pnpm run daily:run
pnpm run site:build
```

默认主输出文件：`data/projects.json`

## 可选环境变量

- `GITHUB_TOKEN` 或 `GH_TOKEN`：提高 GitHub API 速率限制（推荐）
- `MAX_ITEMS`：输出项目数量，默认 `30`
- `OUTPUT_PATH`：输出 JSON 路径，默认 `data/projects.json`
- `OPENAI_BASE_URL` / `AGENT_BASE_URL`：OpenAI 兼容文本生成服务地址
- `OPENAI_API_KEY`：文本生成服务 Key
- `OPENAI_MODEL`：模型名，例如 `gpt-5.4`

示例：

```bash
GITHUB_TOKEN=xxx MAX_ITEMS=20 pnpm run daily:run
OPENAI_BASE_URL=http://127.0.0.1:8317/v1 OPENAI_API_KEY=xxx OPENAI_MODEL=gpt-5.4 pnpm run daily:run
```

## 输出字段

顶层包含：

- `generatedAt`
- `date`
- `timezone`
- `source`
- `total`
- `items`

每个项目条目包含：

- `id`
- `name`
- `fullName`
- `owner`
- `url`
- `description`
- `summary`（确定性摘要，未接入 AI 时稳定可用）
- `rationale`（推荐理由）
- `stars`
- `language`
- `updatedAt`
- `tags`

## 数据来源策略

使用官方 GitHub Search API 的双查询组合：

1. 近 7 天高活跃更新项目（updated 维度）
2. 近 30 天新晋高热项目（stars 维度）

再做去重、按 star 排序、截断到目标数量，避免脆弱网页抓取。

## 内容生产路径

- 网站：直接消费 `web/public/data/repos.daily.json`
- 公众号：在 `outputs/wechat/` 取 Markdown 草稿做人工精修发布
- 短视频：在 `outputs/video/` 取 60-90 秒脚本做录制/配音
- 小程序：在 `outputs/miniapp/` 取卡片流接只读前端

## 定时与部署

- GitHub Actions 工作流：`.github/workflows/daily.yml`
- 触发方式：每天 UTC 01:00 自动运行，或手动触发 `workflow_dispatch`
- 部署方式：`pnpm run site:build` 先把 `web/public` 同步进 `web/dist`，再发布到 GitHub Pages
- 订阅入口：部署后访问 `/rss.xml`

### Pages 运行前需要的 Secrets / Vars

- `OPENAI_BASE_URL`（可选）
- `OPENAI_API_KEY`（可选）
- `OPENAI_MODEL`（可选）
- `SITE_URL`（建议配置为实际 Pages 地址）

## 商业化起步路径

先不卖订阅，先卖可信分发位：

1. 站内赞助位 / 工具位
2. 公众号文末合作位
3. 招聘位 / 招募合作伙伴页

等日更稳定、流量和订阅起来之后，再考虑广告和细分付费订阅。
