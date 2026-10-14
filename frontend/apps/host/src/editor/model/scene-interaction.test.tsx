// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useHoveredAnchor } from "@camera-path/feature-anchors/ports";
import { useHoveredTrajectory } from "@camera-path/feature-trajectory/ports";
import { EditorTestHost } from "@host/testing/editor-host";

afterEach(cleanup);

it("routes both features through one hover action without stale pointer-out clearing the winner", async () => {
  const { result } = renderHook(
    () => ({ anchors: useHoveredAnchor(), trajectory: useHoveredTrajectory() }),
    { wrapper: EditorTestHost },
  );
  await act(async () => {
    result.current.anchors.hoverAnchor("a");
    result.current.trajectory.hoverTrajectory();
    result.current.anchors.clearHoveredAnchor("a");
  });
  await waitFor(() => expect(result.current.trajectory.hovered).toBe(true));
  expect(result.current.anchors.hoveredAnchorId).toBeNull();
  await act(async () => {
    result.current.anchors.hoverAnchor("b");
    result.current.trajectory.clearHoveredTrajectory();
  });
  await waitFor(() => expect(result.current.anchors.hoveredAnchorId).toBe("b"));
  expect(result.current.trajectory.hovered).toBe(false);
  await act(async () => result.current.anchors.selectAnchor("b"));
  await waitFor(() =>
    expect(result.current.anchors.selectedAnchorId).toBe("b"),
  );
  await act(async () => {
    result.current.anchors.clearHoveredAnchor("b");
    result.current.anchors.clearSelectedAnchor("b");
  });
  await waitFor(() => {
    expect(result.current.anchors.hoveredAnchorId).toBeNull();
    expect(result.current.anchors.selectedAnchorId).toBeNull();
  });
});
