# 每日热门仓库摘要设计（2026-03-27）

## 背景与目标
- 目标是每天投放一份中文简报，涵盖“实用/热门” GitHub 仓库，配备简明点评，供静态页面或邮件展示。
- 需尽可能依靠可靠、可测的源（官方 API）并确保摘要风格可控且适合静态化展示。
- 需简化 rate-limit、摘要生成与 fallback 流程，使产出稳定、成本可控。

## 核心架构概览
1. **数据采集层**：使用 GitHub REST Search API（`/search/repositories`）以 `created:>` + `sort:stars` 等查询条件抓取当天新增/热度增长仓库，带分页拿到 15~40 条目标条目。
2. **摘要层**：将结构化字段（名称/语言/描述/星数/链接/关键词）打包为文本，交给 LLM（可用 OpenAI 兼容接口）按 prompt 生成 HTML 片段，方便前端/静态页直接渲染。
3. **输出层**：把原始 JSON 和 LLM 产出存到 `public/api/daily-trending/YYYY-MM-DD.*`，前端仅需读取即可。

## 数据采集细节
- 构建 query（例如 `q=created:>2026-03-26 sort:stars language:Go`），`per_page=100`、`page` 翻页，最多 1,000 条/请求，GitHub Search 只会从匹配的前 4,000 个仓库返回结果。
- 认证请求 30 次/分钟（unauthed 10 次），需在每次请求之间留出 2 秒或采用令牌桶控速。
- 确保查询字符数 ≤ 256 且 `AND/OR/NOT` 个数 ≤ 5，否则 API 返回 422。监听 `incomplete_results=true`，如发生需缩小时间范围或分批查询。
- 可在 `Accept: application/vnd.github.text-match+json` 中获取 `text_matches`，用于辅助摘要插入关键词。
- 记录 `stars_delta`（当前星数与前日之差）后用于排序与“今日热度”说明。

## 摘要生成细节
- 定义统一模板：先列出 `name/description/language/stars/url/delta`，提示 LLM 输出中文摘要，严格限用 `<h2>/<h3>/<p>/<a>/<strong>/<em>/<ul>/<li>`，每条 2-3 句，总字数 < 400。
- 结构可以按照 `language` 或 `topics` 做简单分组，在摘要中加入 `<h3>` 标题；提示示例参考 `MaliTredings/summarizer.py` 的 system prompt
target（改写成中文）并附上 `repos` 列表作为 user message。
- 若 LLM 返回非 HTML（缺标签、太长），使用正则复核（例如检查是否包含 `<p>`），异常时刷新 prompt 或降级提示固定副本。
- 摘要输出存为 `daily-summary.html`（内嵌 `<section>`），也可再生成 `daily-summary.md` 供邮件/文本渠道。

## 容错与备用方案
- **API 异常**：429/422 返回时采用指数退避（1s、2s、4s），重试三次后如仍失败，换成 Trending 页面爬虫（`requests` + `PyQuery` 抓 `.Box-row`）作为赎回。
- **LLM 调用失败**：捕获超时/403，记录 `LLM_BaseUrl/Key`，可用固定占位 “今日暂未生成” 代替输出，并触发告警。
- **速率监控**：每个批次统计 `requests/minute`，把总 API 调用保存于 `metrics/trending-search.log`，若接近限额可降低 `per_page` 或延长调用间隔；LLM 调用也做 count/limit 检查。

## 输出与联动
- 生成的 JSON（含 `repos`）与 HTML 摘要同步写到 `public/api/trending/YYYY-MM-DD.json` 与 `public/api/trending/YYYY-MM-DD.html`，提供静态站/邮箱/公众号调用。
- 可额外提供 `daily-rss.xml`（24小时版）或 `email-body.html`，LLM 输出本身可直接纳入邮件模板。
- 前端只需读上述静态资源，无需再触发 API，提升可用性。

## 后续任务
1. 构建采集 + 摘要 job，设定 cron（或 Cloud Run scheduler）每日执行。
2. 实现 fallback 爬虫脚本，确保 API 不可用时仍有热门数据。
3. 编写前端组件直接引用 `daily-summary.html` 并处理中文摘要内容。

以上设计是否已覆盖你的需求？需要继续细化哪部分再展开实现计划？
