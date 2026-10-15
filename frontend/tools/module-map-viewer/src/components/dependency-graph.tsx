import { useId, useRef } from "react";
import type { Graph, GraphView } from "../model/types";
import { useConnectionPaths } from "../hooks/use-connection-paths";
import { DependencyCard } from "./dependency-card";
import { FeatureCard } from "./feature-card";
import { GraphLane } from "./graph-lane";

interface Props {
  graph: Graph;
  view: GraphView;
  activeFeature: string | null;
  selectorQuery: string;
  actionQuery: string;
  onSelectorQuery: (value: string) => void;
  onActionQuery: (value: string) => void;
  onHover: (id: string | null) => void;
  onFocusFeature: (id: string | null) => void;
}
export function DependencyGraph({
  graph,
  view,
  activeFeature,
  selectorQuery,
  actionQuery,
  onSelectorQuery,
  onActionQuery,
  onHover,
  onFocusFeature,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const paths = useConnectionPaths(container, view.links);
  const prefix = useId().replaceAll(":", "");
  return (
    <div className="graph-scroll">
      <div
        ref={container}
        className={`graph-shell${activeFeature ? " has-active-feature" : ""}`}
      >
        <svg className="graph-edges" aria-hidden="true">
          <defs>
            {(["selector", "action"] as const).map((kind) => (
              <marker
                id={`${prefix}-${kind}`}
                key={kind}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path
                  d="M0 0 8 4 0 8z"
                  fill={kind === "selector" ? "#52c9b5" : "#dfae69"}
                />
              </marker>
            ))}
          </defs>
          {paths.map((link) => (
            <path
              key={link.id}
              d={link.path}
              className={`graph-edge ${link.kind}-edge`}
              markerEnd={`url(#${prefix}-${link.kind})`}
              data-feature-id={link.featureId}
            />
          ))}
        </svg>
        <GraphLane
          title="Селекторы Zustand"
          kind="selector"
          count={view.selectors.length}
          total={graph.selectors.length}
          query={selectorQuery}
          onSearch={onSelectorQuery}
        >
          {view.selectors.map((node) => (
            <DependencyCard node={node} kind="selector" key={node.id} />
          ))}
          {!view.selectors.length && (
            <p className="lane-empty">
              {selectorQuery
                ? "Селекторы не найдены"
                : "У этой фичи нет селекторов Zustand"}
            </p>
          )}
        </GraphLane>
        <GraphLane
          title="Фичи"
          kind="feature"
          count={graph.features.length}
          total={graph.features.length}
        >
          {graph.features.map((feature) => (
            <FeatureCard
              feature={feature}
              key={feature.id}
              active={feature.id === activeFeature}
              dimmed={!!activeFeature && feature.id !== activeFeature}
              onHover={onHover}
              onFocusFeature={onFocusFeature}
            />
          ))}
          {!graph.features.length && (
            <p className="lane-empty">В отчёте нет фич</p>
          )}
        </GraphLane>
        <GraphLane
          title="Actions"
          kind="action"
          count={view.actions.length}
          total={graph.actions.length}
          query={actionQuery}
          onSearch={onActionQuery}
        >
          {view.actions.map((node) => (
            <DependencyCard node={node} kind="action" key={node.id} />
          ))}
          {!view.actions.length && (
            <p className="lane-empty">
              {actionQuery ? "Actions не найдены" : "У этой фичи нет actions"}
            </p>
          )}
        </GraphLane>
      </div>
    </div>
  );
}
