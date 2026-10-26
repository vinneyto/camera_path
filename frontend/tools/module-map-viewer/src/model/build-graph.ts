import type {
  Dependency,
  DependencyNode,
  FeatureNode,
  Graph,
  Report,
} from "./types";

export function buildGraph(report: Report): Graph {
  const selectors = new Map<string, DependencyNode>(),
    actions = new Map<string, DependencyNode>();
  function collect(
    deps: Dependency[],
    map: Map<string, DependencyNode>,
    featureId: string,
    kind: string,
  ): string[] {
    const ids = new Set<string>();
    for (const dependency of deps) {
      const d = dependency.definition;
      const id = `${kind}:${JSON.stringify([dependency.package, dependency.kind, d.file, d.line, d.column])}`;
      const node = map.get(id) ?? {
        id,
        label: dependency.name,
        names: [],
        statePaths: [],
        definition: d,
        featureIds: [],
      };
      node.names = [...new Set([...node.names, dependency.name])].sort();
      node.label = node.names[0];
      node.statePaths = [
        ...new Set([...node.statePaths, ...(dependency.statePaths ?? [])]),
      ].sort();
      if (!node.featureIds.includes(featureId)) node.featureIds.push(featureId);
      map.set(id, node);
      ids.add(id);
    }
    return [...ids];
  }
  const features: FeatureNode[] = report.modules
    .filter((m) => m.kind === "feature")
    .map((module) => {
      const id = `feature:${module.name}`;
      return {
        id,
        label: module.name.replace("@camera-path/feature-", ""),
        module,
        selectorIds: collect(
          module.selectors.filter(
            (d) =>
              d.package === "@camera-path/store" &&
              d.kind !== "api-hook" &&
              !!d.statePaths?.length,
          ),
          selectors,
          id,
          "selector",
        ),
        actionIds: collect(module.actions, actions, id, "action"),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const sorted = (map: Map<string, DependencyNode>) =>
    [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  return {
    features,
    selectors: sorted(selectors),
    actions: sorted(actions),
    links: features.flatMap((f) => [
      ...f.selectorIds.map((source) => ({
        id: `${source}->${f.id}`,
        source,
        target: f.id,
        featureId: f.id,
        kind: "selector" as const,
      })),
      ...f.actionIds.map((target) => ({
        id: `${f.id}->${target}`,
        source: f.id,
        target,
        featureId: f.id,
        kind: "action" as const,
      })),
    ]),
  };
}
