import { useId, useRef, useState, type ChangeEvent } from "react";
import bundledReport from "../../../docs/frontend-modules.json";
import type { Report } from "./model/types";
import { parseReport } from "./model/parse-report";
import { buildGraph } from "./model/build-graph";
import { filterGraph } from "./model/filter-graph";
import { DependencyGraph } from "./components/dependency-graph";

export function App({
  initialReport = bundledReport,
}: {
  initialReport?: unknown;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [source, setSource] = useState("frontend-modules.json");
  const [error, setError] = useState("");
  const [selectorQuery, setSelectorQuery] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const loadId = useRef(0);
  const inputId = useId();
  const graph = buildGraph(report ?? parseReport(initialReport));
  const activeFeature = hovered ?? focused;
  const view = filterGraph(graph, selectorQuery, actionQuery, activeFeature);
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const id = ++loadId.current;
    try {
      const next = parseReport(JSON.parse(await file.text()));
      if (id !== loadId.current) return;
      setReport(next);
      setSource(file.name);
      setError("");
      setHovered(null);
      setFocused(null);
      setSelectorQuery("");
      setActionQuery("");
    } catch (failure) {
      if (id === loadId.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not read the JSON file.",
        );
    } finally {
      input.value = "";
    }
  }
  return (
    <main
      className="app"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHovered(null);
          setFocused(null);
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
    >
      <header className="app-header">
        <div className="heading-copy">
          <div className="eyebrow">
            <span className="brand-mark">
              <i />
              <i />
              <i />
            </span>
            <span>camera_path</span>
            <span className="eyebrow-divider">/</span>
            <span>architecture</span>
          </div>
          <h1>Module map</h1>
          <p>How features connect to state and actions</p>
        </div>
        <div className="header-actions">
          <span className="source-name" title={source}>
            {source}
          </span>
          <label htmlFor={inputId} className="file-button">
            Open JSON
            <input
              id={inputId}
              type="file"
              accept=".json,application/json"
              onChange={load}
            />
          </label>
        </div>
      </header>
      {error && (
        <p className="load-error" role="alert">
          {error} The current map has been kept.
        </p>
      )}
      <div className="graph-meta">
        <div className="legend">
          <span>
            <i className="selector-dot" />
            State reads
          </span>
          <span>
            <i className="action-dot" />
            Actions
          </span>
        </div>
        <p aria-live="polite">
          {activeFeature ? (
            <>
              Connections for{" "}
              <strong>
                {graph.features.find((f) => f.id === activeFeature)?.label}
              </strong>
            </>
          ) : (
            "Hover a feature to see its connections and slots"
          )}
        </p>
        <span className="direct-label">Direct dependencies</span>
      </div>
      <DependencyGraph
        graph={graph}
        view={view}
        activeFeature={activeFeature}
        selectorQuery={selectorQuery}
        actionQuery={actionQuery}
        onSelectorQuery={setSelectorQuery}
        onActionQuery={setActionQuery}
        onHover={setHovered}
        onFocusFeature={setFocused}
      />
      <footer className="app-footer">
        <span>
          {graph.selectors.length} selectors<span>·</span>
          {graph.features.length} features<span>·</span>
          {graph.actions.length} actions
        </span>
        <span>
          Tab — focus a feature <span>·</span> Esc — clear selection
        </span>
      </footer>
    </main>
  );
}
