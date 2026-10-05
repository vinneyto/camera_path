// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from "three";
import type { PropsWithChildren } from "react";
import {
  EditorStoreProvider,
  useCloudPlacement,
} from "@/features/project-editor";
import type { LibraryAsset } from "@/shared/api/generated/model";
import { useCloudPlacementInteraction } from "./use-cloud-placement-interaction";
import { useCloudPlacementRaycast } from "./use-cloud-placement-raycast";

const view = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@react-three/fiber", () => ({ useThree: () => view.current }));
function wrapper({ children }: PropsWithChildren) {
  return <EditorStoreProvider>{children}</EditorStoreProvider>;
}
afterEach(cleanup);

describe("cloud placement canvas raycasts", () => {
  it.each(["mouse", "touch"])(
    "picks splats before the grid and uses the stationary origin fallback with %s",
    (pointerType) => {
      const scene = new Scene();
      const camera = new PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 5;
      const canvas = document.createElement("canvas");
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
      view.current = { scene, camera, gl: { domElement: canvas } };
      const onPlace = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(
        () => {
          const tool = useCloudPlacement();
          const placement = useCloudPlacementInteraction({
            onPlace,
            clouds: [],
          });
          useCloudPlacementRaycast(tool.pendingCloud !== null, placement);
          return { tool, placement };
        },
        { wrapper },
      );
      const asset = { id: "asset" } as LibraryAsset;
      function pointer(type: string, x = 50, y = 50) {
        act(() => {
          canvas.dispatchEvent(
            new PointerEvent(type, {
              pointerId: 1,
              pointerType,
              clientX: x,
              clientY: y,
              button: 0,
            }),
          );
        });
      }
      act(() => result.current.tool.start(asset));
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 0]);
      pointer("pointermove", 20, 20);
      pointer("pointermove", 80, 80);
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 0]);
      expect(onPlace).not.toHaveBeenCalled();
      // The grid participates through the same pickable-surface contract, on its render layer.
      const geometry = new PlaneGeometry(40, 40);
      const material = new MeshBasicMaterial({ side: DoubleSide });
      const grid = new Mesh(geometry, material);
      grid.layers.set(3);
      grid.userData.sceneSurfacePickable = true;
      scene.add(grid);
      const model = new Mesh(geometry, material);
      model.position.z = 2;
      model.userData.sceneSurfacePickable = true;
      scene.add(model);
      // A closer preview must not target itself.
      const preview = new Mesh(geometry, material);
      preview.position.z = 3;
      preview.userData.sceneSurfacePickable = false;
      scene.add(preview);
      pointer("pointermove");
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 2]);
      // The grid is drawn under splats even when its intersection is closer.
      grid.position.z = 4;
      pointer("pointermove");
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 2]);
      pointer("pointerdown");
      pointer("pointerup");
      expect(onPlace).toHaveBeenCalledExactlyOnceWith("asset", [0, 0, 2]);
      onPlace.mockClear();
      act(() => result.current.tool.start(asset));
      model.visible = false;
      pointer("pointermove");
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 4]);
      pointer("pointerdown");
      pointer("pointerup");
      expect(onPlace).toHaveBeenCalledExactlyOnceWith("asset", [0, 0, 4]);
      onPlace.mockClear();
      act(() => result.current.tool.start(asset));
      grid.position.z = -1;
      pointer("pointermove");
      expect(result.current.placement.preview?.hit.position).toEqual([
        0, 0, -1,
      ]);
      grid.visible = false;
      pointer("pointermove");
      expect(result.current.placement.preview?.hit.position).toEqual([0, 0, 0]);
      pointer("pointerdown");
      pointer("pointerup");
      expect(onPlace).toHaveBeenCalledExactlyOnceWith("asset", [0, 0, 0]);
      expect(result.current.tool.pendingCloud).toBeNull();
      geometry.dispose();
      material.dispose();
    },
  );

  it("does not confirm a drag or a cancelled pointer gesture", () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    view.current = {
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      gl: { domElement: canvas },
    };
    const onPlace = vi.fn();
    const { result } = renderHook(
      () => {
        const tool = useCloudPlacement();
        const placement = useCloudPlacementInteraction({ onPlace, clouds: [] });
        useCloudPlacementRaycast(tool.pendingCloud !== null, placement);
        return { tool, placement };
      },
      { wrapper },
    );
    act(() => result.current.tool.start({ id: "asset" } as LibraryAsset));
    for (const [type, x] of [
      ["pointerdown", 10],
      ["pointerup", 30],
      ["pointerdown", 10],
      ["pointercancel", 10],
      ["pointerup", 10],
    ] as const) {
      act(() =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            clientX: x,
            clientY: 10,
            button: 0,
          }),
        ),
      );
    }
    expect(onPlace).not.toHaveBeenCalled();
    act(() => result.current.tool.cancel());
    expect(result.current.placement.preview).toBeNull();
  });
});
