// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import type { Anchor } from "@camera-path/types/project";
import type { ThreeEvent } from "@react-three/fiber";
import { act, cleanup, renderHook } from "@testing-library/react";
import { Ray, Vector3 } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";

afterEach(cleanup);

it.each([
  { selected: null, ending: "release" },
  { selected: "model", ending: "release" },
  { selected: null, ending: "cancel" },
  { selected: "model", ending: "cancel" },
  { selected: "anchor:comment", ending: "release" },
  { selected: "anchor:comment", ending: "cancel" },
])(
  "keeps selection $selected unchanged through an anchor drag and $ending",
  async ({ selected, ending }) => {
    const anchor: Anchor = {
      id: "comment",
      label: "A",
      surface_position: [0, 0, 0],
      surface_normal: [0, 1, 0],
      lift_axis: "world_up",
      lift: 0.5,
    };
    const store = createEditorStore();
    const actions = createEditorActions(store);
    actions.selectObject({ id: selected });
    let finishCommit!: () => void;
    const commit = new Promise<void>((resolve) => {
      finishCommit = resolve;
    });
    const onCommit = vi.fn(() => commit);
    const target = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    };
    function pointer(y: number) {
      return {
        button: 0,
        pointerId: 7,
        target,
        ray: new Ray(new Vector3(0, y, 3), new Vector3(0, 0, -1)),
        stopPropagation: vi.fn(),
        nativeEvent: { preventDefault: vi.fn(), pointerType: "mouse" },
      } as unknown as ThreeEvent<PointerEvent>;
    }
    const { result } = renderHook(
      () => useAnchorHeightEditing({ anchors: [anchor], onCommit }),
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
    function trigger(
      name:
        "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel",
      y: number,
    ) {
      const handler = result.current.getAnchorInteractionProps(anchor)[name];
      if (typeof handler !== "function")
        throw new Error("Pointer handler missing");
      handler(pointer(y));
    }
    act(() => trigger("onPointerDown", 0.5));
    expect(store.getState().sceneInteraction.selectedObjectId).toBe(selected);
    expect(result.current.preview).toEqual({
      anchorId: anchor.id,
      dragging: true,
      lift: 0.5,
    });
    expect(store.getState().tool.activeTool).toBe("anchor-height");
    expect(target.setPointerCapture).toHaveBeenCalledWith(7);
    act(() => trigger("onPointerMove", 1.5));
    expect(result.current.preview?.lift).toBe(1.5);
    expect(store.getState().sceneInteraction.selectedObjectId).toBe(selected);
    if (ending === "release") {
      act(() => trigger("onPointerUp", 1.5));
      expect(onCommit).toHaveBeenCalledExactlyOnceWith(anchor.id, 1.5);
      expect(result.current.preview?.dragging).toBe(false);
      expect(store.getState().sceneInteraction.selectedObjectId).toBe(selected);
      // Finishing the save must not deselect another object chosen meanwhile.
      act(() => actions.selectObject({ id: "other-model" }));
      await act(async () => finishCommit());
      expect(store.getState().sceneInteraction.selectedObjectId).toBe(
        "other-model",
      );
    } else {
      act(() => trigger("onPointerCancel", 1.5));
      expect(onCommit).not.toHaveBeenCalled();
      expect(store.getState().sceneInteraction.selectedObjectId).toBe(selected);
    }
    expect(result.current.preview).toBeNull();
    expect(store.getState().tool.activeTool).toBeNull();
    expect(target.releasePointerCapture).toHaveBeenCalledWith(7);
  },
);
