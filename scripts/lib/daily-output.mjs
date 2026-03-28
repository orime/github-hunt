function normalizeText(input) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function escapeXml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(isoString, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(isoString));
}

function buildTags(repo) {
  const tags = [];
  const language = normalizeText(repo.language).toLowerCase();
  if (language) tags.push(language);

  const daysSinceUpdate = Math.floor((Date.now() - new Date(repo.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
  tags.push(daysSinceUpdate <= 7 ? "active" : "watchlist");
  tags.push("trending");

  return Array.from(new Set(tags)).filter(Boolean);
}

export function toDailyItem(repo) {
  const owner = normalizeText(repo.owner);
  const name = normalizeText(repo.name);
  const fullName = owner && name ? `${owner}/${name}` : name;

  return {
    id: fullName,
    name,
    owner,
    fullName,
    url: repo.url,
    description: normalizeText(repo.description),
    summary: normalizeText(repo.summary),
    rationale: normalizeText(repo.rationale),
    stars: Number(repo.stars) || 0,
    language: normalizeText(repo.language) || "未知技术栈",
    updatedAt: repo.updatedAt,
    tags: buildTags(repo)
  };
}

export function buildDailyBundle({ repos, generatedAt, source, timezone = "Asia/Shanghai" }) {
  const safeGeneratedAt = generatedAt || new Date().toISOString();
  const items = repos.map(toDailyItem);

  return {
    generatedAt: safeGeneratedAt,
    date: formatDate(safeGeneratedAt, timezone),
    timezone,
    source,
    total: items.length,
    items
  };
}

export function buildWechatArticleMarkdown({ date, items }) {
  const lines = [
    `# GitHub 热门项目日报 · ${date}`,
    "",
    "每天一份，只讲值得跟进的开源项目。下面这版可以直接拿去二次编辑成公众号文章。",
    ""
  ];

  items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.fullName}`);
    lines.push(`- 链接：${item.url}`);
    lines.push(`- 技术栈：${item.language} · ⭐ ${item.stars.toLocaleString("zh-CN")}`);
    lines.push(`- 一句话：${item.summary}`);
    lines.push(`- 为什么值得看：${item.rationale}`);
    lines.push("");
  });

  lines.push("---");
  lines.push("可商业化入口：文末可放赞助位、工具位、招聘位，正文保持编辑独立。\n");
  return `${lines.join("\n")}\n`;
}

export function buildVideoScriptMarkdown({ date, items }) {
  const lines = [
    `# GitHub 热门项目短视频脚本 · ${date}`,
    "",
    "定位：60-90 秒，快速讲清今天最值得看的项目。",
    "",
    "## 开场 Hook",
    "今天不刷垃圾榜，只看真正值得开发者跟进的 GitHub 项目。",
    ""
  ];

  items.slice(0, 3).forEach((item, index) => {
    lines.push(`## 段落 ${index + 1} · ${item.fullName}`);
    lines.push(`- 这是什么：${item.summary}`);
    lines.push(`- 为什么值得看：${item.rationale}`);
    lines.push(`- 口播收尾：项目链接我放在合集里，想跟进可以直接收藏。`);
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

export function buildMiniAppFeed({ date, items }) {
  return {
    date,
    cards: items.map((item) => ({
      id: item.id,
      title: item.fullName,
      subtitle: `${item.language} · ⭐ ${Number(item.stars).toLocaleString("zh-CN")}`,
      summary: item.summary,
      reason: item.rationale,
      url: item.url,
      tags: item.tags,
      updatedAt: item.updatedAt
    }))
  };
}

export function buildOperatorReportMarkdown(bundle, paths) {
  const topItems = bundle.items.slice(0, 5);

  const lines = [
    `# GitHub Hunt 每日总览 · ${bundle.date}`,
    "",
    `今日共生成 ${bundle.total} 条项目，以下产物已经就位：`,
    "",
    `- 网站数据：${paths.websiteDataPath}`,
    `- RSS 订阅：${paths.rssPath}`,
    `- 公众号草稿：${paths.wechatPath}`,
    `- 视频脚本：${paths.videoPath}`,
    `- 小程序卡片：${paths.miniappPath}`,
    "",
    "## 今日最值得先看的项目",
    ""
  ];

  topItems.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.fullName} · ${item.language} · ⭐ ${item.stars.toLocaleString("zh-CN")}`);
    lines.push(`   - 摘要：${item.summary}`);
    lines.push(`   - 理由：${item.rationale}`);
  });

  lines.push("");
  lines.push("## 今天怎么用");
  lines.push("");
  lines.push("1. 先看网站数据是否正常。 ");
  lines.push("2. 公众号直接在草稿上人工精修。 ");
  lines.push("3. 视频先录前 3 个项目。 ");
  lines.push("4. 小程序直接消费卡片 JSON。\n");

  return `${lines.join("\n")}\n`;
}

export function buildRssXml({ siteTitle, siteUrl, date, items }) {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const entries = items.slice(0, 20).map((item) => {
    const title = escapeXml(item.fullName);
    const link = escapeXml(item.url);
    const guid = escapeXml(item.url);
    const description = escapeXml(`${item.summary}\n${item.rationale}`);
    const pubDate = new Date(item.updatedAt).toUTCString();

    return [
      "  <item>",
      `    <title>${title}</title>`,
      `    <link>${link}</link>`,
      `    <guid>${guid}</guid>`,
      `    <description>${description}</description>`,
      `    <pubDate>${pubDate}</pubDate>`,
      "  </item>"
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `  <title>${escapeXml(siteTitle)}</title>`,
    `  <link>${escapeXml(normalizedSiteUrl)}</link>`,
    `  <description>${escapeXml(`${siteTitle} · ${date} 日更订阅`)}</description>`,
    ...entries,
    '</channel>',
    '</rss>',
    ''
  ].join("\n");
}
