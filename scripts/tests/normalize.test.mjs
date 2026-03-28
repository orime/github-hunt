import test from "node:test";
import assert from "node:assert/strict";
import { buildDeterministicRationale, buildDeterministicSummary, mapRepo } from "../lib/normalize.mjs";

test("buildDeterministicSummary 在无描述时返回稳定中文摘要", () => {
  const summary = buildDeterministicSummary({
    description: "",
    language: "TypeScript",
    stars: 12345
  });

  assert.match(summary, /TypeScript/);
  assert.match(summary, /12,345/);
});

test("buildDeterministicRationale 返回可解释推荐理由", () => {
  const rationale = buildDeterministicRationale({
    stars: 60000,
    language: "Go",
    updatedAt: new Date().toISOString()
  });

  assert.match(rationale, /社区验证度高/);
  assert.match(rationale, /Go/);
});

test("mapRepo 生成前端所需基础字段", () => {
  const mapped = mapRepo({
    name: "awesome-repo",
    owner: { login: "alice" },
    html_url: "https://github.com/alice/awesome-repo",
    description: "  test repo  ",
    stargazers_count: 9527,
    language: "Rust",
    updated_at: "2026-03-27T00:00:00Z"
  });

  assert.equal(mapped.name, "awesome-repo");
  assert.equal(mapped.owner, "alice");
  assert.equal(mapped.url, "https://github.com/alice/awesome-repo");
  assert.equal(mapped.description, "test repo");
  assert.equal(mapped.stars, 9527);
  assert.equal(mapped.language, "Rust");
  assert.ok(mapped.summary.length > 0);
  assert.ok(mapped.rationale.length > 0);
});
