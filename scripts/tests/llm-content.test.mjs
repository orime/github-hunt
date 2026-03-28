import test from "node:test";
import assert from "node:assert/strict";
import { generateLlmChannelDrafts, getLlmConfig } from "../lib/llm-content.mjs";

test("getLlmConfig 在缺少配置时返回 null", () => {
  const config = getLlmConfig({});
  assert.equal(config, null);
});

test("generateLlmChannelDrafts 调用 OpenAI 兼容接口并解析 JSON", async () => {
  const result = await generateLlmChannelDrafts({
    bundle: {
      date: "2026-03-27",
      items: [
        {
          fullName: "alice/awesome-repo",
          url: "https://github.com/alice/awesome-repo",
          summary: "一个很实用的自动化工具（TypeScript，⭐ 9,527）",
          rationale: "TypeScript 生态值得关注，热度稳定上涨",
          language: "TypeScript",
          stars: 9527
        }
      ]
    },
    config: {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "test-key",
      model: "gpt-5.4"
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://127.0.0.1:8317/v1/chat/completions");
      assert.equal(options.method, "POST");

      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    wechat_markdown: "# 公众号草稿\n\n## alice/awesome-repo",
                    video_markdown: "# 视频脚本\n\n## alice/awesome-repo"
                  })
                }
              }
            ]
          };
        }
      };
    }
  });

  assert.match(result.wechatMarkdown, /公众号草稿/);
  assert.match(result.videoMarkdown, /视频脚本/);
});
