import { useEffect, useMemo, useState } from 'react'
import { RepoItemCard } from './components/RepoItemCard'
import { loadDailyRepos } from './lib/loadDailyRepos'
import type { DailyReposResponse, RepoItem } from './types'

function App() {
  const [data, setData] = useState<DailyReposResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const result = await loadDailyRepos()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setError('本地数据加载失败，请检查 public/data/repos.daily.json')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const repos = useMemo<RepoItem[]>(() => data?.items ?? [], [data])

  return (
    <main className="page">
      <header className="page__header">
        <h1>GitHub 每日热库精选</h1>
        <p className="page__subtitle">每天刷新，网站、公众号、视频脚本、小程序卡片共用同一份日更数据底座。</p>
        <p className="page__meta">
          <span>数据日期：{data?.date ?? '-'}</span>
          <span>共 {data?.total ?? repos.length} 条</span>
          <span>源：{data?.source ?? '-'}</span>
        </p>
      </header>

      {loading && <section className="state-box">正在读取本地数据…</section>}

      {!loading && error && <section className="state-box state-box--error">{error}</section>}

      {!loading && !error && repos.length === 0 && (
        <section className="state-box">暂无数据，等待每日生成脚本写入 JSON。</section>
      )}

      {!loading && !error && repos.length > 0 && (
        <section className="repo-list" aria-label="仓库列表">
          {repos.map((repo) => (
            <RepoItemCard key={repo.id} repo={repo} />
          ))}
        </section>
      )}
    </main>
  )
}

export default App
