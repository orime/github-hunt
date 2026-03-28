function normalizeText(input) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export function toISODateTime(value) {
  if (!value) return new Date(0).toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export function buildDeterministicSummary(repo) {
  const description = normalizeText(repo.description);
  const language = normalizeText(repo.language) || "未知技术栈";
  const stars = Number(repo.stars) || 0;

  if (description) {
    return `${description}（${language}，⭐ ${stars.toLocaleString("en-US")}）`;
  }

  return `这是一个以 ${language} 为主的开源项目，当前 Star 约 ${stars.toLocaleString("en-US")}，近期可重点关注其活跃更新。`;
}

export function buildDeterministicRationale(repo) {
  const stars = Number(repo.stars) || 0;
  const language = normalizeText(repo.language) || "多技术栈";
  const updatedAt = toISODateTime(repo.updatedAt);
  const daysSinceUpdate = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000));

  const tags = [`${language} 生态值得关注`];
  if (stars >= 50000) tags.push("社区验证度高");
  else if (stars >= 10000) tags.push("热度稳定上涨");
  else if (daysSinceUpdate <= 7) tags.push("近 7 天仍在活跃更新");

  return tags.slice(0, 2).join("，");
}

export function mapRepo(raw) {
  const mapped = {
    name: raw?.name ?? "",
    owner: raw?.owner?.login ?? "",
    url: raw?.html_url ?? "",
    description: normalizeText(raw?.description),
    stars: Number(raw?.stargazers_count) || 0,
    language: normalizeText(raw?.language) || "",
    updatedAt: toISODateTime(raw?.updated_at)
  };

  mapped.summary = buildDeterministicSummary(mapped);
  mapped.rationale = buildDeterministicRationale(mapped);
  return mapped;
}
