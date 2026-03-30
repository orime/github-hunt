import { useEffect, useMemo, useState } from 'react'
import {
  loadArchiveIndex,
  loadBundleByDate,
  loadDailyRepos,
  loadOutputContent,
  loadOutputsIndex,
} from './lib/loadDailyRepos'
import type {
  ArchiveIndexEntry,
  DailyReposResponse,
  ImageArtifactsOutput,
  MiniappOutput,
  OutputView,
  OutputsDayIndex,
  RepoItem,
} from './types'

type LoadStage = 'loading' | 'ready' | 'error'

interface AppDataState {
  stage: LoadStage
  fatalError: string | null
  warning: string | null
  archive: ArchiveIndexEntry[]
  outputsByDate: Map<string, OutputsDayIndex>
  bundle: DailyReposResponse | null
  selectedDate: string
  selectedRepoId: string
  selectedView: OutputView
}

interface OutputPreviewState {
  stage: LoadStage
  content: string
  sourcePath: string
  error: string | null
}

interface ViewOption {
  key: OutputView
  label: string
  description: string
}

const VIEW_OPTIONS: ViewOption[] = [
  { key: 'wechat', label: '公众号', description: '长文草稿（Markdown）' },
  { key: 'video', label: '视频脚本', description: '口播脚本（Markdown）' },
  { key: 'reports', label: '日报总览', description: '执行报告（Markdown）' },
  { key: 'miniapp', label: '小程序卡片', description: '卡片流（JSON）' },
  { key: 'images', label: '配图', description: '生成图片元数据（JSON）' },
]

const DEFAULT_VIEW: OutputView = 'reports'

function formatStarCount(stars: number): string {
  return new Intl.NumberFormat('zh-CN').format(stars)
}

function formatRepoCount(total: number): string {
  return new Intl.NumberFormat('zh-CN').format(total)
}

function formatDate(value: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

function formatDateTime(value: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFallbackOutputPath(date: string, view: OutputView): string {
  if (view === 'miniapp') {
    return `outputs/miniapp/daily-${date}.json`
  }

  if (view === 'images') {
    return `outputs/images/daily-${date}.json`
  }

  if (view === 'reports') {
    return `outputs/reports/daily-${date}.md`
  }

  return `outputs/${view}/daily-${date}.md`
}

function pickRepoOutputPath(repo: RepoItem, view: OutputView): string | null {
  if (!repo.outputs) {
    return null
  }

  if (view === 'reports') {
    return repo.outputs.reports ?? repo.outputs.report ?? null
  }

  return repo.outputs[view] ?? null
}

function pickDayOutputPath(day: OutputsDayIndex | null, view: OutputView): string | null {
  if (!day) {
    return null
  }

  if (view === 'reports') {
    return day.reports ?? day.report ?? null
  }

  return day[view] ?? null
}

function parseMiniappOutput(content: string): MiniappOutput | null {
  try {
    const data = JSON.parse(content) as MiniappOutput
    if (!Array.isArray(data.cards)) {
      return null
    }
    return data
  } catch {
    return null
  }
}

function parseImageArtifactsOutput(content: string): ImageArtifactsOutput | null {
  try {
    const data = JSON.parse(content) as ImageArtifactsOutput
    if (!Array.isArray(data.items)) {
      return null
    }
    return data
  } catch {
    return null
  }
}

function buildInitialState(): AppDataState {
  return {
    stage: 'loading',
    fatalError: null,
    warning: null,
    archive: [],
    outputsByDate: new Map<string, OutputsDayIndex>(),
    bundle: null,
    selectedDate: '',
    selectedRepoId: '',
    selectedView: DEFAULT_VIEW,
  }
}

function App() {
  const [state, setState] = useState<AppDataState>(buildInitialState)
  const [outputState, setOutputState] = useState<OutputPreviewState>({
    stage: 'loading',
    content: '',
    sourcePath: '',
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const [archiveResult, outputsResult] = await Promise.allSettled([loadArchiveIndex(), loadOutputsIndex()])

        let archive: ArchiveIndexEntry[] = []
        let warning: string | null = null

        if (archiveResult.status === 'fulfilled' && archiveResult.value.length > 0) {
          archive = archiveResult.value
        } else {
          const today = await loadDailyRepos()
          archive = [{ date: today.date, total: today.total }]
          warning = '未找到归档索引，已回退到当日数据。请确认 data/archive/index.json 是否生成。'
        }

        let outputsByDate = new Map<string, OutputsDayIndex>()
        if (outputsResult.status === 'fulfilled') {
          outputsByDate = outputsResult.value
        } else {
          warning = warning
            ? `${warning} 未找到 outputs 索引，输出预览将使用默认路径。`
            : '未找到 outputs 索引，输出预览将使用默认路径。'
        }

        const selectedDate = archive[0]?.date ?? ''
        if (!selectedDate) {
          throw new Error('归档日期为空，请检查数据产物')
        }

        let bundle: DailyReposResponse
        try {
          const entry = archive.find((item) => item.date === selectedDate) ?? { date: selectedDate }
          bundle = await loadBundleByDate(entry)
        } catch {
          bundle = await loadDailyRepos()
        }

        if (cancelled) {
          return
        }

        setState({
          stage: 'ready',
          fatalError: null,
          warning,
          archive,
          outputsByDate,
          bundle,
          selectedDate: bundle.date,
          selectedRepoId: bundle.items[0]?.id ?? '',
          selectedView: DEFAULT_VIEW,
        })
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '前端工作台初始化失败'
          setState((prev) => ({ ...prev, stage: 'error', fatalError: message }))
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const repos = useMemo<RepoItem[]>(() => state.bundle?.items ?? [], [state.bundle])

  const selectedRepo = useMemo<RepoItem | null>(() => {
    if (repos.length === 0) {
      return null
    }

    const hit = repos.find((repo) => repo.id === state.selectedRepoId)
    return hit ?? repos[0]
  }, [repos, state.selectedRepoId])

  useEffect(() => {
    if (state.stage !== 'ready') {
      return
    }

    if (repos.length === 0) {
      return
    }

    const hasSelected = repos.some((repo) => repo.id === state.selectedRepoId)
    if (!hasSelected) {
      setState((prev) => ({ ...prev, selectedRepoId: repos[0].id }))
    }
  }, [repos, state.selectedRepoId, state.stage])

  async function switchDate(nextDate: string) {
    if (state.stage !== 'ready' || nextDate === state.selectedDate) {
      return
    }

    setState((prev) => ({ ...prev, stage: 'loading', fatalError: null }))

    try {
      const entry = state.archive.find((item) => item.date === nextDate) ?? { date: nextDate }
      const bundle = await loadBundleByDate(entry)
      setState((prev) => ({
        ...prev,
        stage: 'ready',
        bundle,
        selectedDate: bundle.date,
        selectedRepoId: bundle.items[0]?.id ?? '',
        fatalError: null,
      }))
    } catch {
      setState((prev) => ({
        ...prev,
        stage: 'ready',
        fatalError: `日期 ${nextDate} 的归档加载失败，请检查 data/archive/${nextDate}.json`,
      }))
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (state.stage !== 'ready' || !state.selectedDate || !selectedRepo) {
        return
      }

      const dayOutput = state.outputsByDate.get(state.selectedDate) ?? null
      const sourcePath =
        pickRepoOutputPath(selectedRepo, state.selectedView) ??
        pickDayOutputPath(dayOutput, state.selectedView) ??
        getFallbackOutputPath(state.selectedDate, state.selectedView)

      setOutputState({
        stage: 'loading',
        content: '',
        sourcePath,
        error: null,
      })

      try {
        const content = await loadOutputContent(sourcePath)
        if (cancelled) {
          return
        }

        setOutputState({
          stage: 'ready',
          content,
          sourcePath,
          error: null,
        })
      } catch {
        if (cancelled) {
          return
        }

        setOutputState({
          stage: 'error',
          content: '',
          sourcePath,
          error: `未找到 ${sourcePath}，请确认输出文件已生成。`,
        })
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [selectedRepo, state.outputsByDate, state.selectedDate, state.selectedView, state.stage])

  const miniappParsed = useMemo(() => {
    if (state.selectedView !== 'miniapp' || outputState.stage !== 'ready') {
      return null
    }

    return parseMiniappOutput(outputState.content)
  }, [outputState.content, outputState.stage, state.selectedView])

  const miniappSelectedCard = useMemo(() => {
    if (!miniappParsed || !selectedRepo) {
      return null
    }

    return miniappParsed.cards.find((card) => card.id === selectedRepo.id) ?? null
  }, [miniappParsed, selectedRepo])

  const imageArtifactsParsed = useMemo(() => {
    if (state.selectedView !== 'images' || outputState.stage !== 'ready') {
      return null
    }

    return parseImageArtifactsOutput(outputState.content)
  }, [outputState.content, outputState.stage, state.selectedView])

  const imageArtifactByRepo = useMemo(() => {
    if (!imageArtifactsParsed || !selectedRepo) {
      return null
    }

    return imageArtifactsParsed.items.find((item) => item.repoId === selectedRepo.id) ?? null
  }, [imageArtifactsParsed, selectedRepo])

  return (
    <main className="workbench">
      <header className="workbench__header">
        <div>
          <h1>GitHub Hunt 公共工作台</h1>
          <p className="workbench__subtitle">
            统一浏览日更归档，按仓库切换公众号/视频/日报/小程序/配图输出，直接在页面内预览。
          </p>
        </div>
        <div className="workbench__stats" aria-label="工作台元信息">
          <span>日期：{state.bundle?.date ?? '-'}</span>
          <span>仓库：{formatRepoCount(state.bundle?.total ?? repos.length)}</span>
          <span>源：{state.bundle?.source ?? '-'}</span>
        </div>
      </header>

      {state.warning && <section className="state-box">{state.warning}</section>}
      {state.fatalError && <section className="state-box state-box--error">{state.fatalError}</section>}

      {state.stage === 'error' && (
        <section className="state-box state-box--error">初始化失败，无法进入工作台。</section>
      )}

      {state.stage !== 'error' && (
        <section className="workbench__grid">
          <aside className="panel panel--dates" aria-label="日期归档">
            <div className="panel__title-row">
              <h2>日期历史</h2>
              <span>{state.archive.length} 天</span>
            </div>
            <div className="date-list" role="listbox" aria-label="选择日期">
              {state.archive.map((entry) => {
                const active = entry.date === state.selectedDate
                return (
                  <button
                    key={entry.date}
                    type="button"
                    className={active ? 'date-item date-item--active' : 'date-item'}
                    onClick={() => {
                      void switchDate(entry.date)
                    }}
                    aria-selected={active}
                    disabled={state.stage === 'loading'}
                  >
                    <span>{formatDate(entry.date)}</span>
                    <small>{entry.date}</small>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="panel panel--repos" aria-label="仓库选择">
            <div className="panel__title-row">
              <h2>仓库列表</h2>
              <span>{repos.length} 项</span>
            </div>
            {state.stage === 'loading' && <div className="state-box">正在加载选中日期数据…</div>}
            {state.stage === 'ready' && repos.length === 0 && <div className="state-box">该日期暂无仓库数据。</div>}
            {state.stage === 'ready' && repos.length > 0 && (
              <div className="repo-list" role="listbox" aria-label="选择仓库">
                {repos.map((repo) => {
                  const active = repo.id === selectedRepo?.id
                  return (
                    <button
                      key={repo.id}
                      type="button"
                      className={active ? 'repo-row repo-row--active' : 'repo-row'}
                      onClick={() => {
                        setState((prev) => ({ ...prev, selectedRepoId: repo.id }))
                      }}
                      aria-selected={active}
                    >
                      <div className="repo-row__top">
                        <strong>{repo.fullName}</strong>
                        <span>★ {formatStarCount(repo.stars)}</span>
                      </div>
                      <p>{repo.summary}</p>
                      <div className="repo-row__meta">
                        <span>{repo.language}</span>
                        <time dateTime={repo.updatedAt}>{formatDateTime(repo.updatedAt)}</time>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel panel--preview" aria-label="输出预览">
            <div className="panel__title-row panel__title-row--stack">
              <h2>内联输出预览</h2>
              <small>{selectedRepo?.fullName ?? '未选择仓库'}</small>
            </div>

            <div className="view-tabs" role="tablist" aria-label="输出类型">
              {VIEW_OPTIONS.map((option) => {
                const active = option.key === state.selectedView
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={active ? 'view-tab view-tab--active' : 'view-tab'}
                    role="tab"
                    aria-selected={active}
                    title={option.description}
                    onClick={() => {
                      setState((prev) => ({ ...prev, selectedView: option.key }))
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <p className="preview-path">来源：{outputState.sourcePath || '待加载'}</p>

            {outputState.stage === 'loading' && <div className="state-box">正在读取输出文件…</div>}
            {outputState.stage === 'error' && outputState.error && (
              <div className="state-box state-box--error">{outputState.error}</div>
            )}

            {outputState.stage === 'ready' && state.selectedView !== 'miniapp' && state.selectedView !== 'images' && (
              <pre className="preview-markdown">{outputState.content}</pre>
            )}

            {outputState.stage === 'ready' && state.selectedView === 'miniapp' && (
              <div className="miniapp-preview">
                {miniappSelectedCard ? (
                  <article className="miniapp-card">
                    <h3>{miniappSelectedCard.title}</h3>
                    <p className="miniapp-card__subtitle">{miniappSelectedCard.subtitle}</p>
                    <p>{miniappSelectedCard.summary}</p>
                    <p>{miniappSelectedCard.reason}</p>
                    <a href={miniappSelectedCard.url} target="_blank" rel="noreferrer">
                      打开仓库
                    </a>
                  </article>
                ) : (
                  <div className="state-box">未在 miniapp 输出里找到当前仓库卡片，已展示原始 JSON。</div>
                )}
                <pre className="preview-markdown">{outputState.content}</pre>
              </div>
            )}

            {outputState.stage === 'ready' && state.selectedView === 'images' && (
              <div className="image-preview">
                {imageArtifactsParsed ? (
                  <>
                    {!imageArtifactsParsed.enabled && (
                      <div className="state-box">当前日期图片生成功能已关闭（enabled=false），以下为元数据原文。</div>
                    )}

                    {imageArtifactsParsed.enabled && imageArtifactByRepo && (
                      <article className="image-card">
                        <h3>{imageArtifactByRepo.fullName}</h3>
                        <p className="image-card__meta">taskId: {imageArtifactByRepo.taskId}</p>
                        <p>{imageArtifactByRepo.prompt}</p>
                        <img
                          className="image-card__preview"
                          src={imageArtifactByRepo.imageUrl}
                          alt={`${imageArtifactByRepo.fullName} 生成配图`}
                          loading="lazy"
                        />
                        <a href={imageArtifactByRepo.imageUrl} target="_blank" rel="noreferrer">
                          打开原图
                        </a>
                      </article>
                    )}

                    {imageArtifactsParsed.enabled && !imageArtifactByRepo && (
                      <div className="state-box">
                        当前仓库暂无配图结果。你可以切换仓库查看其他命中项，或确认图片生成功能是否开启。
                      </div>
                    )}
                  </>
                ) : (
                  <div className="state-box">图片元数据 JSON 格式不符合预期，已展示原始内容。</div>
                )}

                <pre className="preview-markdown">{outputState.content}</pre>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  )
}

export default App
