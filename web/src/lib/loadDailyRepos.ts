import type { DailyReposResponse } from '../types'

const DATA_URL = `${import.meta.env.BASE_URL}data/repos.daily.json`

export async function loadDailyRepos(): Promise<DailyReposResponse> {
  const response = await fetch(DATA_URL, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_URL}: ${response.status}`)
  }

  return (await response.json()) as DailyReposResponse
}
