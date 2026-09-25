// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { projectApi, projectKeys, type Project } from "@/entities/project";

import { useClearTrajectory } from "./use-clear-trajectory";

const project: Project = {
  anchor_count: 0,
  anchors: {},
  camera_track: {
    depth_of_field_keyframes: {},
    default_aim: { direction: "forward", kind: "follow_path" },
    default_orientation: { pitch_deg: 0, roll_deg: 0, yaw_deg: 0 },
    keyframes: {},
    orientation_keyframes: {},
    world_up: [0, 1, 0],
  },
  chat_history: [],
  id: "project-1",
  motion_profile: { default_speed: 1, keyframes: {} },
  name: "Project",
  revision: 2,
  scene_points: {},
  segments: [],
  segment_count: 0,
};

describe("useClearTrajectory", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function setup() {
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return {
      ...renderHook(() => useClearTrajectory(project.id), { wrapper }),
      queryClient,
    };
  }

  it("invalidates editable and compiled trajectory after deletion", async () => {
    vi.spyOn(projectApi, "clearTrajectory").mockResolvedValue(undefined);
    const { queryClient, result } = setup();
    queryClient.setQueryData(projectKeys.segments(project.id), {
      segments: [{}],
    });
    queryClient.setQueryData(projectKeys.trajectory(project.id), {
      position_segments: [{}],
    });
    queryClient.setQueryData(projectKeys.anchors(project.id), []);

    await act(() => result.current.mutateAsync());

    expect(projectApi.clearTrajectory).toHaveBeenCalledWith(project.id);
    expect(
      queryClient.getQueryState(projectKeys.segments(project.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(projectKeys.trajectory(project.id))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(projectKeys.anchors(project.id))?.isInvalidated,
    ).toBe(false);
  });

  it("keeps cached data when the request fails", async () => {
    const error = new Error("Could not delete trajectory");
    vi.spyOn(projectApi, "clearTrajectory").mockRejectedValue(error);
    const { queryClient, result } = setup();
    const cachedProject = { ...project, revision: 1 };
    queryClient.setQueryData(projectKeys.detail(project.id), cachedProject);

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(queryClient.getQueryData(projectKeys.detail(project.id))).toBe(
      cachedProject,
    );
    await waitFor(() => expect(result.current.error).toBe(error));
  });
});
