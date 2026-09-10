// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { Object3D } from "three";
import { describe, expect, it, vi } from "vitest";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";
import { SceneSurfaceProvider } from "./scene-surface-provider";
import { useGaussianCloud } from "./use-gaussian-cloud";

const source = { kind: "url", url: "/cloud.ply" } as const;

function createInstance(): GaussianCloudInstance {
  return {
    bounds: null,
    dispose: vi.fn(),
    getHit: vi.fn(),
    object: new Object3D(),
    setRaycastable: vi.fn(),
  };
}

function createWrapper(backend: GaussianRenderingBackend) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StrictMode>
        <SceneSurfaceProvider backend={backend}>{children}</SceneSurfaceProvider>
      </StrictMode>
    );
  };
}

describe("useGaussianCloud", () => {
  it("shares the Strict Mode load and updates raycastability without recreating", async () => {
    const instance = createInstance();
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn().mockResolvedValue(instance),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { rerender, result } = renderHook(
      ({ raycastable }) => useGaussianCloud({ raycastable, source }),
      {
        initialProps: { raycastable: false },
        wrapper: createWrapper(backend),
      },
    );

    expect(result.current).toEqual([null, true, null]);
    await act(async () => {
      await Promise.resolve();
    });
    rerender({ raycastable: true });

    expect(result.current).toEqual([instance, false, null]);
    expect(backend.createCloud).toHaveBeenCalledOnce();
    expect(backend.createCloud).toHaveBeenCalledWith(source, {
      name: undefined,
    });
    expect(instance.setRaycastable).toHaveBeenNthCalledWith(1, false);
    expect(instance.setRaycastable).toHaveBeenLastCalledWith(true);
  });

  it("reuses an in-flight load during the Strict Mode effect probe", async () => {
    const instance = createInstance();
    let resolveCloud: ((instance: GaussianCloudInstance) => void) | undefined;
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn(() => new Promise<GaussianCloudInstance>((resolve) => {
        resolveCloud = resolve;
      })),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { result, unmount } = renderHook(
      () => useGaussianCloud({ raycastable: false, source }),
      { wrapper: createWrapper(backend) },
    );

    expect(backend.createCloud).toHaveBeenCalledOnce();

    await act(async () => {
      resolveCloud?.(instance);
      await Promise.resolve();
    });

    expect(result.current).toEqual([instance, false, null]);
    expect(instance.dispose).not.toHaveBeenCalled();

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(instance.dispose).toHaveBeenCalledOnce();
  });

  it("returns a load error", async () => {
    const error = new Error("failed");
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn().mockRejectedValue(error),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { result } = renderHook(
      () => useGaussianCloud({ raycastable: false, source }),
      { wrapper: createWrapper(backend) },
    );

    expect(result.current).toEqual([null, true, null]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual([null, false, error]);
  });
});
