import type {
  ArchiveIndexEntry,
  ArchiveIndexResponse,
  DailyReposResponse,
  OutputsDayIndex,
  OutputsIndexResponse,
} from '../types'

function withBase(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${base}${normalizedPath}`
}

async function loadJson<T>(path: string): Promise<T> {
  const url = withBase(path)
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }

  return (await response.json()) as T
}

function sortDatesDesc(dates: string[]): string[] {
  return [...dates].sort((left, right) => right.localeCompare(left))
}

function normalizeOutputPath(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'path' in value && typeof value.path === 'string') {
    return value.path
  }

  return undefined
}

function flattenOutputs(item: OutputsDayIndex): OutputsDayIndex {
  if (!item.outputs) {
    return item
  }

  return {
    ...item,
    wechat: normalizeOutputPath(item.outputs.wechat),
    video: normalizeOutputPath(item.outputs.video),
    report: normalizeOutputPath(item.outputs.report),
    reports: normalizeOutputPath(item.outputs.reports ?? item.outputs.report),
    miniapp: normalizeOutputPath(item.outputs.miniapp),
    images: normalizeOutputPath(item.outputs.images),
  }
}

function pickBundlePath(entry: ArchiveIndexEntry): string {
  return entry.bundlePath ?? entry.path ?? entry.bundle ?? entry.href ?? `data/archive/${entry.date}.json`
}

export async function loadDailyRepos(): Promise<DailyReposResponse> {
  return loadJson<DailyReposResponse>('data/repos.daily.json')
}

export async function loadArchiveIndex(): Promise<ArchiveIndexEntry[]> {
  const payload = await loadJson<ArchiveIndexResponse>('data/archive/index.json')

  if (Array.isArray(payload.entries) && payload.entries.length > 0) {
    return sortDatesDesc(payload.entries.map((entry) => entry.date)).map((date) => {
      const hit = payload.entries?.find((entry) => entry.date === date)
      return hit ?? { date }
    })
  }

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    return sortDatesDesc(payload.items.map((item) => item.date)).map((date) => {
      const hit = payload.items?.find((item) => item.date === date)
      return hit ?? { date }
    })
  }

  if (Array.isArray(payload.dates) && payload.dates.length > 0) {
    return sortDatesDesc(payload.dates).map((date) => ({ date }))
  }

  if (payload.latestDate) {
    return [{ date: payload.latestDate }]
  }

  return []
}

export async function loadBundleByDate(entry: ArchiveIndexEntry): Promise<DailyReposResponse> {
  return loadJson<DailyReposResponse>(pickBundlePath(entry))
}

export async function loadOutputsIndex(): Promise<Map<string, OutputsDayIndex>> {
  const payload = await loadJson<OutputsIndexResponse>('outputs/index.json')
  const map = new Map<string, OutputsDayIndex>()

  if (payload.byDate) {
    Object.entries(payload.byDate).forEach(([date, item]) => {
      map.set(date, { ...item, date })
    })
  }

  if (Array.isArray(payload.items)) {
    payload.items.forEach((item) => {
      map.set(item.date, flattenOutputs(item))
    })
  }

  if (Array.isArray(payload.entries)) {
    payload.entries.forEach((item) => {
      map.set(item.date, flattenOutputs(item))
    })
  }

  return map
}

export async function loadOutputContent(path: string): Promise<string> {
  const url = withBase(path)
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }

  return response.text()
}
