// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createEditorStore } from "./editor-store";
import { EditorStoreProvider } from "./store-provider";
import { useCameraState } from "./use-camera-state";
import { usePlaybackState } from "./use-playback-state";
import { useEditorTool } from "./use-editor-tool";
import { useSceneInteraction } from "./use-scene-interaction";

afterEach(cleanup);

it.each([
  {
    section: "camera" as const,
    hook: useCameraState,
    next: { cameraMode: "trajectory" as const },
  },
  {
    section: "playback" as const,
    hook: usePlaybackState,
    next: { elapsed: 1, pathPosition: 0.5, playing: true },
  },
  {
    section: "tool" as const,
    hook: useEditorTool,
    next: { activeTool: "anchor" as const, pendingCloud: null },
  },
  {
    section: "sceneInteraction" as const,
    hook: useSceneInteraction,
    next: { hoveredObjectId: "a", selectedObjectId: null },
  },
])(
  "subscribes only to $section and never exposes the root store",
  ({ section, hook, next }) => {
    const store = createEditorStore();
    const reads = vi.fn();
    const { result } = renderHook<unknown, unknown>(
      () => {
        reads();
        return hook();
      },
      {
        wrapper: ({ children }) => (
          <EditorStoreProvider store={store}>{children}</EditorStoreProvider>
        ),
      },
    );
    expect(result.current).toEqual(store.getState()[section]);
    const before = reads.mock.calls.length;
    const unrelated =
      section === "tool"
        ? { camera: { cameraMode: "trajectory" as const } }
        : { tool: { activeTool: "anchor" as const, pendingCloud: null } };
    act(() => store.setState(unrelated));
    expect(reads).toHaveBeenCalledTimes(before);
    act(() => store.setState({ [section]: next }));
    expect(result.current).toEqual(next);
    expect(reads.mock.calls.length).toBeGreaterThan(before);
  },
);
