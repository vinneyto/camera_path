// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "./project-workspace";

const auth = vi.hoisted(() => ({ canEdit: false }));
vi.mock("@/features/auth", () => ({ useAuth: () => auth }));
vi.mock("@/entities/project", () => ({
  useProjectQuery: () => ({ data: { id: "project" }, isPending: false }),
  useCompiledTrajectoryQuery: () => ({ data: null, isPending: false }),
}));
vi.mock("@/features/project-editor", () => ({
  TrajectoryPlaybackLoop: () => null,
  useHoveredTrajectory: () => ({ clearHoveredTrajectory: vi.fn() }),
  useTrajectoryPlayback: () => ({ reset: vi.fn() }),
  useTrajectorySelection: () => ({ closeTrajectory: vi.fn() }),
}));
vi.mock("@/features/user-settings", () => ({
  useUserSettings: () => ({ webGpuTileRenderer: true, loading: false }),
}));
vi.mock("@/features/object-deletion", () => ({
  useClearTrajectory: () => ({ isPending: false }),
}));
vi.mock("./project-header", () => ({ ProjectHeader: () => <header /> }));
vi.mock("./project-scene", () => ({ ProjectScene: () => <div>Scene</div> }));
vi.mock("./chat-panel-container", () => ({
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
