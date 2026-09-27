// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import type { ThreeEvent } from "@react-three/fiber";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  EditorStoreProvider,
  useCloudPlacement,
} from "@/features/project-editor";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

import { useCloudPlacementInteraction } from "./use-cloud-placement-interaction";

function wrapper({ children }: PropsWithChildren) {
  return <EditorStoreProvider>{children}</EditorStoreProvider>;
}

describe("cloud placement", () => {
  it("previews a hit and creates the cloud only after the click", () => {
    const onPlace = vi.fn().mockResolvedValue(true);
    let clouds: ProjectCloud[] = [];
    const { result, rerender } = renderHook(
      () => ({
        placement: useCloudPlacementInteraction({ onPlace, clouds }),
        tool: useCloudPlacement(),
      }),
      { wrapper },
    );
    const asset = { id: "asset" } as LibraryAsset;
    const hit: SceneSurfaceHit = { position: [1, 2, 3], normal: [0, 1, 0] };
    const event = {
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
    } as unknown as ThreeEvent<PointerEvent>;

    act(() => result.current.tool.start(asset));
    act(() =>
      result.current.placement.surfaceEventProps.onSurfacePointerMove(
        hit,
        event,
      ),
    );
    expect(result.current.placement.preview?.hit.position).toEqual([1, 2, 3]);
    expect(onPlace).not.toHaveBeenCalled();
    act(() =>
      result.current.placement.surfaceEventProps.onSurfacePointerDown(
        hit,
        event,
      ),
    );
    act(() =>
      result.current.placement.surfaceEventProps.onSurfacePointerUp(hit, event),
    );
    expect(onPlace).toHaveBeenCalledExactlyOnceWith("asset", [1, 2, 3]);
    expect(result.current.tool.pendingCloud).toBeNull();
    expect(result.current.placement.placed?.hit.position).toEqual([1, 2, 3]);
    const resourceKey = result.current.placement.placed?.resourceKey;
    clouds = [
      {
        id: "new-cloud",
        library_asset_id: "asset",
        translation: [1, 2, 3],
      } as ProjectCloud,
    ];
    rerender();
    expect(result.current.placement.resourceKeyForCloud("new-cloud")).toBe(
      resourceKey,
    );
    act(() => result.current.placement.finishPlacement("new-cloud"));
    expect(result.current.placement.placed).toBeNull();
    expect(result.current.placement.resourceKeyForCloud("new-cloud")).toBe(
      resourceKey,
    );
  });

  it("cancels without creating an instance", () => {
    const onPlace = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(
      () => ({
        placement: useCloudPlacementInteraction({ onPlace, clouds: [] }),
        tool: useCloudPlacement(),
      }),
      { wrapper },
    );
    act(() => result.current.tool.start({ id: "asset" } as LibraryAsset));
    act(() => result.current.tool.cancel());
    expect(result.current.placement.preview).toBeNull();
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("removes the retained preview when saving the cloud fails", async () => {
    const onPlace = vi.fn().mockRejectedValue(new Error("failed"));
    const { result } = renderHook(
      () => ({
        placement: useCloudPlacementInteraction({ onPlace, clouds: [] }),
        tool: useCloudPlacement(),
      }),
      { wrapper },
    );
    const hit: SceneSurfaceHit = { position: [1, 2, 3], normal: [0, 1, 0] };
    const event = {
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
    } as unknown as ThreeEvent<PointerEvent>;

    act(() => result.current.tool.start({ id: "asset" } as LibraryAsset));
    act(() =>
      result.current.placement.surfaceEventProps.onSurfacePointerDown(
        hit,
        event,
      ),
    );
    await act(async () => {
      result.current.placement.surfaceEventProps.onSurfacePointerUp(hit, event);
      await Promise.resolve();
    });

    expect(result.current.placement.placed).toBeNull();
    expect(onPlace).toHaveBeenCalledExactlyOnceWith("asset", [1, 2, 3]);
  });
});
