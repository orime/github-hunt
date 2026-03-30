export interface RepoItem {
  id: string
  name: string
  owner: string
  fullName: string
  url: string
  description: string
  summary: string
  rationale: string
  stars: number
  language: string
  tags: string[]
  updatedAt: string
  outputs?: RepoOutputsMap
}

export interface DailyReposResponse {
  generatedAt: string
  date: string
  timezone: string
  source: string
  total: number
   outputs?: RepoOutputsMap
  items: RepoItem[]
}

export type OutputView = 'wechat' | 'video' | 'reports' | 'miniapp' | 'images'

export interface RepoOutputsMap {
  wechat?: string
  video?: string
  report?: string
  reports?: string
  miniapp?: string
  images?: string
}

export interface ArchiveIndexEntry {
  date: string
  total?: number
  generatedAt?: string
  timezone?: string
  source?: string
   outputs?: RepoOutputsMap
  bundlePath?: string
  path?: string
  bundle?: string
  href?: string
}

export interface ArchiveIndexResponse {
  latestDate?: string
  dates?: string[]
  items?: ArchiveIndexEntry[]
   entries?: ArchiveIndexEntry[]
}

export interface OutputsDayIndex {
  date: string
  wechat?: string
  video?: string
  report?: string
  reports?: string
  miniapp?: string
  images?: string
  outputs?: RepoOutputsMap
}

export interface OutputsIndexResponse {
  latestDate?: string
  items?: OutputsDayIndex[]
  byDate?: Record<string, OutputsDayIndex>
  entries?: OutputsDayIndex[]
}

export interface MiniappCard {
  id: string
  title: string
  subtitle: string
  summary: string
  reason: string
  url: string
  imageUrl?: string
  tags: string[]
  updatedAt: string
}

export interface MiniappOutput {
  date: string
  cards: MiniappCard[]
}

export interface ImageArtifactItem {
  repoId: string
  fullName: string
  taskId: string
  prompt: string
  imageUrl: string
}

export interface ImageArtifactsOutput {
  generatedAt: string
  date: string
  model: string
  enabled: boolean
  items: ImageArtifactItem[]
}
