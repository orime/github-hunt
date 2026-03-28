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
}

export interface DailyReposResponse {
  generatedAt: string
  date: string
  timezone: string
  source: string
  total: number
  items: RepoItem[]
}
