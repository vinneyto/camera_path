// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatComposer } from "./use-chat-composer";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import type { ReactNode } from "react";

afterEach(cleanup);

function createScope() {
  const store = createEditorStore();
  const actions = createEditorActions(store);
  return {
    actions,
    wrapper: ({ children }: { children: ReactNode }) => (
      <EditorStoreProvider store={store}>
        <EditorActionsProvider actions={actions}>
          {children}
        </EditorActionsProvider>
      </EditorStoreProvider>
    ),
  };
}

it("keeps multiple images for retries and clears only the accepted draft", () => {
  const send = vi.fn<
    (
      id: string,
      text: string,
      accepted: () => void,
      files?: File[],
    ) => Promise<void>
  >(async () => {});
  const first = new File(["a"], "chair.png", { type: "image/png" });
  const second = new File(["b"], "table.jpg", { type: "image/jpeg" });
  const scope = createScope();
  const { result } = renderHook(
    () => useChatComposer({ pending: false, onSend: send }),
    { wrapper: scope.wrapper },
  );
  act(() => {
    result.current.changeMessage("replace it");
    result.current.addFiles([first, second]);
  });
  act(() => result.current.submit());
  act(() => result.current.submit());
  expect(send.mock.calls[0][0]).toBe(send.mock.calls[1][0]);
  expect(send.mock.calls[1][3]).toEqual([first, second]);
  act(() => scope.actions.referenceChatObject("A"));
  act(() => result.current.submit());
  expect(send.mock.calls[2][0]).not.toBe(send.mock.calls[1][0]);
  act(() => send.mock.calls[2][2]());
  expect(result.current.files).toEqual([]);
  expect(result.current.message).toBe("");
});

it("rejects unsupported or excess images without losing the current draft", () => {
  const { result } = renderHook(
    () => useChatComposer({ pending: false, onSend: async () => {} }),
    { wrapper: createScope().wrapper },
  );
  const image = new File(["a"], "a.png", { type: "image/png" });
  act(() => result.current.addFiles([image]));
  act(() =>
    result.current.addFiles([new File(["x"], "x.txt", { type: "text/plain" })]),
  );
  expect(result.current.files).toEqual([image]);
  expect(result.current.attachmentError).toBeTruthy();
  act(() => result.current.addFiles(Array.from({ length: 8 }, () => image)));
  expect(result.current.files).toEqual([image]);
  act(() => result.current.removeFile(0));
  expect(result.current.files).toEqual([]);
});

it("keeps scene references added while an older message is being accepted", () => {
  const send = vi.fn<
    (id: string, text: string, accepted: () => void) => Promise<void>
  >(async () => {});
  const scope = createScope();
  const { result } = renderHook(
    () => useChatComposer({ pending: false, onSend: send }),
    { wrapper: scope.wrapper },
  );
  act(() => result.current.changeMessage("Replace"));
  act(() => scope.actions.referenceChatObject("A"));
  expect(result.current.message).toBe("Replace @A ");
  act(() => result.current.submit());
  act(() => scope.actions.referenceChatObject("Chair 01"));
  act(() => send.mock.calls[0][2]());
  expect(result.current.message).toBe("Replace @A @Chair 01 ");
});
