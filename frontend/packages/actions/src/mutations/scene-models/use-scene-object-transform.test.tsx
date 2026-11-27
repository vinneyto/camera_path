// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { useSceneModels } from "@camera-path/api/resources";
import {
  createEditorStore,
  EditorStoreProvider,
  ResourceScopeProvider,
} from "@camera-path/store";
import type { SceneObject } from "@camera-path/types/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useSceneObjectTransform } from "./use-scene-object-transform";

const original: SceneObject = {
  id: "object",
  parent_id: null,
  project_id: "transform-test",
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 2, 1],
  name: "Model",
  library_asset_id: "asset",
  library_asset_file_id: "main",
  format: "ply",
  download_url: "/model.ply",
  sort_order: 0,
  visible: true,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function setup() {
  let saved = original;
  let complete: (response: Response) => void = () => {};
  const requests: { body: unknown; revision: string | null }[] = [];
  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      requests.push({
        body: JSON.parse(String(init.body)),
        revision: new Headers(init.headers).get("If-Match"),
      });
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    }
    return new Response(JSON.stringify([saved]), {
      status: 200,
      headers: { ETag: '"3"', "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <ResourceScopeProvider projectId="transform-test">
        <EditorStoreProvider store={store}>
          <EditorActionsProvider actions={actions}>
            {children}
          </EditorActionsProvider>
        </EditorStoreProvider>
      </ResourceScopeProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () => ({
      interaction: useSceneObjectTransform(),
      models: useSceneModels(),
    }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.models.isSuccess).toBe(true));
  return {
    ...hook,
    requests,
    fetch,
    store,
    complete(success: boolean) {
      if (success) {
        saved = { ...original, position: [3, 4, 5] };
        complete(
          new Response(JSON.stringify(saved), {
            status: 200,
            headers: { ETag: '"4"', "Content-Type": "application/json" },
          }),
        );
      } else
        complete(
          new Response(JSON.stringify({ detail: "Cannot save" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
        );
    },
  };
}

it("previews locally, saves once on release and waits for refreshed server data before removing the preview", async () => {
  const test = await setup();
  act(() => test.result.current.interaction.begin(original.id, original));
  for (const x of [1, 2, 3])
    act(() =>
      test.result.current.interaction.change(original.id, {
        ...original,
        position: [x, 4, 5],
      }),
    );
  expect(test.requests).toHaveLength(0);
  expect(test.result.current.interaction.preview?.transform.position).toEqual([
    3, 4, 5,
  ]);
  expect(test.store.getState().tool.activeTool).toBe("object-transform");
  const final = {
    ...original,
    position: [3, 4, 5] as [number, number, number],
  };
  act(() => {
    test.result.current.interaction.commit(original.id, final);
    test.result.current.interaction.commit(original.id, final);
  });
  await waitFor(() => expect(test.requests).toHaveLength(1));
  expect(test.requests[0]).toEqual({
    body: { position: [3, 4, 5], quaternion: [0, 0, 0, 1] },
    revision: expect.stringMatching(/^"\d+"$/),
  });
  expect(test.result.current.interaction.pending).toBe(true);
  expect(test.result.current.interaction.preview).not.toBeNull();
  await act(async () => test.complete(true));
  await waitFor(() =>
    expect(test.result.current.interaction.preview).toBeNull(),
  );
  expect(test.result.current.models.data?.data[0].position).toEqual([3, 4, 5]);
  expect(test.result.current.interaction.pending).toBe(false);
});

it("rolls back the preview on a failed save and exposes the error", async () => {
  const test = await setup();
  act(() => test.result.current.interaction.begin(original.id, original));
  act(() =>
    test.result.current.interaction.commit(original.id, {
      ...original,
      position: [3, 4, 5],
    }),
  );
  await waitFor(() => expect(test.requests).toHaveLength(1));
  await act(async () => test.complete(false));
  await waitFor(() =>
    expect(test.result.current.interaction.preview).toBeNull(),
  );
  expect(test.result.current.models.data?.data[0].position).toEqual(
    original.position,
  );
  expect(test.result.current.interaction.error?.message).toBe("Cannot save");
  expect(test.store.getState().tool.activeTool).toBeNull();
});

it("cancels without sending a mutation and releases the tool lock on unmount", async () => {
  const test = await setup();
  act(() => test.result.current.interaction.begin(original.id, original));
  act(() => test.result.current.interaction.cancel(original.id));
  expect(test.result.current.interaction.preview).toBeNull();
  expect(test.requests).toHaveLength(0);
  act(() => test.result.current.interaction.begin(original.id, original));
  test.unmount();
  expect(test.store.getState().tool.activeTool).toBeNull();
});
