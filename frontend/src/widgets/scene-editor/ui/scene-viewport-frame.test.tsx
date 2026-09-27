// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
        clouds={[]}
        deletingTrajectory={false}
        onDeleteAnchor={vi.fn()}
        onDeleteTrajectory={onDeleteTrajectory}
        renderScene={(context) => (
          <button
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
        clouds={[]}
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

  it("keeps an empty scene usable and reports loading errors per cloud", () => {
    const cloud = {
      id: "one",
      name: "First PLY",
      download_url: "http://test/one.ply",
      library_asset_id: "asset",
      project_id: "project",
      position: 0,
      visible: true,
      translation: [0, 0, 0] as [number, number, number],
      rotation_deg: [0, 0, 0] as [number, number, number],
      scale: 1,
      offset: [0, 0, 0] as [number, number, number],
    };
    const shared = {
      available: true,
      deletingTrajectory: false,
      onDeleteAnchor: vi.fn(),
      onDeleteTrajectory: vi.fn(),
      trajectoryAvailable: false,
    };
    let reportError: ((id: string, error: Error) => void) | undefined;
    const renderScene = (context: {
      onSurfaceError: (id: string, error: Error) => void;
    }) => {
      reportError = context.onSurfaceError;
      return null;
    };
    const { rerender } = render(
      <SceneViewportFrame {...shared} clouds={[]} renderScene={renderScene} />,
    );
    expect(screen.queryByText(/Loading mug/)).toBeNull();
    rerender(
      <SceneViewportFrame
        {...shared}
        clouds={[cloud]}
        renderScene={renderScene}
      />,
    );
    expect(screen.getByText("First PLY: Loading…")).not.toBeNull();
    act(() => reportError?.(cloud.id, new Error("Network error")));
    expect(screen.getByRole("alert").textContent).toContain(
      "First PLY: Network error",
    );
    rerender(
      <SceneViewportFrame {...shared} clouds={[]} renderScene={renderScene} />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
