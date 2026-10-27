import {
  ACESFilmicToneMapping,
  Color,
  Object3D,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { describe, expect, it, vi } from "vitest";

import { SparkGaussianRenderingBackend } from "@camera-path/scene-runtime/surface/adapters/spark/spark-gaussian-rendering-backend";

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
  it.each([0x0c1017, 0xebe9e5])(
    "preserves the sRGB background #%s without changing scene color settings",
    (hex) => {
      const previousColor = new Color("#123456");
      const setClearColor = vi.fn();
      const renderer = {
        getClearColor: (target: Color) => target.copy(previousColor),
        getClearAlpha: () => 0.4,
        setClearColor,
        outputColorSpace: SRGBColorSpace,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.7,
      } as unknown as WebGLRenderer;
      const backend = new SparkGaussianRenderingBackend({ renderer });
      backend.setBackground([
        ((hex >> 16) & 255) / 255,
        ((hex >> 8) & 255) / 255,
        (hex & 255) / 255,
        0.8,
      ]);
      const [color, alpha] = setClearColor.mock.lastCall!;
      expect((color as Color).getHex(SRGBColorSpace)).toBe(hex);
      expect((color as Color).equals(new Color(hex))).toBe(true);
      expect(alpha).toBe(0.8);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.toneMappingExposure).toBe(1.7);
      backend.dispose();
      expect(setClearColor).toHaveBeenLastCalledWith(previousColor, 0.4);
    },
  );

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
