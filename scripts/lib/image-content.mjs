function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTaskId(payload) {
  return payload?.task_id || payload?.data?.task_id || payload?.output?.task_id || payload?.id || "";
}

function extractImageUrl(payload) {
  const candidates = [
    payload?.output?.images,
    payload?.output_images,
    payload?.images,
    payload?.data?.images,
    payload?.result?.images,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const first = candidate[0];
    if (typeof first === "string") return first;
    if (first && typeof first.url === "string") return first.url;
  }

  return "";
}

function isTaskSucceeded(payload) {
  return [payload?.task_status, payload?.status, payload?.data?.status].includes("SUCCEEDED");
}

function isTaskFailed(payload) {
  return [payload?.task_status, payload?.status, payload?.data?.status].includes("FAILED");
}

export function getImageGenerationConfig(env = process.env) {
  const apiKey = env.K || "";
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: "https://api-inference.modelscope.cn/v1",
    model: "Tongyi-MAI/Z-Image-Turbo",
    pollIntervalMs: 2000,
    maxPollAttempts: 15,
  };
}

export function buildImagePrompt(repo, bundleDate) {
  return [
    `为 GitHub Hunt ${bundleDate} 的仓库生成一张横版配图。`,
    `仓库：${repo.fullName}`,
    `技术栈：${repo.language}`,
    `摘要：${repo.summary}`,
    `推荐理由：${repo.rationale}`,
    "要求：科技感、适合中文技术内容封面、不要出现水印、不要出现真人照片、保留强对比与清晰标题区。"
  ].join("\n");
}

async function createImageTask({ prompt, config, fetchImpl }) {
  const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-ModelScope-Async-Mode": "true"
    },
    body: JSON.stringify({
      model: config.model,
      prompt
    })
  });

  if (!response.ok) {
    throw new Error(`图片生成任务创建失败: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const taskId = extractTaskId(payload);
  if (!taskId) {
    throw new Error("图片生成接口未返回 task_id");
  }

  return taskId;
}

async function pollImageTask({ taskId, config, fetchImpl }) {
  for (let attempt = 0; attempt < config.maxPollAttempts; attempt += 1) {
    const response = await fetchImpl(`${normalizeBaseUrl(config.baseUrl)}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-ModelScope-Task-Type": "image_generation"
      }
    });

    if (!response.ok) {
      throw new Error(`图片任务轮询失败: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (isTaskSucceeded(payload)) {
      const imageUrl = extractImageUrl(payload);
      if (!imageUrl) {
        throw new Error("图片任务已成功，但未返回图片 URL");
      }

      return imageUrl;
    }

    if (isTaskFailed(payload)) {
      throw new Error(`图片任务失败: ${JSON.stringify(payload)}`);
    }

    if (attempt < config.maxPollAttempts - 1) {
      await sleep(config.pollIntervalMs);
    }
  }

  throw new Error(`图片任务轮询超时: ${taskId}`);
}

export async function generateRepoImages({ bundle, config, fetchImpl = fetch, limit = 6 }) {
  const items = [];
  const targetRepos = bundle.items.slice(0, limit);

  for (const repo of targetRepos) {
    const prompt = buildImagePrompt(repo, bundle.date);
    const taskId = await createImageTask({ prompt, config, fetchImpl });
    const imageUrl = await pollImageTask({ taskId, config, fetchImpl });

    items.push({
      repoId: repo.id,
      fullName: repo.fullName,
      taskId,
      prompt,
      imageUrl,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    date: bundle.date,
    model: config.model,
    items,
  };
}
