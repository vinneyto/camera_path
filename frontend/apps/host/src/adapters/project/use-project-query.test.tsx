// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useProjectQuery } from "./use-project-query";
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@host/adapters/api/generated/client", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@host/adapters/api/generated/client")
    >();
  const query = (data: unknown) => ({
    data: { data, headers: new Headers() },
    isPending: false,
    error: null,
  });
  return {
    ...original,
    useGetProject: () => query({ id: "project", name: "P", revision: 1 }),
    useListAnchors: () => query([]),
    useListScenePoints: () => query([]),
    useGetTrajectory: () => query({ segments: [] }),
    useGetSpeedTimeline: () => query({ default_speed: 1, keyframes: {} }),
    useGetAimTimeline: () =>
      query({
        default_aim: { kind: "follow_path", direction: "forward" },
        world_up: [0, 1, 0],
        keyframes: { aim: { id: "aim" } },
      }),
    useGetOrientationTimeline: () =>
      query({
        default_orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
        keyframes: { orientation: { id: "orientation" } },
      }),
    useGetDepthOfFieldTimeline: () =>
      query({ keyframes: { dof: { id: "dof" } } }),
    useGetLidarTimeline: () => query({ lidar_keyframe: null }),
    useListChatMessages: () => query([]),
  };
});
it("maps endpoint keyframes into distinct host projection fields", () => {
  const { result } = renderHook(() => useProjectQuery("project"));
  expect(Object.keys(result.current.data!.camera_track.keyframes)).toEqual([
    "aim",
  ]);
  expect(
    Object.keys(result.current.data!.camera_track.orientation_keyframes),
  ).toEqual(["orientation"]);
  expect(
    Object.keys(result.current.data!.camera_track.depth_of_field_keyframes),
  ).toEqual(["dof"]);
});
