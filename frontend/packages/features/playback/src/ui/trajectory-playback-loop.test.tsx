// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import type { PlaybackTrajectory } from "@camera-path/types/timeline-views";
import { TrajectoryPlaybackLoop } from "./trajectory-playback-loop";

vi.mock("@camera-path/trajectory-math", () => {
  // React Compiler retains the table in production. Keep that identity here as
  // Vitest does not compile React, so this test isolates the RAF lifetime.
  const table = [
    { time: 0, pathPosition: 0 },
    { time: 10, pathPosition: 1 },
  ];
  return {
    createPlaybackTable: () => table,
    pathPositionAtTime: (_table: unknown, elapsed: number) => elapsed / 10,
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("resumes from selected elapsed time, keeps one RAF loop across updates, and stops on pause/end", () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let counter = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callbacks.set(++counter, callback);
      return counter;
    }),
  );
  const cancel = vi.fn((id: number) => callbacks.delete(id));
  vi.stubGlobal("cancelAnimationFrame", cancel);
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const trajectory: PlaybackTrajectory = {
    project_id: "p",
    revision: 1,
    total_length: 10,
    duration_seconds: 10,
    motion_profile: { default_speed: 1, keyframes: [] },
  };
  const { unmount } = render(
    <EditorStoreProvider store={store}>
      <EditorActionsProvider actions={actions}>
        <TrajectoryPlaybackLoop trajectory={trajectory} />
      </EditorActionsProvider>
    </EditorStoreProvider>,
  );
  const tick = (seconds: number) => {
    now += seconds * 1000;
    const pending = [...callbacks.values()];
    callbacks.clear();
    act(() => pending.forEach((callback) => callback(now)));
  };
  act(() => {
    actions.setPlaybackFrame({ elapsed: 4, pathPosition: 0.4 });
    actions.setPlaying(true);
  });
  tick(1);
  expect(store.getState().playback.elapsed).toBe(5);
  tick(1);
  expect(store.getState().playback.elapsed).toBe(6);
  expect(cancel).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(1);
  act(() => actions.setPlaying(false));
  expect(callbacks.size).toBe(0);
  act(() => {
    actions.setPlaybackFrame({ elapsed: 8, pathPosition: 0.8 });
    actions.setPlaying(true);
  });
  tick(1);
  expect(store.getState().playback.elapsed).toBe(9);
  tick(2);
  expect(store.getState().playback).toEqual({
    elapsed: 10,
    pathPosition: 1,
    playing: false,
  });
  expect(callbacks.size).toBe(0);
  act(() => {
    actions.resetPlayback();
    actions.setPlaying(true);
  });
  expect(callbacks.size).toBe(1);
  unmount();
  expect(callbacks.size).toBe(0);
});
