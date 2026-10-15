// @vitest-environment happy-dom

import { ProjectCloudSurface } from "@camera-path/feature-scene-models/scene/project-cloud-surface";
import { SceneSurfaceProvider } from "@camera-path/scene-runtime/surface";
import type { GaussianCloudLoadProgress } from "@camera-path/scene-runtime/surface/model/gaussian-cloud-load-progress";
import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type { ProjectCloud } from "@camera-path/types/api";
import { createRoot, extend } from "@react-three/fiber";
import { act } from "react";
import { Group, Object3D, Scene, type WebGLRenderer } from "three";
import { afterEach, expect, it, vi } from "vitest";

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
  const cloud: ProjectCloud = {
    id: "cloud",
    name: "Cloud",
    project_id: "project",
    library_asset_id: "asset",
    position: 0,
    download_url: "/cloud.sog",
    format: "sog",
    visible: true,
    translation: [0, 0, 0],
    rotation_deg: [0, 0, 0],
    scale: 1,
    offset: [0, 0, 0],
  };
  const canvas = document.createElement("canvas");
  const root = createRoot(canvas);
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
        <SceneSurfaceProvider backend={backend}>
          <ProjectCloudSurface
            cloud={cloud}
            onReady={ready}
            onProgress={progress}
          />
        </SceneSurfaceProvider>,
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
        // passive effect that performs another update in ProjectCloudSurface.
        expect(progress.mock.calls.at(-1)?.[0].loadedBytes).toBe(loadedBytes);
      });
    }
    await act(async () => {
      resolveCloud?.({
        object: new Object3D(),
        bounds: { center: [0, 0, 0], radius: 1 },
        getHit: vi.fn(),
        dispose: vi.fn(),
      });
    });
    expect(ready).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledTimes(150);
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
