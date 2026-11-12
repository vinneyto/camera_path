// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { getListSceneObjectsQueryKey } from "@camera-path/api/client/generated/client";
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
import { useDeleteLibraryAssets } from "../library/use-delete-library-assets";
import { useSceneObjectActions } from "./use-scene-object-actions";
import { useSceneObjectLifecycle } from "./use-scene-object-lifecycle";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function setup() {
  const objects = [
    { id: "parent", parent_id: null, library_asset_id: "shared-asset" },
    { id: "child", parent_id: "parent", library_asset_id: "shared-asset" },
    { id: "leaf", parent_id: "child", library_asset_id: "shared-asset" },
    { id: "survivor", parent_id: null, library_asset_id: "other-asset" },
  ] as SceneObject[];
  let saved = objects;
  let fail = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (fail)
        return new Response(JSON.stringify({ detail: "Cannot remove" }), {
          status: 409,
        });
      if (init?.method === "DELETE") {
        saved = saved.filter((object) => object.id !== "leaf");
        return new Response(null, { status: 204, headers: { ETag: '"2"' } });
      }
      if (init?.method === "POST") {
        const { asset_ids: assets } = JSON.parse(String(init.body)) as {
          asset_ids: string[];
        };
        saved = saved.filter(
          (object) =>
            object.library_asset_id === null ||
            !assets.includes(object.library_asset_id),
        );
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(saved), {
        headers: { ETag: '"2"', "Content-Type": "application/json" },
      });
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <ResourceScopeProvider projectId="lifecycle-test">
        <EditorStoreProvider store={store}>
          <EditorActionsProvider actions={actions}>
            {children}
          </EditorActionsProvider>
        </EditorStoreProvider>
      </ResourceScopeProvider>
    </QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      useSceneObjectLifecycle();
      return {
        remove: useSceneObjectActions(),
        removeAssets: useDeleteLibraryAssets(),
      };
    },
    { wrapper },
  );
  await waitFor(() =>
    expect(
      client.getQueryState(getListSceneObjectsQueryKey("lifecycle-test"))
        ?.status,
    ).toBe("success"),
  );
  return {
    ...hook,
    client,
    store,
    actions,
    fail: () => {
      fail = true;
    },
    replace: (next: SceneObject[]) => {
      saved = next;
      fail = false;
    },
    refresh: () =>
      client.invalidateQueries({
        queryKey: getListSceneObjectsQueryKey("lifecycle-test"),
      }),
    objects,
  };
}

it("clears a deleted instance without clearing another instance's hover or widget mode", async () => {
  const test = await setup();
  test.actions.hoverObject({ id: "survivor" });
  test.actions.selectObject({ id: "leaf" });
  test.actions.setSceneWidget("rotation");
  await act(async () =>
    test.result.current.remove.mutateAsync({ type: "remove", cloudId: "leaf" }),
  );
  expect(test.store.getState().sceneInteraction).toEqual({
    hoveredObjectId: "survivor",
    selectedObjectId: null,
    widget: "rotation",
  });
});

it("clears every removed descendant after library bulk deletion", async () => {
  const test = await setup();
  test.actions.hoverObject({ id: "parent" });
  test.actions.selectObject({ id: "leaf" });
  await act(async () =>
    test.result.current.removeAssets.mutateAsync(["shared-asset"]),
  );
  await waitFor(() =>
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBeNull(),
  );
  expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
  test.actions.selectObject({ id: "survivor" });
  await act(async () => test.refresh());
  expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
    "survivor",
  );
});

it("does not clear selection on failed deletion, failed reads, visibility or transform changes", async () => {
  const test = await setup();
  test.actions.hoverObject({ id: "leaf" });
  test.actions.selectObject({ id: "leaf" });
  test.fail();
  await act(async () => {
    await expect(
      test.result.current.remove.mutateAsync({
        type: "remove",
        cloudId: "leaf",
      }),
    ).rejects.toThrow("Cannot remove");
  });
  expect(test.store.getState().sceneInteraction.selectedObjectId).toBe("leaf");
  expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe("leaf");
  test.replace(
    test.objects.map((object) => ({
      ...object,
      visible: false,
      position: [3, 4, 5],
    })),
  );
  await act(async () => test.refresh());
  expect(test.store.getState().sceneInteraction.selectedObjectId).toBe("leaf");
  test.replace([]);
  await act(async () => test.refresh());
  await waitFor(() =>
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBeNull(),
  );
  expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
});

it("keeps IDs owned by anchors or the trajectory when model snapshots change", async () => {
  const test = await setup();
  test.actions.hoverObject({ id: "anchor:a" });
  test.actions.selectObject({ id: "trajectory" });
  test.replace([]);
  await act(async () => test.refresh());
  expect(test.store.getState().sceneInteraction).toMatchObject({
    hoveredObjectId: "anchor:a",
    selectedObjectId: "trajectory",
  });
});
