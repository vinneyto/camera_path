import { ExtensionProvider } from "@camera-path/extension-api/extension-provider";
import type { Extension } from "@camera-path/extension-api";
// @vitest-environment happy-dom

import { ProjectWorkspace } from "@host/ui/project-workspace/ui/project-workspace";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const extension: Extension = {
  manifest: {
    manifestVersion: 1,
    id: "unknown",
    scope: "project",
    reads: [],
    calls: [],
    frames: [],
    capabilities: [],
    contributions: [
      { id: "unknown.sidebar", kind: "ui", slot: "project.sidebar" },
    ],
  },
  contributions: [
    {
      id: "unknown.sidebar",
      Component: () => (auth.canEdit ? <aside>Chat and composer</aside> : null),
    },
  ],
};

const auth = vi.hoisted(() => ({ canEdit: false }));
vi.mock("@host/adapters/identity/auth-provider", () => ({
  useAuth: () => auth,
}));
vi.mock("@host/adapters/project", () => ({
  useProjectQuery: () => ({ data: { id: "project" }, isPending: false }),
  useCompiledTrajectoryQuery: () => ({ data: null, isPending: false }),
}));
vi.mock("@host/editor", () => ({
  TrajectoryPlaybackLoop: () => null,
  useHoveredTrajectory: () => ({ clearHoveredTrajectory: vi.fn() }),
  useTrajectoryPlayback: () => ({ reset: vi.fn() }),
  useTrajectorySelection: () => ({ closeTrajectory: vi.fn() }),
}));
vi.mock("@host/adapters/settings", () => ({
  useUserSettings: () => ({ webGpuTileRenderer: true, loading: false }),
}));
vi.mock("@host/adapters/deletions", () => ({
  useClearTrajectory: () => ({ isPending: false }),
}));
vi.mock("@host/ui/project-workspace/ui/project-header", () => ({
  ProjectHeader: () => <header />,
}));
vi.mock("@host/ui/project-workspace/ui/project-scene", () => ({
  ProjectScene: () => <div>Scene</div>,
}));
vi.mock("@host/ui/project-workspace/ui/chat-panel-container", () => ({
  ChatPanelContainer: () => <aside>Chat and composer</aside>,
}));
afterEach(() => {
  cleanup();
  auth.canEdit = false;
});

it("mounts chat only during an authenticated session and frees its column on logout or expiry", () => {
  const { rerender } = render(
    <ExtensionProvider extensions={[extension]}>
      <ProjectWorkspace projectId="project" />
    </ExtensionProvider>,
  );
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(
    document.querySelector("[data-extension-sidebar]")?.children,
  ).toHaveLength(0);
  auth.canEdit = true;
  rerender(
    <ExtensionProvider extensions={[extension]}>
      <ProjectWorkspace projectId="project" />
    </ExtensionProvider>,
  );
  expect(screen.getByRole("complementary")).toBeTruthy();
  expect(
    document.querySelector("[data-extension-sidebar]")?.children,
  ).toHaveLength(1);
  auth.canEdit = false;
  rerender(
    <ExtensionProvider extensions={[extension]}>
      <ProjectWorkspace projectId="project" />
    </ExtensionProvider>,
  );
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(
    document.querySelector("[data-extension-sidebar]")?.children,
  ).toHaveLength(0);
  expect(screen.getByText("Scene")).toBeTruthy();
});
