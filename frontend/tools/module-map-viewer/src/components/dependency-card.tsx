import type { DependencyNode } from "../model/types";

export function DependencyCard({
  node,
  kind,
}: {
  node: DependencyNode;
  kind: "selector" | "action";
}) {
  const split = node.label.lastIndexOf(".");
  const name = split < 0 ? node.label : node.label.slice(split + 1);
  const detail = node.statePaths.length
    ? node.statePaths.join(" · ")
    : split < 0
      ? "@camera-path/actions"
      : node.label.slice(0, split);
  return (
    <div
      className={`graph-node dependency-card ${kind}-card`}
      data-node-id={node.id}
      title={`${node.names.join(" / ")}\n${node.statePaths.join(", ")}\n${node.definition.file}:${node.definition.line}`}
    >
      <span
        className={`node-port ${kind === "selector" ? "port-right" : "port-left"}`}
      />
      <div className="dependency-copy">
        <code>{name}</code>
        <span>
          {kind === "selector" && !node.statePaths.length
            ? "@camera-path/store"
            : detail}
        </span>
      </div>
      <span
        className="usage-count"
        aria-label={`Used by features: ${node.featureIds.length}`}
      >
        {node.featureIds.length}
      </span>
    </div>
  );
}
