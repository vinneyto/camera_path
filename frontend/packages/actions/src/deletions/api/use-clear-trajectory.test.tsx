// @vitest-environment happy-dom

import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  projectApi,
  projectKeys,
  type Project,
} from "@camera-path/api/project";

import { useClearTrajectory } from "@camera-path/actions/deletions/api/use-clear-trajectory";

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
    const store = createEditorStore();
    const actions = createEditorActions(store);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>
        <ResourceScopeProvider projectId={project.id}>
          <EditorStoreProvider store={store}>
            <EditorActionsProvider actions={actions}>
              {children}
            </EditorActionsProvider>
          </EditorStoreProvider>
        </ResourceScopeProvider>
      </QueryClientProvider>
    );
    return {
      ...renderHook(() => useClearTrajectory(project.id), { wrapper }),
      queryClient,
      store,
      actions,
    };
  }

  it("invalidates editable and compiled trajectory after deletion", async () => {
    vi.spyOn(projectApi, "clearTrajectory").mockResolvedValue(undefined);
    const { queryClient, result, store, actions } = setup();
    queryClient.setQueryData(projectKeys.segments(project.id), {
      segments: [{}],
    });
    queryClient.setQueryData(projectKeys.trajectory(project.id), {
      position_segments: [{}],
    });
    queryClient.setQueryData(projectKeys.anchors(project.id), []);

    actions.selectObject({ id: trajectoryObjectId });
    actions.hoverObject({ id: trajectoryObjectId });
    actions.setPlaybackFrame({ pathPosition: 0.5, elapsed: 2 });
    actions.setPlaying(true);
    await act(() => result.current.mutateAsync());
    expect(store.getState().sceneInteraction).toEqual({
      hoveredObjectId: null,
      selectedObjectId: null,
    });
    expect(store.getState().playback).toEqual({
      pathPosition: 0,
      elapsed: 0,
      playing: false,
    });

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
    const { queryClient, result, store, actions } = setup();
    actions.selectObject({ id: trajectoryObjectId });
    const cachedProject = { ...project, revision: 1 };
    queryClient.setQueryData(projectKeys.detail(project.id), cachedProject);

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(queryClient.getQueryData(projectKeys.detail(project.id))).toBe(
      cachedProject,
    );
    expect(store.getState().sceneInteraction.selectedObjectId).toBe(
      trajectoryObjectId,
    );
    await waitFor(() => expect(result.current.error).toBe(error));
  });
});
