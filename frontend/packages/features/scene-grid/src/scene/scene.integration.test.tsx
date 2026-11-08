// @vitest-environment happy-dom
import { createEditorActions } from "@camera-path/actions";
import {
  configureInteractiveRaycasterLayers,
  SELECTABLE,
  RENDER_PIPELINE_DECORATION_LAYER,
} from "@camera-path/render-pipeline";
import { findHoveredSceneObject } from "@camera-path/scene-runtime/interaction/find-hovered-scene-object";
import { findInteractiveSceneObject } from "@camera-path/scene-runtime/interaction/find-interactive-scene-object";
import { SceneObject } from "@camera-path/scene-runtime/interaction/scene-object";
import { raycastPlacementSurfaces } from "@camera-path/scene-runtime/picking/raycast-placement-surfaces";
import {
  SceneServicesProvider,
  type SceneServices,
} from "@camera-path/scene-runtime/viewport/scene-services-provider";
import {
  createEditorStore,
  createUserSettingsStore,
  EditorStoreProvider,
  UserSettingsStoreProvider,
} from "@camera-path/store";
import { createRoot, extend } from "@react-three/fiber";
import { act } from "react";
import {
  BoxGeometry,
  GridHelper,
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";
import { expect, it, vi } from "vitest";
import { SceneGrid } from "./scene";

vi.mock("@camera-path/scene-runtime/viewport/use-surface-events", () => ({
  useSurfaceEvents: () => ({}),
}));

const renderer = vi.hoisted(() => ({ webgpu: false }));
vi.mock("@camera-path/render-pipeline", async (original) => ({
  ...(await original<typeof import("@camera-path/render-pipeline")>()),
  useOptionalRenderPipeline: () => (renderer.webgpu ? {} : null),
}));

it.each([false, true])(
  "isolates the grid from picking outside placement (WebGPU=%s)",
  async (webgpu) => {
    renderer.webgpu = webgpu;
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    extend({
      BoxGeometry,
      GridHelper,
      Group,
      LineBasicMaterial,
      Mesh,
      MeshBasicMaterial,
      PlaneGeometry,
    });
    const store = createEditorStore();
    const settings = createUserSettingsStore();
    const actions = createEditorActions(store);
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(0, 2, 4);
    camera.lookAt(0, -0.3, 0);
    const canvas = document.createElement("canvas");
    const root = createRoot(canvas);
    await root.configure({
      scene,
      camera,
      frameloop: "never",
      size: { width: 100, height: 100, top: 0, left: 0 },
      gl: {
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        domElement: canvas,
      } as unknown as WebGLRenderer,
    });
    async function render(interactive = true) {
      await act(async () => {
        root.render(
          <UserSettingsStoreProvider store={settings}>
            <EditorStoreProvider store={store}>
              <SceneServicesProvider
                value={{ interactive, dark: true } as SceneServices}
              >
                <SceneGrid />
                <SceneObject sceneObjectID="chair">
                  {() => (
                    <mesh position={[0, -0.3, 0]}>
                      <boxGeometry args={[1, 0.1, 1]} />
                      <meshBasicMaterial />
                    </mesh>
                  )}
                </SceneObject>
              </SceneServicesProvider>
            </EditorStoreProvider>
          </UserSettingsStoreProvider>,
        );
      });
    }
    const raycaster = new Raycaster(
      camera.position,
      new Vector3(0, -0.3, 0).sub(camera.position).normalize(),
    );
    configureInteractiveRaycasterLayers(raycaster);
    function intersections() {
      scene.updateMatrixWorld(true);
      return raycaster.intersectObjects(scene.children, true);
    }
    try {
      await render();
      const plane = scene
        .getObjectsByProperty("type", "Mesh")
        .find((object) => (object as Mesh).geometry.type === "PlaneGeometry")!;
      const grid = scene.getObjectByProperty("type", "GridHelper")!;
      expect(plane.layers.isEnabled(RENDER_PIPELINE_DECORATION_LAYER)).toBe(
        true,
      );
      expect(grid.layers.isEnabled(RENDER_PIPELINE_DECORATION_LAYER)).toBe(
        true,
      );
      expect(raycaster.layers.test(plane.layers)).toBe(false);
      expect(raycaster.layers.test(grid.layers)).toBe(false);
      expect(
        findHoveredSceneObject(intersections())?.userData.sceneObjectID,
      ).toBe("chair");
      expect(
        findInteractiveSceneObject(intersections(), SELECTABLE)?.userData
          .sceneObjectID,
      ).toBe("chair");
      expect(raycastPlacementSurfaces(scene, raycaster)).toBeNull();
      for (const tool of ["anchor", "cloud"] as const) {
        await act(async () => actions.setActiveTool(tool));
        expect(raycaster.layers.test(plane.layers)).toBe(true);
        expect(raycaster.layers.test(grid.layers)).toBe(false);
        const hit = intersections()[0];
        expect(hit.object.userData.sceneSurfacePickable).toBe(true);
        expect(hit.point.y).toBeCloseTo(0);
        expect(
          raycastPlacementSurfaces(scene, raycaster)?.position[1],
        ).toBeCloseTo(0);
        await act(async () => actions.setActiveTool(null));
        expect(raycaster.layers.test(plane.layers)).toBe(false);
        expect(
          findHoveredSceneObject(intersections())?.userData.sceneObjectID,
        ).toBe("chair");
        expect(
          findInteractiveSceneObject(intersections(), SELECTABLE)?.userData
            .sceneObjectID,
        ).toBe("chair");
        expect(raycastPlacementSurfaces(scene, raycaster)).toBeNull();
      }
      await act(async () => actions.setActiveTool("anchor-height"));
      expect(
        findHoveredSceneObject(intersections())?.userData.sceneObjectID,
      ).toBe("chair");
      await act(async () => actions.setActiveTool("cloud"));
      await render(false);
      expect(
        findHoveredSceneObject(intersections())?.userData.sceneObjectID,
      ).toBe("chair");
      expect(raycastPlacementSurfaces(scene, raycaster)).toBeNull();
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  },
);
