// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SceneViewportFrame } from "./scene-viewport-frame";

vi.mock("@/features/project-editor", () => ({
  CameraModeToggle: () => null,
  useCameraMode: () => ({ cameraMode: "orbit" }),
}));

vi.mock("@/features/theme-switcher", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

describe("SceneViewportFrame trajectory context menu", () => {
  afterEach(cleanup);

  it("opens, closes with Escape, and invokes delete once", () => {
    const onDeleteTrajectory = vi.fn();
    render(
      <SceneViewportFrame
        available
        deletingTrajectory={false}
        onDeleteAnchor={vi.fn()}
        onDeleteTrajectory={onDeleteTrajectory}
        renderScene={(context) => (
          <button
            onClick={() => context.onSurfaceReady()}
            onContextMenu={(event) => {
              event.preventDefault();
              context.onOpenTrajectoryMenu({ x: 40, y: 60 });
            }}
          >
            trajectory
          </button>
        )}
        trajectoryAvailable
      />,
    );

    fireEvent.contextMenu(screen.getByText("trajectory"));
    expect(screen.getByRole("menu")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.contextMenu(screen.getByText("trajectory"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Delete trajectory" }),
    );

    expect(onDeleteTrajectory).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("disables repeated deletion while the mutation is pending", () => {
    render(
      <SceneViewportFrame
        available
        deletingTrajectory
        onDeleteAnchor={vi.fn()}
        onDeleteTrajectory={vi.fn()}
        renderScene={(context) => (
          <button
            onContextMenu={() => context.onOpenTrajectoryMenu({ x: 40, y: 60 })}
          >
            trajectory
          </button>
        )}
        trajectoryAvailable
      />,
    );

    fireEvent.contextMenu(screen.getByText("trajectory"));

    expect(
      screen.getByRole<HTMLButtonElement>("menuitem", {
        name: "Delete trajectory",
      }).disabled,
    ).toBe(true);
  });
});
