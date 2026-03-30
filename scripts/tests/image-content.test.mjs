import test from "node:test";
import assert from "node:assert/strict";
import { generateRepoImages, getImageGenerationConfig } from "../lib/image-content.mjs";

test("getImageGenerationConfig 在缺少 K 时返回 null", () => {
  assert.equal(getImageGenerationConfig({}), null);
});

test("generateRepoImages 调用异步图片接口并返回图片元数据", async () => {
  const calls = [];

  const result = await generateRepoImages({
    bundle: {
      date: "2026-03-28",
      items: [
        {
          id: "alice/awesome-repo",
          fullName: "alice/awesome-repo",
          summary: "一个很实用的自动化工具（TypeScript，⭐ 9,527）",
          rationale: "TypeScript 生态值得关注，热度稳定上涨",
          language: "TypeScript",
          stars: 9527,
        }
      ]
    },
    config: {
      apiKey: "test-k",
      model: "Tongyi-MAI/Z-Image-Turbo",
      baseUrl: "https://api-inference.modelscope.cn/v1",
      pollIntervalMs: 0,
      maxPollAttempts: 2,
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });

      if (calls.length === 1) {
        assert.equal(url, "https://api-inference.modelscope.cn/v1/images/generations");
        assert.equal(options.method, "POST");
        assert.equal(options.headers.Authorization, "Bearer test-k");

        return {
          ok: true,
          async json() {
            return {
              task_id: "task-1"
            };
          }
        };
      }

      assert.equal(url, "https://api-inference.modelscope.cn/v1/tasks/task-1");
      assert.equal(options.headers["X-ModelScope-Task-Type"], "image_generation");

      return {
        ok: true,
        async json() {
          return {
            task_status: "SUCCEEDED",
            output: {
              images: [
                {
                  url: "https://cdn.example.com/task-1.png"
                }
              ]
            }
          };
        }
      };
    }
  });

  assert.equal(result.date, "2026-03-28");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].repoId, "alice/awesome-repo");
  assert.equal(result.items[0].imageUrl, "https://cdn.example.com/task-1.png");
  assert.match(result.items[0].prompt, /alice\/awesome-repo/);
});
