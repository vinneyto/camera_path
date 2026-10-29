// @vitest-environment happy-dom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import type { ThreeEvent } from "@react-three/fiber";
import { afterEach, expect, it, vi } from "vitest";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { useAnchorToolShortcut } from "../model/use-anchor-tool-shortcut";
import { useAnchorPlacement } from "./use-anchor-placement";

const hit = { position: [1, 2, 3], normal: [0, 1, 0] } as const;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(["Macintosh", "Linux"])(
  "restores keyboard and held-modifier placement after repeated camera switches on %s",
  (userAgent) => {
    vi.stubGlobal("navigator", { userAgent });
    const store = createEditorStore();
    const actions = createEditorActions(store);
    const onPlace = vi.fn();
    const { result } = renderHook(
      () => {
        useAnchorToolShortcut();
        return useAnchorPlacement({ onPlace });
      },
      {
        wrapper: ({ children }) => (
          <EditorStoreProvider store={store}>
            <EditorActionsProvider actions={actions}>
              {children}
            </EditorActionsProvider>
          </EditorStoreProvider>
        ),
      },
    );
    const key = userAgent === "Macintosh" ? "Meta" : "Control";
    const event = {
      pointerId: 1,
      clientX: 20,
      clientY: 20,
      target: null,
      nativeEvent: {
        pointerType: "mouse",
        metaKey: key === "Meta",
        ctrlKey: key === "Control",
      },
    } as unknown as ThreeEvent<PointerEvent>;
    const surfaceHit = {
      position: [...hit.position],
      normal: [...hit.normal],
    } as Parameters<
      typeof result.current.surfaceEventProps.onSurfacePointerDown
    >[0];
    for (let index = 0; index < 3; index++) {
      act(() => actions.setCameraMode("trajectory"));
      expect(store.getState().tool.activeTool).toBeNull();
      fireEvent.keyDown(window, { key });
      expect(store.getState().tool.activeTool).toBeNull();
      act(() => actions.setCameraMode("orbit"));
      // No new keydown: the modifier was pressed in camera view or outside the canvas.
      act(() =>
        result.current.surfaceEventProps.onSurfacePointerDown(
          surfaceHit,
          event,
        ),
      );
      expect(store.getState().tool.activeTool).toBe("anchor");
      expect(result.current.previewHit).toEqual(surfaceHit);
      act(() =>
        result.current.surfaceEventProps.onSurfacePointerUp(surfaceHit, event),
      );
      expect(onPlace).toHaveBeenCalledTimes(index * 2 + 1);
      fireEvent.keyUp(window, { key });
      expect(store.getState().tool.activeTool).toBeNull();
      fireEvent.keyDown(window, { key });
      act(() =>
        result.current.surfaceEventProps.onSurfacePointerDown(
          surfaceHit,
          event,
        ),
      );
      act(() =>
        result.current.surfaceEventProps.onSurfacePointerUp(surfaceHit, event),
      );
      expect(onPlace).toHaveBeenCalledTimes(index * 2 + 2);
      fireEvent.keyUp(window, { key });
    }
    fireEvent.keyDown(window, { key });
    act(() =>
      result.current.surfaceEventProps.onSurfacePointerDown(surfaceHit, event),
    );
    act(() => actions.setCameraMode("trajectory"));
    act(() => actions.setCameraMode("orbit"));
    act(() =>
      result.current.surfaceEventProps.onSurfacePointerUp(surfaceHit, event),
    );
    expect(onPlace).toHaveBeenCalledTimes(6);
    expect(result.current.previewHit).toBeNull();
  },
);
