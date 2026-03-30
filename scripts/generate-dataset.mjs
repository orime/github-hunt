import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildArchiveIndex,
  buildDailyBundle,
  buildMiniAppFeed,
  buildOperatorReportMarkdown,
  buildPublicArtifacts,
  buildRssXml,
  buildVideoScriptMarkdown,
  buildWechatArticleMarkdown
} from "./lib/daily-output.mjs";
import { generateRepoImages, getImageGenerationConfig } from "./lib/image-content.mjs";
import { generateLlmChannelDrafts, getLlmConfig } from "./lib/llm-content.mjs";
import { mapRepo } from "./lib/normalize.mjs";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const OUTPUT_PATH = resolve(process.cwd(), process.env.OUTPUT_PATH || "data/projects.json");
const WEB_OUTPUT_PATH = resolve(process.cwd(), "web/public/data/repos.daily.json");
const WEB_ARCHIVE_DIR = resolve(process.cwd(), "web/public/data/archive");
const WEB_ARCHIVE_INDEX_PATH = resolve(process.cwd(), "web/public/data/archive/index.json");
const WEB_RSS_PATH = resolve(process.cwd(), "web/public/rss.xml");
const WEB_OUTPUTS_DIR = resolve(process.cwd(), "web/public/outputs");
const WEB_OUTPUTS_INDEX_PATH = resolve(process.cwd(), "web/public/outputs/index.json");
const MAX_ITEMS = Number(process.env.MAX_ITEMS || 30);
const SITE_URL = process.env.SITE_URL || "https://example.com/github-hunt";

async function readArchiveBundles() {
  const entries = await readdir(WEB_ARCHIVE_DIR, { withFileTypes: true }).catch(() => []);
  const bundles = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".json") || entry.name === "index.json") continue;

    const filePath = resolve(WEB_ARCHIVE_DIR, entry.name);

    try {
      const raw = JSON.parse(await readFile(filePath, "utf8"));
      if (!raw?.date || !Array.isArray(raw?.items)) continue;

      bundles.push({
        ...raw,
        outputs: raw.outputs ?? buildPublicArtifacts(raw.date)
      });
    } catch (error) {
      console.warn(`读取历史归档失败，已跳过 ${filePath}: ${error.message}`);
    }
  }

  return bundles;
}

async function syncHistoricalPublicOutputs() {
  const syncPairs = [
    {
      sourceDir: resolve(process.cwd(), "outputs/wechat"),
      publicDir: resolve(WEB_OUTPUTS_DIR, "wechat"),
      rename: (fileName) => fileName
    },
    {
      sourceDir: resolve(process.cwd(), "outputs/video"),
      publicDir: resolve(WEB_OUTPUTS_DIR, "video"),
      rename: (fileName) => fileName
    },
    {
      sourceDir: resolve(process.cwd(), "outputs/miniapp"),
      publicDir: resolve(WEB_OUTPUTS_DIR, "miniapp"),
      rename: (fileName) => fileName
    },
    {
      sourceDir: resolve(process.cwd(), "outputs/images"),
      publicDir: resolve(WEB_OUTPUTS_DIR, "images"),
      rename: (fileName) => fileName
    }
  ];

  for (const pair of syncPairs) {
    const entries = await readdir(pair.sourceDir, { withFileTypes: true }).catch(() => []);
    await mkdir(pair.publicDir, { recursive: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const sourceFilePath = resolve(pair.sourceDir, entry.name);
      const publicFilePath = resolve(pair.publicDir, pair.rename(entry.name));
      await copyFile(sourceFilePath, publicFilePath);
    }
  }

  const reportSourceFiles = await readdir(resolve(process.cwd(), "outputs"), { withFileTypes: true }).catch(() => []);
  const publicReportsDir = resolve(WEB_OUTPUTS_DIR, "reports");
  await mkdir(publicReportsDir, { recursive: true });

  for (const entry of reportSourceFiles) {
    if (!entry.isFile()) continue;
    const match = /^daily-(\d{4}-\d{2}-\d{2})-report\.md$/.exec(entry.name);
    if (!match) continue;

    const sourceFilePath = resolve(process.cwd(), "outputs", entry.name);
    const publicFilePath = resolve(publicReportsDir, `daily-${match[1]}.md`);
    await copyFile(sourceFilePath, publicFilePath);
  }
}

async function ensureHistoricalImageArtifacts(archiveBundles) {
  const imageDir = resolve(process.cwd(), "outputs/images");
  const publicImageDir = resolve(WEB_OUTPUTS_DIR, "images");
  const existingFiles = new Set(await readdir(imageDir).catch(() => []));

  await mkdir(imageDir, { recursive: true });
  await mkdir(publicImageDir, { recursive: true });

  for (const bundle of archiveBundles) {
    const fileName = `daily-${bundle.date}.json`;
    const sourcePath = resolve(imageDir, fileName);
    const publicPath = resolve(publicImageDir, fileName);

    if (!existingFiles.has(fileName)) {
      const placeholder = {
        generatedAt: bundle.generatedAt,
        date: bundle.date,
        model: null,
        enabled: false,
        items: []
      };

      await writeFile(sourcePath, `${JSON.stringify(placeholder, null, 2)}\n`, "utf8");
    }

    await copyFile(sourcePath, publicPath);
  }
}

function headers() {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-hunt-local-script"
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function githubSearch({ q, sort, order = "desc", perPage = 30 }) {
  const params = new URLSearchParams({
    q,
    sort,
    order,
    per_page: String(perPage)
  });
  const url = `${GITHUB_API_BASE}/search/repositories?${params.toString()}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API 请求失败: ${res.status} ${res.statusText} - ${body}`);
  }

  const json = await res.json();
  return Array.isArray(json.items) ? json.items : [];
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function dedupeRepos(items) {
  const map = new Map();
  for (const repo of items) {
    const key = repo?.full_name;
    if (!key) continue;
    if (!map.has(key)) map.set(key, repo);
  }
  return Array.from(map.values());
}

async function run() {
  const queries = [
    {
      q: `archived:false stars:>800 pushed:>=${daysAgoISO(7)}`,
      sort: "updated",
      order: "desc",
      perPage: 50
    },
    {
      q: `archived:false stars:>3000 created:>=${daysAgoISO(30)}`,
      sort: "stars",
      order: "desc",
      perPage: 50
    }
  ];

  const allResults = [];
  for (const query of queries) {
    const repos = await githubSearch(query);
    allResults.push(...repos);
  }

  const uniqueRepos = dedupeRepos(allResults)
    .sort((a, b) => {
      const aStars = Number(a?.stargazers_count) || 0;
      const bStars = Number(b?.stargazers_count) || 0;
      return bStars - aStars;
    })
    .slice(0, MAX_ITEMS);

  const generatedAt = new Date().toISOString();
  const repos = uniqueRepos.map(mapRepo);
  const payload = buildDailyBundle({
    repos,
    generatedAt,
    source: "github-search-api",
    timezone: "Asia/Shanghai"
  });

  let wechatMarkdown = buildWechatArticleMarkdown(payload);
  let videoMarkdown = buildVideoScriptMarkdown(payload);
  const miniappFeed = buildMiniAppFeed(payload);
  const datedName = payload.date;
  const outputs = buildPublicArtifacts(datedName);
  const publicBundle = {
    ...payload,
    outputs
  };
  const archiveJsonPath = resolve(WEB_ARCHIVE_DIR, `${datedName}.json`);
  const wechatPath = resolve(process.cwd(), `outputs/wechat/daily-${datedName}.md`);
  const videoPath = resolve(process.cwd(), `outputs/video/daily-${datedName}.md`);
  const miniappPath = resolve(process.cwd(), `outputs/miniapp/daily-${datedName}.json`);
  const operatorReportPath = resolve(process.cwd(), `outputs/daily-${datedName}-report.md`);
  const publicWechatPath = resolve(WEB_OUTPUTS_DIR, `wechat/daily-${datedName}.md`);
  const publicVideoPath = resolve(WEB_OUTPUTS_DIR, `video/daily-${datedName}.md`);
  const publicMiniappPath = resolve(WEB_OUTPUTS_DIR, `miniapp/daily-${datedName}.json`);
  const publicReportPath = resolve(WEB_OUTPUTS_DIR, `reports/daily-${datedName}.md`);
  const imagePath = resolve(process.cwd(), `outputs/images/daily-${datedName}.json`);
  const publicImagePath = resolve(WEB_OUTPUTS_DIR, `images/daily-${datedName}.json`);

  const llmConfig = getLlmConfig();
  if (llmConfig) {
    try {
      const llmDrafts = await generateLlmChannelDrafts({
        bundle: payload,
        config: llmConfig
      });
      wechatMarkdown = llmDrafts.wechatMarkdown;
      videoMarkdown = llmDrafts.videoMarkdown;
      console.log(`LLM 内容增强已启用: ${llmConfig.baseUrl} · ${llmConfig.model}`);
    } catch (error) {
      console.warn(`LLM 内容增强失败，已回退到 deterministic 草稿: ${error.message}`);
    }
  }

  let imageManifest = {
    generatedAt,
    date: datedName,
    model: null,
    enabled: false,
    items: []
  };
  const imageConfig = getImageGenerationConfig();

  if (imageConfig) {
    try {
      imageManifest = {
        ...await generateRepoImages({
          bundle: payload,
          config: imageConfig
        }),
        enabled: true
      };
      console.log(`图片生成已启用: ${imageConfig.model}`);
    } catch (error) {
      console.warn(`图片生成失败，已回退为空素材清单: ${error.message}`);
      imageManifest = {
        ...imageManifest,
        model: imageConfig.model,
        error: error.message
      };
    }
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await mkdir(dirname(WEB_OUTPUT_PATH), { recursive: true });
  await mkdir(dirname(archiveJsonPath), { recursive: true });
  await mkdir(dirname(WEB_ARCHIVE_INDEX_PATH), { recursive: true });
  await mkdir(dirname(publicWechatPath), { recursive: true });
  await mkdir(dirname(publicVideoPath), { recursive: true });
  await mkdir(dirname(publicMiniappPath), { recursive: true });
  await mkdir(dirname(publicReportPath), { recursive: true });
  await mkdir(dirname(publicImagePath), { recursive: true });
  await mkdir(dirname(WEB_OUTPUTS_INDEX_PATH), { recursive: true });
  await mkdir(dirname(wechatPath), { recursive: true });
  await mkdir(dirname(videoPath), { recursive: true });
  await mkdir(dirname(miniappPath), { recursive: true });
  await mkdir(dirname(operatorReportPath), { recursive: true });
  await mkdir(dirname(imagePath), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(publicBundle, null, 2)}\n`, "utf8");
  await writeFile(WEB_OUTPUT_PATH, `${JSON.stringify(publicBundle, null, 2)}\n`, "utf8");
  await writeFile(archiveJsonPath, `${JSON.stringify(publicBundle, null, 2)}\n`, "utf8");
  await writeFile(WEB_RSS_PATH, buildRssXml({
    siteTitle: "GitHub Hunt",
    siteUrl: SITE_URL,
    date: payload.date,
    items: payload.items
  }), "utf8");
  await writeFile(wechatPath, wechatMarkdown, "utf8");
  await writeFile(videoPath, videoMarkdown, "utf8");
  await writeFile(miniappPath, `${JSON.stringify(miniappFeed, null, 2)}\n`, "utf8");
  await writeFile(publicWechatPath, wechatMarkdown, "utf8");
  await writeFile(publicVideoPath, videoMarkdown, "utf8");
  await writeFile(publicMiniappPath, `${JSON.stringify(miniappFeed, null, 2)}\n`, "utf8");
  await writeFile(imagePath, `${JSON.stringify(imageManifest, null, 2)}\n`, "utf8");
  await writeFile(publicImagePath, `${JSON.stringify(imageManifest, null, 2)}\n`, "utf8");
  await writeFile(
    operatorReportPath,
    buildOperatorReportMarkdown(payload, {
      websiteDataPath: "web/public/data/repos.daily.json",
      rssPath: "web/public/rss.xml",
      wechatPath: `outputs/wechat/daily-${datedName}.md`,
      videoPath: `outputs/video/daily-${datedName}.md`,
      miniappPath: `outputs/miniapp/daily-${datedName}.json`
    }),
    "utf8"
  );
  await writeFile(
    publicReportPath,
    buildOperatorReportMarkdown(payload, {
      websiteDataPath: "/data/repos.daily.json",
      rssPath: "/rss.xml",
      wechatPath: `/outputs/wechat/daily-${datedName}.md`,
      videoPath: `/outputs/video/daily-${datedName}.md`,
      miniappPath: `/outputs/miniapp/daily-${datedName}.json`
    }),
    "utf8"
  );

  await syncHistoricalPublicOutputs();

  const archiveBundles = await readArchiveBundles();
  await ensureHistoricalImageArtifacts(archiveBundles);
  const archiveIndex = buildArchiveIndex(archiveBundles, generatedAt);
  const outputsIndex = {
    generatedAt,
    latest: {
      date: datedName,
      outputs
    },
    total: archiveIndex.total,
    entries: archiveIndex.entries.map((entry) => ({
      date: entry.date,
      outputs: entry.outputs
    }))
  };

  await writeFile(WEB_ARCHIVE_INDEX_PATH, `${JSON.stringify(archiveIndex, null, 2)}\n`, "utf8");
  await writeFile(WEB_OUTPUTS_INDEX_PATH, `${JSON.stringify(outputsIndex, null, 2)}\n`, "utf8");

  console.log(`数据已生成: ${OUTPUT_PATH}`);
  console.log(`网站数据已同步: ${WEB_OUTPUT_PATH}`);
  console.log(`历史归档: ${archiveJsonPath}`);
  console.log(`历史索引: ${WEB_ARCHIVE_INDEX_PATH}`);
  console.log(`RSS 订阅: ${WEB_RSS_PATH}`);
  console.log(`公众号草稿: ${wechatPath}`);
  console.log(`公众号公开稿: ${publicWechatPath}`);
  console.log(`视频脚本: ${videoPath}`);
  console.log(`视频公开稿: ${publicVideoPath}`);
  console.log(`小程序卡片: ${miniappPath}`);
  console.log(`小程序公开卡片: ${publicMiniappPath}`);
  console.log(`配图素材: ${imagePath}`);
  console.log(`配图公开索引: ${publicImagePath}`);
  console.log(`每日总览: ${operatorReportPath}`);
  console.log(`每日公开总览: ${publicReportPath}`);
  console.log(`公开产物索引: ${WEB_OUTPUTS_INDEX_PATH}`);
  console.log(`条目数量: ${payload.items.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
