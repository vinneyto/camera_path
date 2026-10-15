// @vitest-environment happy-dom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { useAnchorToolShortcut } from "./use-anchor-tool-shortcut";
import { getAnchorToolModifier } from "../lib/get-anchor-tool-modifier";

afterEach(cleanup);

it("reads current tool through its selector without resetting the active tool on each update", () => {
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const { unmount } = renderHook(useAnchorToolShortcut, {
    wrapper: ({ children }) => (
      <EditorStoreProvider store={store}>
        <EditorActionsProvider actions={actions}>
          {children}
        </EditorActionsProvider>
      </EditorStoreProvider>
    ),
  });
  const key = getAnchorToolModifier({ ctrlKey: false, metaKey: false }).key;
  fireEvent.keyDown(window, { key });
  expect(store.getState().tool.activeTool).toBe("anchor");
  fireEvent.keyUp(window, { key });
  expect(store.getState().tool.activeTool).toBeNull();
  for (const activeTool of ["cloud", "anchor-height"] as const) {
    act(() => actions.setActiveTool(activeTool));
    fireEvent.keyDown(window, { key });
    fireEvent.keyUp(window, { key });
    expect(store.getState().tool.activeTool).toBe(activeTool);
  }
  fireEvent.keyDown(window, { key: "Escape" });
  expect(store.getState().tool.activeTool).toBeNull();
  act(() => actions.setActiveTool("anchor"));
  fireEvent.blur(window);
  expect(store.getState().tool.activeTool).toBeNull();
  act(() => actions.setActiveTool("anchor"));
  unmount();
  expect(store.getState().tool.activeTool).toBeNull();
  fireEvent.keyDown(window, { key });
  expect(store.getState().tool.activeTool).toBeNull();
});
