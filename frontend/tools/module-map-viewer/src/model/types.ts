export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}
export interface SlotComponent extends SourceLocation {
  name: string;
}
export interface SlotTree {
  [name: string]: SlotTree | SlotComponent[];
}
export interface Dependency {
  name: string;
  kind: string;
  package: string;
  definition: SourceLocation;
  statePaths?: string[];
  usages: (SourceLocation & { expression: string })[];
}
export interface Module {
  name: string;
  kind: "feature" | "host" | "shared";
  slots: SlotTree;
  actions: Dependency[];
  selectors: Dependency[];
}
export interface Report {
  schemaVersion: 1;
  modules: Module[];
}
export interface DependencyNode {
  id: string;
  label: string;
  names: string[];
  statePaths: string[];
  definition: SourceLocation;
  featureIds: string[];
}
export interface FeatureNode {
  id: string;
  label: string;
  module: Module;
  selectorIds: string[];
  actionIds: string[];
}
export interface GraphLink {
  id: string;
  source: string;
  target: string;
  featureId: string;
  kind: "selector" | "action";
}
export interface Graph {
  features: FeatureNode[];
  selectors: DependencyNode[];
  actions: DependencyNode[];
  links: GraphLink[];
}
export interface GraphView {
  selectors: DependencyNode[];
  actions: DependencyNode[];
  links: GraphLink[];
}
