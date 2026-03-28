# GitHub Hunt Web

一个最小的 React + Vite 前端骨架：展示“每日热库”统一日更 JSON 数据。

## 运行

```bash
pnpm install
pnpm dev
```

## 本地数据契约

页面读取固定路径：`/data/repos.daily.json`（对应文件 `public/data/repos.daily.json`）。

```json
{
  "generatedAt": "2026-03-27T15:06:39.158Z",
  "date": "2026-03-27",
  "timezone": "Asia/Shanghai",
  "source": "github-search-api",
  "total": 1,
  "items": [
    {
      "id": "owner/repo",
      "name": "repo",
      "owner": "owner",
      "fullName": "owner/repo",
      "url": "https://github.com/owner/repo",
      "description": "原始仓库描述",
      "summary": "中文/规则化摘要",
      "rationale": "为什么值得看",
      "stars": 12345,
      "language": "TypeScript",
      "tags": ["ai", "tooling"],
      "updatedAt": "2026-03-27T00:00:00.000Z"
    }
  ]
}
```

其中 `items` 为空数组时，页面会显示空状态，不会报错。

这份 JSON 与根目录生成脚本输出保持一致，因此网站、公众号、视频脚本、小程序卡片可以共用同一个数据底座。
