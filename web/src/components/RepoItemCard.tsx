import type { RepoItem } from '../types'

interface RepoItemCardProps {
  repo: RepoItem
}

function formatStarCount(stars: number): string {
  return new Intl.NumberFormat('zh-CN').format(stars)
}

export function RepoItemCard({ repo }: RepoItemCardProps) {
  return (
    <article className="repo-card">
      <div className="repo-card__head">
        <a className="repo-card__name" href={repo.url} target="_blank" rel="noreferrer">
          {repo.fullName}
        </a>
        <span className="repo-card__stars">★ {formatStarCount(repo.stars)}</span>
      </div>

      <p className="repo-card__summary">{repo.summary}</p>
      <p className="repo-card__rationale">{repo.rationale}</p>

      <div className="repo-card__meta">
        <span className="repo-card__chip">{repo.language}</span>
        <time className="repo-card__time" dateTime={repo.updatedAt}>
          更新于 {new Date(repo.updatedAt).toLocaleDateString('zh-CN')}
        </time>
      </div>

      {repo.tags.length > 0 && (
        <ul className="repo-card__tags" aria-label="标签">
          {repo.tags.map((tag) => (
            <li key={tag} className="repo-card__tag">
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
