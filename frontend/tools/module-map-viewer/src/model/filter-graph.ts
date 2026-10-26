import type { Graph, GraphView } from "./types";

export function filterGraph(
  graph: Graph,
  selectorQuery: string,
  actionQuery: string,
  activeFeature: string | null,
): GraphView {
  const selected = graph.features.find((f) => f.id === activeFeature);
  const left = selectorQuery.trim().toLocaleLowerCase(),
    right = actionQuery.trim().toLocaleLowerCase();
  const selectors = graph.selectors.filter(
    (d) =>
      (!selected || selected.selectorIds.includes(d.id)) &&
      d.names.some((name) => name.toLocaleLowerCase().includes(left)),
  );
  const actions = graph.actions.filter(
    (d) =>
      (!selected || selected.actionIds.includes(d.id)) &&
      d.names.some((name) => name.toLocaleLowerCase().includes(right)),
  );
  const visible = new Set([
    ...selectors.map((d) => d.id),
    ...actions.map((d) => d.id),
    ...graph.features.map((f) => f.id),
  ]);
  return {
    selectors,
    actions,
    links: graph.links.filter(
      (link) =>
        (!selected || link.featureId === selected.id) &&
        visible.has(link.source) &&
        visible.has(link.target),
    ),
  };
}
