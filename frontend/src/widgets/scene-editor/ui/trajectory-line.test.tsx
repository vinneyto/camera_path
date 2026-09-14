// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompiledTrajectory } from "@/entities/trajectory";

import { TrajectoryLine } from "./trajectory-line";

const clearHoveredTrajectory = vi.fn();

vi.mock("@/entities/trajectory", async (importOriginal) => ({
  ...(await importOriginal()),
  sampleTrajectory: () => [
    [0, 0, 0],
    [1, 0, 0],
  ],
}));

vi.mock("@/features/project-editor", () => ({
  useHoveredTrajectory: () => ({
    clearHoveredTrajectory,
    hoverTrajectory: vi.fn(),
    hovered: false,
  }),
}));

vi.mock("@/shared/three", () => ({
  RENDER_PIPELINE_OVERLAY_LAYER: 1,
  ScreenSpaceLine: ({
    onContextMenu,
    onPointerDown,
  }: ComponentProps<"button">) => (
    <button
      data-testid="trajectory-line"
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    />
  ),
}));

const trajectory = {
  position_segments: [{ p0: [0, 0, 0], p3: [1, 0, 0] }],
} as unknown as CompiledTrajectory;

describe("TrajectoryLine", () => {
  afterEach(cleanup);

  it("opens its menu at the pointer and suppresses the browser event", () => {
    const onOpenMenu = vi.fn();
    const parentContextMenu = vi.fn();
    const parentPointerDown = vi.fn();
    render(
      <div onContextMenu={parentContextMenu} onPointerDown={parentPointerDown}>
        <TrajectoryLine
          dark
          interactive
          onOpenMenu={onOpenMenu}
          onSelect={vi.fn()}
          selected={false}
          trajectory={trajectory}
        />
      </div>,
    );

    const pointerEvent = new PointerEvent("pointerdown", {
      bubbles: true,
      button: 2,
      cancelable: true,
    });
    screen.getByTestId("trajectory-line").dispatchEvent(pointerEvent);
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    });
    screen.getByTestId("trajectory-line").dispatchEvent(event);

    expect(pointerEvent.defaultPrevented).toBe(true);
    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(parentContextMenu).not.toHaveBeenCalled();
    expect(onOpenMenu).toHaveBeenCalledWith({ x: 120, y: 80 });
  });

  it("does not open the menu while another editor tool is active", () => {
    const onOpenMenu = vi.fn();
    render(
      <TrajectoryLine
        dark
        interactive={false}
        onOpenMenu={onOpenMenu}
        onSelect={vi.fn()}
        selected={false}
        trajectory={trajectory}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId("trajectory-line"));

    expect(onOpenMenu).not.toHaveBeenCalled();
  });
});
