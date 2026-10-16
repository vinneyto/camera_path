import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { scanModules } from "./scan-modules.mjs";
import { run } from "../scan-frontend.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function fixture(featureFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-map-"));
  roots.push(root);
  const files = {
    "package.json": JSON.stringify({
      workspaces: ["apps/*", "packages/*", "packages/features/*"],
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "preserve",
        strict: true,
        paths: {
          "@camera-path/store": ["./packages/store/src/index.ts"],
          "@camera-path/actions": ["./packages/actions/src/index.ts"],
          "@camera-path/api/resources": ["./packages/api/src/index.ts"],
        },
      },
      include: ["**/*.ts", "**/*.tsx"],
    }),
    "packages/store/package.json": '{"name":"@camera-path/store"}',
    "packages/actions/package.json": '{"name":"@camera-path/actions"}',
    "packages/api/package.json": '{"name":"@camera-path/api"}',
    "packages/features/demo/package.json":
      '{"name":"@camera-path/feature-demo"}',
    "packages/store/src/index.ts": `
      export interface EditorState { camera: { cameraMode: string }; playback: { playing: boolean }; tool: { activeTool: string } }
      export function useEditorStore<T>(select: (s: EditorState) => T): T { throw new Error(); }
      export function useEditorStoreApi() { return { getState: (): EditorState => { throw new Error(); } }; }
      export function usePlaybackState() { return useEditorStore(s => s.playback); }
    `,
    "packages/actions/src/implementation.ts": `
      const actions = { selectObject: (id: string) => id, setPlaying: (value: boolean) => value };
      export function useEditorActions() { return actions; }
      export function useAdd() { return { mutate: () => {} }; }
      export function unusedAction() {}
    `,
    "packages/actions/src/index.ts":
      'export { useAdd as useAddMutation, useEditorActions, unusedAction } from "./implementation";',
    "packages/api/src/index.ts":
      "export function useSceneModels() { return []; }",
    "packages/features/demo/src/panels.tsx": `export function Panel() { return null; } export const Second = () => null;`,
    "packages/features/demo/src/index.ts": `
      import { Panel as First } from "./panels";
      import * as UI from "./panels";
      const views = [First] as const;
      const base = { settings: { content: views } };
      const scene = { scene: [...views, UI.Second] };
      export const slots = { ...base, project: { ...scene, commands: [UI.Second] } } as const satisfies Record<string, unknown>;
    `,
    "packages/features/demo/src/view.tsx": `
      import { useAddMutation as add, useEditorActions, unusedAction } from "@camera-path/actions";
      import * as actions from "@camera-path/actions";
      import { useEditorStore as select, useEditorStoreApi, usePlaybackState } from "@camera-path/store";
      import { useSceneModels } from "@camera-path/api/resources";
      export function View() {
        const { selectObject: choose } = useEditorActions();
        const write = actions.useAddMutation;
        const selector = (s: import("@camera-path/store").EditorState) => s.camera["cameraMode"];
        const mode = select(selector);
        usePlaybackState(); useSceneModels(); add(); write(); choose("one");
        actions.useEditorActions().setPlaying(true);
        const snapshot = useEditorStoreApi().getState();
        return snapshot.tool.activeTool + mode;
      }
      const text = "unusedAction()"; // unusedAction() must not be reported.
    `,
    "packages/features/demo/src/ignored.test.ts":
      'import { unusedAction } from "@camera-path/actions"; unusedAction();',
    "packages/api/src/client/generated/ignored.ts":
      "export function useGenerated() {}",
    ...featureFiles,
  };
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return path.join(root, "tsconfig.json");
}

it("keeps the nested slot tree, spreads, array order and actual aliased component declarations", () => {
  const report = scanModules(fixture());
  const feature = report.modules.find((m) => m.kind === "feature");
  expect(feature.slots.project.scene.map((c) => c.name)).toEqual([
    "Panel",
    "Second",
  ]);
  expect(feature.slots.settings.content[0]).toMatchObject({
    name: "Panel",
    file: "packages/features/demo/src/panels.tsx",
    line: 1,
  });
  expect(feature.slots.project.commands.map((c) => c.name)).toEqual(["Second"]);
  expect(report.diagnostics).toEqual([]);
});

it("finds action values through re-exports, namespace/local aliases and destructured methods; ignores unused imports and strings", () => {
  const report = scanModules(fixture());
  const feature = report.modules.find((m) => m.kind === "feature");
  const names = feature.actions.map((d) => d.name);
  expect(names).toContain("useAddMutation");
  expect(names).toContain("useAdd"); // Namespace access resolves to the original declaration.
  expect(names).toContain("selectObject");
  expect(names).toContain("setPlaying");
  expect(names).not.toContain("unusedAction");
  expect(feature.actions.find((d) => d.name === "selectObject").usages).toEqual(
    expect.arrayContaining([expect.objectContaining({ expression: "choose" })]),
  );
  expect(feature.files.some((f) => f.includes("ignored.test"))).toBe(false);
  expect(
    report.modules.find((m) => m.name === "@camera-path/api").files,
  ).not.toContain("packages/api/src/client/generated/ignored.ts");
});

it("extracts named/inline selector paths, shared hook paths, snapshot aliases and API data hooks", () => {
  const feature = scanModules(fixture()).modules.find(
    (m) => m.kind === "feature",
  );
  expect(
    feature.selectors.find((d) => d.kind === "store-selector"),
  ).toMatchObject({
    name: "useEditorStore",
    statePaths: ["camera.cameraMode"],
  });
  expect(
    feature.selectors.find((d) => d.name === "usePlaybackState"),
  ).toMatchObject({ statePaths: ["playback"] });
  expect(
    feature.selectors.find((d) => d.kind === "store-snapshot"),
  ).toMatchObject({
    package: "@camera-path/store",
    statePaths: ["tool.activeTool"],
  });
  expect(
    feature.selectors.find((d) => d.name === "useSceneModels"),
  ).toMatchObject({ kind: "api-hook" });
});

it("maps the application settings selector and its separate save action", () => {
  const report = scanModules(
    fixture({
      "packages/store/src/index.ts": `
      export interface UserSettingsState { userSettings: { showGrid: boolean } }
      export function useUserSettingsStore<T>(select: (s: UserSettingsState) => T): T { throw new Error(); }
      export function useUserSettings() { return useUserSettingsStore(s => s.userSettings); }
      export function createUserSettingsStore() { return { getState: (): UserSettingsState => { throw new Error(); } }; }
    `,
      "packages/actions/src/index.ts": `
      import { createUserSettingsStore } from "@camera-path/store";
      export function useUserSettingsActions() { return { save: () => {} }; }
      export function readSettingsInInfrastructure() { return createUserSettingsStore().getState().userSettings.showGrid; }
    `,
      "packages/features/demo/src/view.tsx": `
      import { useUserSettings } from "@camera-path/store";
      import { useUserSettingsActions } from "@camera-path/actions";
      export function View() { const data = useUserSettings(); useUserSettingsActions().save(); return data.showGrid; }
    `,
    }),
  );
  const feature = report.modules.find((m) => m.kind === "feature");
  expect(feature.selectors).toHaveLength(1);
  expect(feature.selectors[0]).toMatchObject({
    name: "useUserSettings",
    package: "@camera-path/store",
    kind: "store-hook",
    statePaths: ["userSettings"],
  });
  expect(feature.actions.map((a) => a.name)).toContain(
    "useUserSettingsActions.save",
  );
  expect(
    report.modules.find((m) => m.name === "@camera-path/actions").selectors,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "getState",
        kind: "store-snapshot",
        statePaths: ["userSettings.showGrid"],
      }),
    ]),
  );
  expect(report.diagnostics).toEqual([]);
});

it("reports dynamic and cyclic slots without executing application code or overflowing", () => {
  const dynamic = scanModules(
    fixture({
      "packages/features/demo/src/index.ts":
        'function build() { throw new Error("Never execute"); } export const slots = build();',
    }),
  );
  expect(dynamic.diagnostics).toEqual([
    expect.objectContaining({
      code: "unsupported-slot-expression",
      severity: "error",
    }),
  ]);
  const cyclic = scanModules(
    fixture({
      "packages/features/demo/src/index.ts":
        "const first = { ...second }; const second = { ...first }; export const slots = first;",
    }),
  );
  expect(cyclic.diagnostics.some((d) => d.severity === "error")).toBe(true);
});

it("handles destructured selectors and snapshot aliases, and reports dynamic state keys", () => {
  const project = fixture({
    "packages/features/demo/src/view.tsx": `
    import { useEditorStore, useEditorStoreApi } from "@camera-path/store";
    export function Demo(key: string) {
      useEditorStore(({ camera: c }) => c.cameraMode);
      useEditorStore(s => s.tool[key]);
      const { tool: t } = useEditorStoreApi().getState();
      return t.activeTool;
    }
  `,
  });
  const report = scanModules(project);
  const feature = report.modules.find((m) => m.kind === "feature");
  expect(
    feature.selectors.find((d) => d.kind === "store-selector").statePaths,
  ).toEqual(["camera.cameraMode", "tool.*"]);
  expect(
    feature.selectors.find((d) => d.kind === "store-snapshot").statePaths,
  ).toEqual(["tool.activeTool"]);
  expect(report.diagnostics).toEqual([
    expect.objectContaining({
      code: "dynamic-state-access",
      severity: "warning",
    }),
  ]);
});

it("uses the workspace's exported entrypoint and diagnoses unresolved workspace imports", () => {
  const report = scanModules(
    fixture({
      "packages/features/demo/package.json":
        '{"name":"@camera-path/feature-demo","exports":{".":"./src/extension.ts"}}',
      "packages/features/demo/src/extension.ts":
        'export { slots } from "./index";',
      "packages/features/demo/src/broken.ts":
        'import { missing } from "@camera-path/unknown"; missing();',
    }),
  );
  const feature = report.modules.find((m) => m.kind === "feature");
  expect(feature.entrypoint).toBe("packages/features/demo/src/extension.ts");
  expect(feature.slots.project.scene.map((c) => c.name)).toEqual([
    "Panel",
    "Second",
  ]);
  expect(report.diagnostics).toEqual([
    expect.objectContaining({ code: "unresolved-import", severity: "error" }),
  ]);
});

it("writes reproducible JSON, checks freshness, and detects a stale report", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const project = fixture();
  const output = path.join(path.dirname(project), "report.json");
  expect(await run(["--project", project, "--output", output])).toBe(0);
  const before = fs.readFileSync(output, "utf8");
  expect(await run(["--project", project, "--output", output, "--check"])).toBe(
    0,
  );
  expect(fs.readFileSync(output, "utf8")).toBe(before);
  fs.writeFileSync(output, "{}");
  expect(await run(["--project", project, "--output", output, "--check"])).toBe(
    1,
  );
});
