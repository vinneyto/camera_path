// @vitest-environment happy-dom

import { CloudSceneObject } from "@camera-path/feature-scene-models/scene/cloud-scene-object";
import { SceneSurfaceProvider } from "@camera-path/scene-runtime/surface";
import type { GaussianCloudLoadProgress } from "@camera-path/scene-runtime/surface/model/gaussian-cloud-load-progress";
import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type { SceneObject } from "@camera-path/types/api";
import { createRoot, extend } from "@react-three/fiber";
import { act } from "react";
import { Group, Matrix4, Object3D, Scene, type WebGLRenderer } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";

vi.mock("@camera-path/feature-scene-models/scene/cloud-loading-ring", () => ({
  CloudLoadingRing: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("loads a cloud through many streamed progress events without nested React updates", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  extend({ Group });
  let report: ((progress: GaussianCloudLoadProgress) => void) | undefined;
  let resolveCloud: ((cloud: GaussianCloudInstance) => void) | undefined;
  const backend: GaussianRenderingBackend = {
    container: null,
    createCloud: vi.fn((_source, options) => {
      report = options?.onProgress;
      return new Promise<GaussianCloudInstance>((resolve) => {
        resolveCloud = resolve;
      });
    }),
    createHighlightVolume: vi.fn(),
    invalidate: vi.fn(),
    dispose: vi.fn(),
  };
  const cloud: SceneObject = {
    id: "cloud",
    name: "Cloud",
    project_id: "project",
    library_asset_id: "asset",
    sort_order: 0,
    parent_id: null,
    library_asset_file_id: "main",
    download_url: "/cloud.sog",
    format: "sog",
    visible: true,
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };
  const canvas = document.createElement("canvas");
  const root = createRoot(canvas);
  const store = createEditorStore();
  await root.configure({
    scene: new Scene(),
    frameloop: "never",
    size: { width: 100, height: 100, top: 0, left: 0 },
    gl: {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement: canvas,
    } as unknown as WebGLRenderer,
  });
  const ready = vi.fn(),
    progress = vi.fn();
  try {
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <SceneSurfaceProvider backend={backend}>
            <CloudSceneObject
              cloud={cloud}
              worldMatrix={new Matrix4()}
              effectiveVisible={true}
              onReady={ready}
              onProgress={progress}
            />
          </SceneSurfaceProvider>
        </EditorStoreProvider>,
      );
    });
    for (let loadedBytes = 1; loadedBytes <= 150; loadedBytes++) {
      await act(async () => {
        report?.({
          phase: "download",
          fraction: loadedBytes / 200,
          loadedBytes,
          totalBytes: 200,
        });
        // Progress is a subscription event; forwarding it must not wait for a
        // passive effect that performs another update in CloudSceneObject.
        expect(progress.mock.calls.at(-1)?.[0].loadedBytes).toBe(loadedBytes);
      });
    }
    await act(async () => {
      resolveCloud?.({
        object: new Object3D(),
        bounds: { center: [0, 0, 0], radius: 1 },
        getHit: vi.fn(),
        setInteractionState: vi.fn(),
        dispose: vi.fn(),
      });
    });
    expect(ready).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledTimes(150);
    expect(backend.createCloud).toHaveBeenCalledOnce();
    await act(async () => {
      root.render(
        <EditorStoreProvider store={store}>
          <SceneSurfaceProvider backend={backend}>
            <CloudSceneObject
              cloud={cloud}
              worldMatrix={new Matrix4().makeTranslation(5, 0, 0)}
              effectiveVisible={true}
              onReady={ready}
              onProgress={progress}
            />
          </SceneSurfaceProvider>
        </EditorStoreProvider>,
      );
    });
    expect(ready.mock.calls.at(-1)?.[0].bounds.center).toEqual([5, 0, 0]);
    expect(backend.createCloud).toHaveBeenCalledOnce();

    expect(
      errors.mock.calls.filter(([message]) =>
        String(message).includes("Maximum update depth"),
      ),
    ).toEqual([]);
  } finally {
    await act(async () => root.unmount());
  }
});
