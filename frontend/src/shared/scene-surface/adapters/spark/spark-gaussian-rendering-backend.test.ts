import { describe, expect, it, vi } from "vitest";
import { Object3D, type WebGLRenderer } from "three";

import { SparkGaussianRenderingBackend } from "./spark-gaussian-rendering-backend";

const sparkState = vi.hoisted(() => ({
  disposedMeshes: 0,
  disposedRenderers: 0,
}));

vi.mock("@sparkjsdev/spark", async () => {
  const { Box3, Object3D, Vector3 } = await import("three");
  return {
    SparkRenderer: class extends Object3D {
      dispose() {
        sparkState.disposedRenderers += 1;
      }
    },
    SplatMesh: class extends Object3D {
      initialized = Promise.resolve(this);
      constructor(readonly options: { url: string; raycastable: boolean }) {
        super();
      }
      getBoundingBox() {
        return new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
      }
      dispose() {
        sparkState.disposedMeshes += 1;
      }
    },
  };
});

describe("Spark reference backend", () => {
  it("loads a project cloud, exposes its scene object, and releases it", async () => {
    sparkState.disposedMeshes = 0;
    sparkState.disposedRenderers = 0;
    const color = { clone: () => color };
    const renderer = {
      getClearColor: () => color,
      getClearAlpha: () => 1,
      setClearColor: vi.fn(),
    } as unknown as WebGLRenderer;
    const backend = new SparkGaussianRenderingBackend({ renderer });

    const cloud = await backend.createCloud(
      { kind: "url", url: "/assets/cloud.ply" },
      { name: "cloud-1" },
    );
    expect(cloud.object.parent).toBeNull();
    expect(cloud.object.name).toBe("cloud-1");
    expect(cloud.bounds?.center).toEqual([0, 0, 0]);
    expect(cloud.bounds?.radius).toBeCloseTo(Math.sqrt(3));
    expect(backend.container).toBeInstanceOf(Object3D);

    cloud.dispose();
    backend.dispose();
    expect(sparkState.disposedMeshes).toBe(1);
    expect(sparkState.disposedRenderers).toBe(1);
    expect(renderer.setClearColor).toHaveBeenCalled();
  });
});
