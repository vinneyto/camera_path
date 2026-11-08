// @vitest-environment happy-dom
import { createRoot, extend } from "@react-three/fiber";
import { SceneSurfaceProvider } from "@camera-path/scene-runtime/surface";
import type { GaussianRenderingBackend } from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import type { SceneObject } from "@camera-path/types/api";
import type {
  SceneObjectTransformDraft,
  SceneObjectTransformInteraction,
} from "@camera-path/types/scene-object-transform";
import { act } from "react";
import { Group, Object3D, Scene, Vector3, type WebGLRenderer } from "three";
import { expect, it, vi } from "vitest";
import { SceneClouds } from "./scene-clouds";

vi.mock("./cloud-loading-ring", () => ({ CloudLoadingRing: () => null }));

it("previews a parent's local transform on its descendants without reloading models, and restores on cancellation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({ Group });
  const instances = new Map<string, Object3D>();
  const backend: GaussianRenderingBackend = {
    container: null,
    createCloud: vi.fn(async (_source, options) => {
      const object = new Object3D();
      instances.set(options!.name!, object);
      return {
        object,
        bounds: { center: [0, 0, 0] as [number, number, number], radius: 1 },
        setInteractionState: vi.fn(),
        getHit: vi.fn(),
        dispose: vi.fn(),
      };
    }),
    invalidate: vi.fn(),
    createHighlightVolume: vi.fn(),
    dispose: vi.fn(),
  };
  const parent = {
    id: "parent",
    parent_id: null,
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [2, 3, 4],
    visible: true,
    download_url: "/same.ply",
    format: "ply",
    library_asset_id: "shared-asset",
  } as SceneObject;
  const child = {
    ...parent,
    id: "child",
    parent_id: "parent",
    position: [1, 0, 0],
    scale: [1, 1, 1],
  } as SceneObject;
  const clouds = [child, parent];
  const canvas = document.createElement("canvas");
  const scene = new Scene();
  const root = createRoot(canvas);
  const store = createEditorStore();
  await root.configure({
    scene,
    frameloop: "never",
    size: { width: 100, height: 100, top: 0, left: 0 },
    gl: {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement: canvas,
    } as unknown as WebGLRenderer,
  });
  const interaction: SceneObjectTransformInteraction = {
    preview: null,
    pending: false,
    begin: vi.fn(),
    change: vi.fn(),
    commit: vi.fn(),
    cancel: vi.fn(),
  };
  async function render(preview: SceneObjectTransformDraft | null) {
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <SceneSurfaceProvider backend={backend}>
            <SceneClouds
              clouds={clouds}
              preview={null}
              placed={null}
              resourceKeyForCloud={() => undefined}
              interactive={false}
              surfaceEvents={{}}
              transformInteraction={{ ...interaction, preview }}
              onReady={vi.fn()}
              onError={vi.fn()}
              onLoading={vi.fn()}
            />
          </SceneSurfaceProvider>
        </EditorStoreProvider>,
      );
    });
    scene.updateMatrixWorld(true);
  }
  try {
    await render(null);
    const logicalIds: string[] = [];
    scene.traverse((object) => {
      if (object.userData.sceneObjectID)
        logicalIds.push(object.userData.sceneObjectID);
    });
    expect(logicalIds.sort()).toEqual(["child", "parent"]);
    expect(logicalIds).not.toContain(parent.library_asset_id);
    expect(
      instances.get("child")!.getWorldPosition(new Vector3()).toArray(),
    ).toEqual([2, 0, 0]);
    await render({
      id: "parent",
      transform: { ...parent, position: [5, 0, 0] },
    });
    expect(
      instances.get("parent")!.getWorldPosition(new Vector3()).toArray(),
    ).toEqual([5, 0, 0]);
    expect(
      instances.get("child")!.getWorldPosition(new Vector3()).toArray(),
    ).toEqual([7, 0, 0]);
    await render({
      id: "parent",
      transform: { ...parent, quaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
    });
    expect(
      instances
        .get("child")!
        .getWorldPosition(new Vector3())
        .distanceTo(new Vector3(0, 2, 0)),
    ).toBeLessThan(1e-7);
    await render(null);
    expect(
      instances.get("child")!.getWorldPosition(new Vector3()).toArray(),
    ).toEqual([2, 0, 0]);
    expect(backend.createCloud).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
