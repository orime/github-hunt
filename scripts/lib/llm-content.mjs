function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, "");
}

export function getLlmConfig(env = process.env) {
  const baseUrl = env.OPENAI_BASE_URL || env.AGENT_BASE_URL || env.LLM_BASE_URL || "";
  const apiKey = env.OPENAI_API_KEY || env.API_KEY || env.LLM_API_KEY || "";
  const model = env.OPENAI_MODEL || env.OPENAI_MODEL_ID || env.MODEL_ID || env.LLM_MODEL || "";

  if (!baseUrl || !apiKey || !model) return null;

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    model
  };
}

function buildPrompt(bundle) {
  const repoLines = bundle.items.slice(0, 8).map((item, index) => [
    `${index + 1}. ${item.fullName}`,
    `语言：${item.language}`,
    `Stars：${item.stars}`,
    `摘要：${item.summary}`,
    `推荐理由：${item.rationale}`,
    `链接：${item.url}`
  ].join(" | "));

  return [
    `你在为 GitHub Hunt 生成 ${bundle.date} 的内容草稿。`,
    "请只返回 JSON，不要返回 Markdown 代码块，不要解释。",
    'JSON 结构必须是 {"wechat_markdown":"...","video_markdown":"..."}。',
    "wechat_markdown 要写成一篇可直接二次编辑的中文公众号草稿，保留标题、导语、项目小节和结尾 CTA。",
    "video_markdown 要写成一份 60-90 秒的中文短视频口播稿，包含开场 Hook、每个项目的 1-2 句讲法和结尾 CTA。",
    "只使用下面给你的项目，不要臆造新的项目。",
    "",
    ...repoLines
  ].join("\n");
}

function extractJson(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(trimmed);
}

export async function generateLlmChannelDrafts({ bundle, config, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "你是一个严谨的中文技术编辑，只输出合法 JSON。"
        },
        {
          role: "user",
          content: buildPrompt(bundle)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM 请求失败: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 未返回可解析内容");
  }

  const parsed = extractJson(content);
  if (!parsed.wechat_markdown || !parsed.video_markdown) {
    throw new Error("LLM 返回缺少草稿字段");
  }

  return {
    wechatMarkdown: parsed.wechat_markdown,
    videoMarkdown: parsed.video_markdown
  };
}
