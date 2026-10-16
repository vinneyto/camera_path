import type { ReactNode } from "react";

interface Props {
  title: string;
  kind: "selector" | "feature" | "action";
  count: number;
  total: number;
  query?: string;
  onSearch?: (value: string) => void;
  children: ReactNode;
}
export function GraphLane({
  title,
  kind,
  count,
  total,
  query,
  onSearch,
  children,
}: Props) {
  return (
    <section className={`graph-lane ${kind}-lane`} aria-label={title}>
      <div className="lane-header">
        <div className="lane-title">
          <span className="lane-dot" />
          <h2>{title}</h2>
          <span className="lane-count">
            {count === total ? count : `${count} / ${total}`}
          </span>
        </div>
        {onSearch ? (
          <label className="search-field">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="search"
              aria-label={`Search: ${title}`}
              placeholder="Search by name…"
              value={query}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        ) : (
          <p className="lane-hint">Hover to highlight connections</p>
        )}
      </div>
      <div className="lane-body">{children}</div>
    </section>
  );
}
