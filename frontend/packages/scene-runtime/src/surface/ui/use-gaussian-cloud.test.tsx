// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { Object3D } from "three";
import { describe, expect, it, vi } from "vitest";

import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import { SceneSurfaceProvider } from "@camera-path/scene-runtime/surface/ui/scene-surface-provider";
import { useGaussianCloud } from "@camera-path/scene-runtime/surface/ui/use-gaussian-cloud";

const source = { kind: "url", url: "/cloud.ply" } as const;

function createInstance(): GaussianCloudInstance {
  return {
    bounds: null,
    dispose: vi.fn(),
    getHit: vi.fn(),
    object: new Object3D(),
  };
}

function createWrapper(backend: GaussianRenderingBackend) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <StrictMode>
        <SceneSurfaceProvider backend={backend}>
          {children}
        </SceneSurfaceProvider>
      </StrictMode>
    );
  };
}

describe("useGaussianCloud", () => {
  it("shares the Strict Mode load without recreating", async () => {
    const instance = createInstance();
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn().mockResolvedValue(instance),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { result } = renderHook(() => useGaussianCloud({ source }), {
      wrapper: createWrapper(backend),
    });

    expect(result.current).toEqual([null, true, null, null]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toEqual([instance, false, null, null]);
    expect(backend.createCloud).toHaveBeenCalledOnce();
    expect(backend.createCloud).toHaveBeenCalledWith(source, {
      name: undefined,
      worldMatrix: undefined,
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    });
  });

  it("reuses an in-flight load during the Strict Mode effect probe", async () => {
    const instance = createInstance();
    let resolveCloud: ((instance: GaussianCloudInstance) => void) | undefined;
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn(
        () =>
          new Promise<GaussianCloudInstance>((resolve) => {
            resolveCloud = resolve;
          }),
      ),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { result, unmount } = renderHook(() => useGaussianCloud({ source }), {
      wrapper: createWrapper(backend),
    });

    expect(backend.createCloud).toHaveBeenCalledOnce();

    await act(async () => {
      resolveCloud?.(instance);
      await Promise.resolve();
    });

    expect(result.current).toEqual([instance, false, null, null]);
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
    const { result } = renderHook(() => useGaussianCloud({ source }), {
      wrapper: createWrapper(backend),
    });

    expect(result.current).toEqual([null, true, null, null]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual([null, false, error, null]);
  });

  it("uses the latest progress callback without reacquiring and unsubscribes on removal", async () => {
    let options: GaussianCloudOptions | undefined;
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn((_source, loadOptions) => {
        options = loadOptions;
        return new Promise<GaussianCloudInstance>(() => {});
      }),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const first = vi.fn(),
      next = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onProgress }) => useGaussianCloud({ source, onProgress }),
      { initialProps: { onProgress: first }, wrapper: createWrapper(backend) },
    );
    const progress = {
      phase: "download" as const,
      fraction: 0.5,
      loadedBytes: 5,
      totalBytes: 10,
    };
    act(() => options?.onProgress?.(progress));
    expect(first).toHaveBeenCalledOnce();
    rerender({ onProgress: next });
    act(() => options?.onProgress?.({ ...progress, loadedBytes: 6 }));
    expect(next).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
    expect(backend.createCloud).toHaveBeenCalledOnce();
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    options?.onProgress?.({ ...progress, loadedBytes: 7 });
    expect(next).toHaveBeenCalledOnce();
    expect(options?.signal?.aborted).toBe(true);
  });
});
