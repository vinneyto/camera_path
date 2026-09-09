// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { Object3D } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "../model/gaussian-rendering-backend";
import { useGaussianCloud } from "./use-gaussian-cloud";

const source = { kind: "url", url: "/cloud.ply" } as const;

describe("useGaussianCloud", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates raycastability without recreating the cloud", async () => {
    vi.useFakeTimers();
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
      await vi.runAllTimersAsync();
    });
    rerender({ raycastable: true });

    expect(backend.createCloud).toHaveBeenCalledOnce();
    expect(backend.createCloud).toHaveBeenCalledWith(source, {
      name: undefined,
    });
    expect(instance.setRaycastable).toHaveBeenNthCalledWith(1, false);
    expect(instance.setRaycastable).toHaveBeenLastCalledWith(true);
  });
});
