import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebGPURenderer } from "three/webgpu";
import { installWebGpuDrawDiagnostics } from "./install-webgpu-draw-diagnostics";

describe("WebGPU draw diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports a missing GPU buffer with an immutable object snapshot and restores the draw", () => {
    const original = vi.fn();
    const backend = { _draw: original, get: () => ({}) };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const uninstall = installWebGpuDrawDiagnostics({
      backend,
    } as unknown as WebGPURenderer);
    const object = {
      object: { id: 1, name: "cloud-loading-progress", geometry: { id: 3 } },
      geometry: { id: 2 },
      material: { id: 20, name: "ring", type: "MeshBasicMaterial" },
      context: { id: 4 },
    };
    const args = [
      object,
      null,
      null,
      null,
      [],
      [{ id: 5, name: "position", version: 0 }],
      { vertexCount: 576 },
      {},
      { attributes: {} },
    ];
    backend._draw(...args);
    object.object.name = "changed";
    expect(JSON.parse(log.mock.calls[0][1])).toMatchObject({
      object: "cloud-loading-progress",
      geometryId: 2,
      currentGeometryId: 3,
      materialId: 20,
      slots: [{ slot: 0, missing: true }],
    });
    expect(log.mock.calls[0][2]).toContain("WebGPU draw diagnostic");
    expect(original).toHaveBeenCalledWith(...args);
    uninstall();
    expect(backend._draw).toBe(original);
  });

  it("accepts valid cached bindings but reports reuse on a different encoder", () => {
    const buffer = {};
    const original = vi.fn((...args: unknown[]) => {
      const attributes = args[5] as object[];
      (args[8] as { attributes: Record<number, object> }).attributes[0] =
        attributes[0];
    });
    const backend = { _draw: original, get: () => ({ buffer }) };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    installWebGpuDrawDiagnostics({ backend } as unknown as WebGPURenderer);
    const args = [
      {
        object: { id: 1, name: "ring", geometry: { id: 2 } },
        geometry: { id: 2 },
        material: { id: 20, name: "", type: "MeshBasicMaterial" },
        context: { id: 3 },
      },
      null,
      null,
      null,
      [],
      [{ id: 4, name: "position", version: 0 }],
      {},
      {},
      { attributes: {} },
    ];
    backend._draw(...args);
    backend._draw(...args);
    expect(log).not.toHaveBeenCalled();
    args[7] = {};
    backend._draw(...args);
    expect(JSON.parse(log.mock.calls[0][1]).slots[0]).toMatchObject({
      missing: false,
      cached: true,
      cacheMismatch: true,
    });
    expect(original).toHaveBeenCalledTimes(3);
  });
});
