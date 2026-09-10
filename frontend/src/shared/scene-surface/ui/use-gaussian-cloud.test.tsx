// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { Object3D } from "three";
import { describe, expect, it, vi } from "vitest";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";
import { useGaussianCloud } from "./use-gaussian-cloud";

const source = { kind: "url", url: "/cloud.ply" } as const;

describe("useGaussianCloud", () => {
  it("updates raycastability without recreating the cloud", async () => {
    const instance: GaussianCloudInstance = {
      bounds: null,
      dispose: vi.fn(),
      getHit: vi.fn(),
      object: new Object3D(),
      setRaycastable: vi.fn(),
    };
    const backend: GaussianRenderingBackend = {
      container: null,
      createCloud: vi.fn().mockResolvedValue(instance),
      createHighlightVolume: vi.fn(),
      dispose: vi.fn(),
      invalidate: vi.fn(),
    };
    const { rerender } = renderHook(
      ({ raycastable }) => useGaussianCloud({
        backend,
        raycastable,
        source,
      }),
      { initialProps: { raycastable: false } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    rerender({ raycastable: true });

    expect(backend.createCloud).toHaveBeenCalledOnce();
    expect(backend.createCloud).toHaveBeenCalledWith(source, {
      name: undefined,
    });
    expect(instance.setRaycastable).toHaveBeenNthCalledWith(1, false);
    expect(instance.setRaycastable).toHaveBeenLastCalledWith(true);
  });

  it("reuses an in-flight load during the Strict Mode effect probe", async () => {
    const instance: GaussianCloudInstance = {
      bounds: null,
      dispose: vi.fn(),
      getHit: vi.fn(),
      object: new Object3D(),
      setRaycastable: vi.fn(),
    };
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
    const wrapper = ({ children }: PropsWithChildren) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result, unmount } = renderHook(() => useGaussianCloud({
      backend,
      raycastable: false,
      source,
    }), { wrapper });

    expect(backend.createCloud).toHaveBeenCalledOnce();

    await act(async () => {
      resolveCloud?.(instance);
      await Promise.resolve();
    });

    expect(result.current).toBe(instance);
    expect(instance.dispose).not.toHaveBeenCalled();

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(instance.dispose).toHaveBeenCalledOnce();
  });
});
