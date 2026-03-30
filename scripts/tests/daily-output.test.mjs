import test from "node:test";
import assert from "node:assert/strict";
import {
  buildArchiveIndex,
  buildDailyBundle,
  buildMiniAppFeed,
  buildOperatorReportMarkdown,
  buildPublicArtifacts,
  buildRssXml,
  buildVideoScriptMarkdown,
  buildWechatArticleMarkdown
} from "../lib/daily-output.mjs";

const sampleRepo = {
  name: "awesome-repo",
  owner: "alice",
  url: "https://github.com/alice/awesome-repo",
  description: "一个很实用的自动化工具",
  stars: 9527,
  language: "TypeScript",
  updatedAt: "2026-03-27T00:00:00.000Z",
  ownerAvatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
  socialPreviewImageUrl: "https://opengraph.githubassets.com/1/demo",
  summary: "一个很实用的自动化工具（TypeScript，⭐ 9,527）",
  rationale: "TypeScript 生态值得关注，热度稳定上涨"
};

test("buildDailyBundle 生成网站与内容工厂共用 schema", () => {
  const bundle = buildDailyBundle({
    repos: [sampleRepo],
    generatedAt: "2026-03-27T08:00:00.000Z",
    source: "github-search-api",
    timezone: "Asia/Shanghai"
  });

  assert.equal(bundle.date, "2026-03-27");
  assert.equal(bundle.items.length, 1);
  assert.equal(bundle.items[0].id, "alice/awesome-repo");
  assert.equal(bundle.items[0].fullName, "alice/awesome-repo");
  assert.equal(bundle.items[0].summary, sampleRepo.summary);
  assert.equal(bundle.items[0].ownerAvatarUrl, sampleRepo.ownerAvatarUrl);
  assert.equal(bundle.items[0].socialPreviewImageUrl, sampleRepo.socialPreviewImageUrl);
  assert.match(bundle.items[0].tags.join(","), /typescript/i);
});

test("buildPublicArtifacts 生成前端可直接消费的公开产物路径", () => {
  const outputs = buildPublicArtifacts("2026-03-28");

  assert.equal(outputs.wechat.type, "markdown");
  assert.equal(outputs.wechat.path, "/outputs/wechat/daily-2026-03-28.md");
  assert.equal(outputs.video.path, "/outputs/video/daily-2026-03-28.md");
  assert.equal(outputs.report.path, "/outputs/reports/daily-2026-03-28.md");
  assert.equal(outputs.miniapp.type, "json");
  assert.equal(outputs.images.path, "/outputs/images/daily-2026-03-28.json");
});

test("buildArchiveIndex 生成按日期倒序的历史索引", () => {
  const older = {
    generatedAt: "2026-03-27T01:00:00.000Z",
    date: "2026-03-27",
    source: "github-search-api",
    total: 1,
    outputs: buildPublicArtifacts("2026-03-27"),
    items: [
      {
        id: "alice/awesome-repo",
        fullName: "alice/awesome-repo",
        language: "TypeScript",
        stars: 9527,
        summary: sampleRepo.summary
      }
    ]
  };
  const newer = {
    generatedAt: "2026-03-28T01:00:00.000Z",
    date: "2026-03-28",
    source: "github-search-api",
    total: 1,
    outputs: buildPublicArtifacts("2026-03-28"),
    items: [
      {
        id: "bob/ship-it",
        fullName: "bob/ship-it",
        language: "Go",
        stars: 1200,
        summary: "Go 服务工具"
      }
    ]
  };

  const archiveIndex = buildArchiveIndex([older, newer], "2026-03-28T09:00:00.000Z");

  assert.equal(archiveIndex.latest, "2026-03-28");
  assert.equal(archiveIndex.total, 2);
  assert.deepEqual(
    archiveIndex.entries.map((entry) => entry.date),
    ["2026-03-28", "2026-03-27"]
  );
  assert.equal(archiveIndex.entries[0].outputs.wechat.path, "/outputs/wechat/daily-2026-03-28.md");
  assert.equal(archiveIndex.entries[0].topRepos[0].fullName, "bob/ship-it");
});

test("buildWechatArticleMarkdown 生成可直接二次编辑的公众号草稿", () => {
  const markdown = buildWechatArticleMarkdown({
    date: "2026-03-27",
    items: [
      {
        id: "alice/awesome-repo",
        fullName: "alice/awesome-repo",
        url: sampleRepo.url,
        summary: sampleRepo.summary,
        rationale: sampleRepo.rationale,
        language: sampleRepo.language,
        stars: sampleRepo.stars
      }
    ]
  });

  assert.match(markdown, /GitHub 热门项目日报/);
  assert.match(markdown, /alice\/awesome-repo/);
  assert.match(markdown, /TypeScript 生态值得关注/);
});

test("buildVideoScriptMarkdown 生成短视频口播脚本", () => {
  const script = buildVideoScriptMarkdown({
    date: "2026-03-27",
    items: [
      {
        id: "alice/awesome-repo",
        fullName: "alice/awesome-repo",
        url: sampleRepo.url,
        summary: sampleRepo.summary,
        rationale: sampleRepo.rationale,
        language: sampleRepo.language,
        stars: sampleRepo.stars
      }
    ]
  });

  assert.match(script, /60-90 秒/);
  assert.match(script, /alice\/awesome-repo/);
  assert.match(script, /为什么值得看/);
});

test("buildMiniAppFeed 生成小程序卡片数据", () => {
  const feed = buildMiniAppFeed({
    date: "2026-03-27",
    items: [
      {
        id: "alice/awesome-repo",
        fullName: "alice/awesome-repo",
        url: sampleRepo.url,
        summary: sampleRepo.summary,
        rationale: sampleRepo.rationale,
        language: sampleRepo.language,
        stars: sampleRepo.stars,
        updatedAt: sampleRepo.updatedAt,
        ownerAvatarUrl: sampleRepo.ownerAvatarUrl,
        socialPreviewImageUrl: sampleRepo.socialPreviewImageUrl,
        tags: ["typescript", "trending"]
      }
    ]
  });

  assert.equal(feed.date, "2026-03-27");
  assert.equal(feed.cards.length, 1);
  assert.equal(feed.cards[0].title, "alice/awesome-repo");
  assert.equal(feed.cards[0].imageUrl, sampleRepo.socialPreviewImageUrl);
  assert.match(feed.cards[0].subtitle, /TypeScript/);
});

test("buildOperatorReportMarkdown 生成人可直接使用的每日总览", () => {
  const markdown = buildOperatorReportMarkdown({
    date: "2026-03-27",
    total: 1,
    items: [
      {
        fullName: "alice/awesome-repo",
        summary: sampleRepo.summary,
        rationale: sampleRepo.rationale,
        stars: sampleRepo.stars,
        language: sampleRepo.language
      }
    ]
  }, {
    websiteDataPath: "web/public/data/repos.daily.json",
    rssPath: "web/public/rss.xml",
    wechatPath: "outputs/wechat/daily-2026-03-27.md",
    videoPath: "outputs/video/daily-2026-03-27.md",
    miniappPath: "outputs/miniapp/daily-2026-03-27.json"
  });

  assert.match(markdown, /每日总览/);
  assert.match(markdown, /web\/public\/data\/repos\.daily\.json/);
  assert.match(markdown, /web\/public\/rss\.xml/);
  assert.match(markdown, /outputs\/wechat/);
  assert.match(markdown, /alice\/awesome-repo/);
});

test("buildRssXml 生成可订阅的 RSS 输出", () => {
  const xml = buildRssXml({
    siteTitle: "GitHub Hunt",
    siteUrl: "https://example.com/github-hunt",
    date: "2026-03-27",
    items: [
      {
        fullName: "alice/awesome-repo",
        url: "https://github.com/alice/awesome-repo",
        summary: sampleRepo.summary,
        rationale: sampleRepo.rationale,
        updatedAt: sampleRepo.updatedAt
      }
    ]
  });

  assert.match(xml, /<rss/);
  assert.match(xml, /alice\/awesome-repo/);
  assert.match(xml, /GitHub Hunt/);
});
