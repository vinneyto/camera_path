// @vitest-environment happy-dom

import { ProjectWorkspace } from "@host/ui/project-workspace/ui/project-workspace";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

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
  const { rerender } = render(<ProjectWorkspace projectId="project" />);
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.getByRole("main").className).not.toContain("300px");
  auth.canEdit = true;
  rerender(<ProjectWorkspace projectId="project" />);
  expect(screen.getByRole("complementary")).toBeTruthy();
  expect(screen.getByRole("main").className).toContain("300px");
  auth.canEdit = false;
  rerender(<ProjectWorkspace projectId="project" />);
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(screen.getByRole("main").className).not.toContain("300px");
  expect(screen.getByText("Scene")).toBeTruthy();
});
