import type { Dependency, Module, Report } from "./types";

export function reportFixture(): Report {
  const source = { file: "store.ts", line: 10, column: 1 };
  const selector: Dependency = {
    name: "useCamera",
    package: "@camera-path/store",
    kind: "store-selector",
    definition: source,
    statePaths: ["camera.mode"],
    usages: [],
  };
  const action: Dependency = {
    name: "actions.move",
    package: "@camera-path/actions",
    kind: "action",
    definition: { ...source, file: "actions.ts" },
    usages: [],
  };
  const feature: Module = {
    name: "@camera-path/feature-alpha",
    kind: "feature",
    selectors: [selector],
    actions: [action],
    slots: {
      project: {
        scene: [
          { ...source, name: "AlphaScene" },
          { ...source, name: "AlphaPass" },
        ],
      },
    },
  };
  return {
    schemaVersion: 1,
    modules: [
      feature,
      {
        ...feature,
        name: "@camera-path/feature-beta",
        selectors: [
          { ...selector, name: "cameraAlias" },
          {
            ...selector,
            name: "useTool",
            definition: { ...source, line: 20 },
            statePaths: ["tool"],
          },
        ],
        actions: [
          {
            ...action,
            name: "actions.remove",
            definition: { ...action.definition, line: 20 },
          },
        ],
        slots: {},
      },
      {
        ...feature,
        name: "@camera-path/feature-empty",
        selectors: [],
        actions: [],
        slots: {},
      },
      { ...feature, name: "@camera-path/host", kind: "host" },
      { ...feature, name: "@camera-path/shared", kind: "shared" },
    ],
  };
}
