// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CompiledTrajectory } from "@/entities/trajectory";

import { EditorStoreProvider } from "./editor-store-provider";
import { useTrajectoryPlayback } from "./use-trajectory-playback";

const trajectory: CompiledTrajectory = {
  arc_length_table: [],
  camera_track: {
    default_aim: { direction: "forward", kind: "follow_path" },
    default_orientation: { pitch_deg: 0, roll_deg: 0, yaw_deg: 0 },
    keyframes: [],
    orientation_keyframes: [],
    world_up: [0, 1, 0],
  },
  duration_seconds: 1,
  motion_profile: { default_speed: 1, keyframes: [] },
  position_segments: [],
  project_id: "project",
  revision: 1,
  total_length: 1,
  warnings: [],
};

describe("useTrajectoryPlayback", () => {
  it("remains a controller when multiple consumers use it", () => {
    const requestFrame = vi.spyOn(globalThis, "requestAnimationFrame");
    const wrapper = ({ children }: PropsWithChildren) => (
      <EditorStoreProvider>{children}</EditorStoreProvider>
    );
    const { result } = renderHook(
      () => ({
        first: useTrajectoryPlayback(trajectory),
        second: useTrajectoryPlayback(trajectory),
      }),
      { wrapper },
    );

    act(() => result.current.first.toggle());

    expect(result.current.first.playing).toBe(true);
    expect(result.current.second.playing).toBe(true);
    expect(requestFrame).not.toHaveBeenCalled();
    requestFrame.mockRestore();
  });
});
