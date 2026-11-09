// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { rememberProjectRevision } from "@camera-path/api/client/orval-fetch";
import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSendChatMessage } from "./use-send-chat-message";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reuses uploaded images on message retry and sends the captured selection", async () => {
  let prepared = 0;
  const payloads: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const response = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/chat/attachments")) {
        prepared++;
        return response(
          { id: "image", upload_url: "http://upload.test/image" },
          201,
        );
      }
      if (url === "http://upload.test/image")
        return new Response(null, { status: 204 });
      if (url.endsWith("/complete"))
        return response({
          id: "image",
          name: "chair.png",
          format: "png",
          url: "/image",
        });
      if (url.endsWith("/user-messages")) {
        payloads.push(JSON.parse(String(init?.body)));
        return payloads.length === 1
          ? response({ detail: "temporary failure" }, 503)
          : response({ id: "message" }, 201);
      }
      if (url.endsWith("/chat/messages"))
        return response({
          answer: "done",
          compiled: { position_segments: [] },
        });
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  rememberProjectRevision("chat-test", 1);
  const { result } = renderHook(() => useSendChatMessage(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>
        <ResourceScopeProvider projectId="chat-test">
          <EditorStoreProvider store={store}>
            <EditorActionsProvider actions={actions}>
              {children}
            </EditorActionsProvider>
          </EditorStoreProvider>
        </ResourceScopeProvider>
      </QueryClientProvider>
    ),
  });
  const accepted = vi.fn();
  const args = {
    id: "message",
    message: "replace it",
    selectedObjectId: "anchor:a",
    files: [new File(["x"], "chair.png", { type: "image/png" })],
    onAccepted: accepted,
  };
  await act(async () => {
    await expect(result.current.mutateAsync(args)).rejects.toThrow(
      "temporary failure",
    );
  });
  actions.selectObject({ id: "anchor:b" });
  await act(async () => {
    await result.current.mutateAsync(args);
  });
  expect(prepared).toBe(1);
  expect(payloads).toEqual(
    Array(2).fill({
      id: "message",
      message: "replace it",
      selected_object_id: "anchor:a",
      attachment_ids: ["image"],
    }),
  );
  expect(accepted).toHaveBeenCalledOnce();
  expect(store.getState().sceneInteraction.selectedObjectId).toBe("anchor:b");
});
