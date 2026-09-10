import { Object3D } from "three";
import { describe, expect, it, vi } from "vitest";

import type {
  GaussianCloudInstance,
  GaussianRenderingBackend,
} from "./gaussian-rendering-backend";
import { GaussianCloudResourceCache } from "./gaussian-cloud-resource-cache";

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

function createBackend(
  instance: GaussianCloudInstance,
): GaussianRenderingBackend {
  return {
    container: null,
    createCloud: vi.fn().mockResolvedValue(instance),
    createHighlightVolume: vi.fn(),
    dispose: vi.fn(),
    invalidate: vi.fn(),
  };
}

describe("GaussianCloudResourceCache", () => {
  it("shares a cloud creation between matching consumers", () => {
    const instance = createInstance();
    const backend = createBackend(instance);
    const cache = new GaussianCloudResourceCache(backend);

    const first = cache.acquire(source, { name: "Cloud" });
    const second = cache.acquire({ ...source }, { name: "Cloud" });

    expect(first.promise).toBe(second.promise);
    expect(backend.createCloud).toHaveBeenCalledOnce();
  });

  it("keeps the cloud alive when Strict Mode immediately reacquires it", async () => {
    const instance = createInstance();
    const backend = createBackend(instance);
    const cache = new GaussianCloudResourceCache(backend);

    const first = cache.acquire(source);
    first.release();
    const second = cache.acquire(source);
    await Promise.resolve();

    expect(second.promise).toBe(first.promise);
    expect(instance.dispose).not.toHaveBeenCalled();
    expect(backend.createCloud).toHaveBeenCalledOnce();
  });

  it("disposes the cloud after its final consumer releases it", async () => {
    const instance = createInstance();
    const cache = new GaussianCloudResourceCache(createBackend(instance));

    const lease = cache.acquire(source);
    lease.release();
    await Promise.resolve();
    await lease.promise;

    expect(instance.dispose).toHaveBeenCalledOnce();
  });

  it("retries creation after a rejected request", async () => {
    const instance = createInstance();
    const backend = createBackend(instance);
    vi.mocked(backend.createCloud)
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(instance);
    const cache = new GaussianCloudResourceCache(backend);

    const first = cache.acquire(source);
    await expect(first.promise).rejects.toThrow("failed");
    const second = cache.acquire(source);

    await expect(second.promise).resolves.toBe(instance);
    expect(backend.createCloud).toHaveBeenCalledTimes(2);
  });
});
