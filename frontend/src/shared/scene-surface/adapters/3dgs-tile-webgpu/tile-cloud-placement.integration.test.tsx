// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { createRoot, extend } from "@react-three/fiber";
import { act, useEffect } from "react";
import {
  EditorStoreProvider,
  useSetActiveEditorTool,
} from "@/features/project-editor";
import { useAnchorPlacement } from "@/widgets/scene-editor/ui/use-anchor-placement";
import { GaussianStore, WasmGaussianBackend } from "3dgs-tile-webgpu";
import {
  GridHelper,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";
import { afterEach, expect, it, vi } from "vitest";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import { SceneSurfaceProvider } from "@/shared/scene-surface";
import type { GaussianRenderingBackend } from "@/shared/scene-surface/model/gaussian-rendering-backend";
import { TileGaussianCloudInstance } from "@/shared/scene-surface/adapters/3dgs-tile-webgpu/tile-gaussian-cloud-instance";
import { SceneGrid } from "@/widgets/scene-editor/ui/scene-grid";
import { SceneClouds } from "@/widgets/scene-editor/ui/scene-clouds";
import { raycastPlacementSurfaces } from "@/widgets/scene-editor/ui/raycast-placement-surfaces";
import { createRenderPipelineEvents } from "@/shared/three/create-render-pipeline-events";
import { configureInteractiveRaycasterLayers } from "@/shared/three/configure-interactive-raycaster-layers";
import type { PlacementPreview } from "@/widgets/scene-editor/ui/use-cloud-placement-interaction";

// SceneGrid must use its WebGPU pre-splat layer, without creating a GPU renderer.
vi.mock("@/shared/three", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/three")>()),
  useOptionalRenderPipeline: () => ({}),
}));

// Exercise the renderer's real Rust parser, mipmap snapshot and alpha raycast, without a GPU.
const ply = new TextEncoder().encode(
  `ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nproperty float opacity\nproperty float scale_0\nproperty float scale_1\nproperty float scale_2\nproperty float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\nproperty float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\nend_header\n0 0 0 4 -2 -2 -2 1 0 0 0 0 0 0\n`,
);
const sog = new Uint8Array(
  readFileSync(
    "src/shared/scene-surface/adapters/3dgs-tile-webgpu/fixtures/single.sog",
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  { format: "ply", bytes: ply },
  { format: "sog", bytes: sog },
])(
  "keeps second and third $format clouds pickable through preview handoff, transforms and removal",
  async ({ format, bytes }) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    // Node streaming compilation rejects Happy DOM Responses from another realm.
    // Compile the same WASM bytes directly while exercising the real Rust engine.
    vi.spyOn(WebAssembly, "instantiateStreaming").mockImplementation(
      async (source, imports) =>
        WebAssembly.instantiate(await (await source).arrayBuffer(), imports),
    );
    extend({
      Group,
      GridHelper,
      LineBasicMaterial,
      Mesh,
      MeshBasicMaterial,
      PlaneGeometry,
    });
    const store = new GaussianStore(new WasmGaussianBackend({}));
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn(async (_source, options) => {
        const cloud = await store.loadBuffer(bytes.slice().buffer, {
          fileName: `cloud.${format}`,
          name: options?.name,
          mipmaps: { type: "standard", snapshot: { maxLeaves: 25000 } },
        });
        return new TileGaussianCloudInstance(
          cloud,
          store.getBounds(cloud),
          () => undefined,
        );
      }),
      createHighlightVolume: vi.fn(),
      invalidate: vi.fn(),
      dispose: () => store.dispose(),
    };
    const canvas = document.createElement("canvas");
    const scene = new Scene();
    const root = createRoot(canvas);
    root.configure({
      scene,
      events: createRenderPipelineEvents,
      onCreated: (state) =>
        configureInteractiveRaycasterLayers(state.raycaster),
      frameloop: "never",
      size: { width: 100, height: 100, top: 0, left: 0 },
      gl: {
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        domElement: canvas,
      } as unknown as WebGLRenderer,
    });
    const ready = vi.fn();
    const anchorPick = vi.fn();
    const onPlaceAnchor = vi.fn();
    let anchorPlacement: ReturnType<typeof useAnchorPlacement>;
    let setAnchorTool: ReturnType<typeof useSetActiveEditorTool>;
    const asset: LibraryAsset = {
      id: "asset",
      created_at: "",
      format: format as "ply" | "sog",
      size_bytes: bytes.byteLength,
      status: "ready",
      download_url: `/one.${format}`,
      name: "cloud",
      default_rotation_deg: [0, 0, 0],
      default_scale: 1,
      default_offset: [0, 0, 0],
    };
    const clouds: ProjectCloud[] = [];
    const keys = new Map<string, string>();
    let preview: PlacementPreview | null = null;
    let placed: PlacementPreview | null = null;
    let showGrid = false;
    let state: ReturnType<typeof root.render> | undefined;
    function AnchorScene() {
      const setTool = useSetActiveEditorTool();
      setAnchorTool = setTool;
      useEffect(() => setTool("anchor"), [setTool]);
      anchorPlacement = useAnchorPlacement({ onPlace: onPlaceAnchor });
      return (
        <>
          <SceneClouds
            clouds={[...clouds]}
            preview={preview}
            placed={placed}
            resourceKeyForCloud={(id) => keys.get(id)}
            interactive
            surfaceEvents={{
              ...anchorPlacement.surfaceEventProps,
              onSurfacePointerDown: (hit, event) => {
                anchorPick(hit, event);
                anchorPlacement.surfaceEventProps.onSurfacePointerDown(
                  hit,
                  event,
                );
              },
            }}
            onReady={ready}
            onLoading={vi.fn()}
            onError={vi.fn()}
          />
          {showGrid && (
            <SceneGrid
              dark={false}
              interactive
              placementEvents={anchorPlacement.surfaceEventProps}
            />
          )}
        </>
      );
    }
    async function renderScene() {
      await act(async () => {
        state = root.render(
          <EditorStoreProvider>
            <SceneSurfaceProvider backend={backend}>
              <AnchorScene />
            </SceneSurfaceProvider>
          </EditorStoreProvider>,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      // Rust/WASM initialization and decoding can finish after the first React commit.
      await act(async () => {
        await Promise.all(
          vi.mocked(backend.createCloud).mock.results.map(({ value }) => value),
        );
      });
    }
    function hit(x: number) {
      const raycaster = new Raycaster(
        new Vector3(x, 0, 5),
        new Vector3(0, 0, -1),
      );
      scene.updateMatrixWorld(true);
      return raycaster.intersectObjects(scene.children, true)[0];
    }
    async function pickAnchor(x: number, pointerType = "mouse", cloudHits = 1) {
      await act(async () => setAnchorTool("anchor"));
      const camera = state!.getState().camera;
      camera.updateWorldMatrix(true, false);
      const screenPoint = new Vector3(x, 0, 0).project(camera);
      async function pointer(
        type: "onPointerMove" | "onPointerDown" | "onPointerUp",
      ) {
        const event = new PointerEvent(type.slice(2).toLowerCase(), {
          pointerId: 1,
          pointerType,
          ctrlKey: true,
          clientX: (screenPoint.x + 1) * 50,
          clientY: (1 - screenPoint.y) * 50,
        });
        Object.defineProperties(event, {
          offsetX: { value: event.clientX },
          offsetY: { value: event.clientY },
          target: { value: canvas },
        });
        await act(async () => state!.getState().events.handlers![type](event));
      }
      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
      anchorPick.mockClear();
      onPlaceAnchor.mockClear();
      await pointer("onPointerMove");
      const hoverHit = anchorPlacement.previewHit;
      expect(hoverHit).not.toBeNull();
      await pointer("onPointerDown");
      expect(anchorPick).toHaveBeenCalledTimes(cloudHits);
      await pointer("onPointerUp");
      expect(onPlaceAnchor).toHaveBeenCalledExactlyOnceWith(
        hoverHit!.position,
        hoverHit!.normal,
      );
    }
    try {
      clouds.push({
        id: "first",
        name: "first",
        position: 0,
        project_id: "project",
        library_asset_id: asset.id,
        download_url: asset.download_url!,
        translation: [0, 0, 0],
        rotation_deg: [0, 0, 0],
        scale: 1,
        offset: [0, 0, 0],
        visible: true,
      } as ProjectCloud);
      await renderScene();
      expect(hit(0)).toBeDefined();
      for (const [index, x] of [
        [2, 2],
        [3, 4],
      ]) {
        preview = {
          asset,
          hit: { position: [x, 0, 0], normal: [0, 1, 0] },
          resourceKey: `placement-${index}`,
        };
        await renderScene();
        const object = store.clouds[index - 1];
        expect(object.getRaycastIndex()).not.toBeNull();
        // The preview is rendered, but never targets itself during placement.
        expect(
          raycastPlacementSurfaces(
            scene,
            new Raycaster(new Vector3(x, 0, 5), new Vector3(0, 0, -1)),
          ),
        ).toBeNull();
        placed = preview;
        preview = null;
        await renderScene();
        const id = `cloud-${index}`;
        keys.set(id, placed.resourceKey);
        clouds.push({
          ...clouds[0],
          id,
          translation: [x, 0, 0],
          rotation_deg: [0, 35, 0],
          scale: 2,
          offset: [0.1, 0, 0],
        });
        await renderScene();
        placed = null;
        await renderScene();
        expect(store.clouds[index - 1]).toBe(object);
        expect(hit(x)?.object).toBe(object);
        expect(state!.getState().internal.interaction).toContain(object);
        expect((object as unknown as { __r3f?: unknown }).__r3f).toBeDefined();
        // Dispatch through R3F too: anchors use surface events rather than the
        // placement raycaster. Keeping the BVH alone would not catch this bug.
        await pickAnchor(x);
        expect(ready).toHaveBeenCalledWith(id, expect.anything());
        expect(
          raycastPlacementSurfaces(
            scene,
            new Raycaster(new Vector3(x, 0, 5), new Vector3(0, 0, -1)),
          ),
        ).not.toBeNull();
      }
      // With another cloud behind the last one, the nearest surface owns the tap.
      clouds[0] = { ...clouds[0], translation: [4, 0, -1] };
      await renderScene();
      state!.getState().camera.position.x = 4;
      state!.getState().camera.lookAt(4, 0, 0);
      scene.updateMatrixWorld(true);
      await pickAnchor(4);
      expect(anchorPick.mock.calls[0][0].position[2]).toBeGreaterThan(-0.5);
      showGrid = true;
      // Look down through two clouds and the grid; hover and tap must agree.
      clouds[0] = { ...clouds[0], translation: [4, 1, 0] };
      clouds[2] = { ...clouds[2], translation: [4, 2, 0] };
      await renderScene();
      state!.getState().camera.position.set(4, 5, 0);
      state!.getState().camera.lookAt(4, 0, 0);
      scene.updateMatrixWorld(true);
      await pickAnchor(4);
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeGreaterThan(1.5);
      await pickAnchor(4, "touch");
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeGreaterThan(1.5);
      // The grid is physically closer but is composited underneath the splats.
      clouds[0] = { ...clouds[0], translation: [4, -2, 0] };
      clouds[2] = { ...clouds[2], translation: [4, -1, 0] };
      await renderScene();
      scene.updateMatrixWorld(true);
      await pickAnchor(4);
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeLessThan(-0.5);
      await pickAnchor(4, "touch");
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeLessThan(-0.5);
      expect(
        raycastPlacementSurfaces(scene, state!.getState().raycaster)
          ?.position[1],
      ).toBeLessThan(-0.5);
      // With no visible splats under the pointer, the grid still accepts anchors.
      clouds[0] = { ...clouds[0], visible: false };
      clouds[2] = { ...clouds[2], visible: false };
      await renderScene();
      scene.updateMatrixWorld(true);
      await pickAnchor(4, "mouse", 0);
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeCloseTo(0);
      await pickAnchor(4, "touch", 0);
      expect(onPlaceAnchor.mock.calls[0][0][1]).toBeCloseTo(0);
      expect(backend.createCloud).toHaveBeenCalledTimes(3);
      showGrid = false;
      clouds[0] = { ...clouds[0], translation: [4, 0, -1], visible: true };
      clouds[2] = { ...clouds[2], translation: [4, 0, 0], visible: true };
      clouds.splice(1, 1);
      await renderScene();
      expect(hit(2)).toBeUndefined();
      expect(store.clouds).toHaveLength(2);
      expect(hit(4)).toBeDefined();
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  },
);
