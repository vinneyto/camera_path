import {
  gaussianCovarianceView,
  gaussianPassDepthRange,
  gaussianPassFilterVariance,
  gaussianPassViewport,
  gaussianPositionView,
} from "3dgs-tile-webgpu";
import { createLidarProjectionNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-projection-node";
import { createLidarRayNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-ray-node";
import { buildCompute } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/test-helpers/build-compute";
import { executeCompute } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/test-helpers/execute-compute";
import {
  Fn,
  float,
  instanceIndex,
  mat3,
  storage,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { StorageBufferAttribute, type Node } from "three/webgpu";
import { describe, expect, it } from "vitest";

function project(p: [number, number, number]) {
  const output = new StorageBufferAttribute(4, 4);
  const result = storage(output, "vec4", 4);
  const shader = buildCompute(
    Fn(() => {
      gaussianPositionView.assign(vec3(...p));
      gaussianCovarianceView.assign(mat3(1, 0, 0, 0, 1, 0, 0, 0, 1));
      gaussianPassViewport.assign(vec2(512, 32));
      gaussianPassDepthRange.assign(vec2(0.01, 10000));
      gaussianPassFilterVariance.assign(float(0.3));
      const projection = createLidarProjectionNode(Math.PI / 3).toVar();
      for (let column = 0; column < 4; column++)
        result
          .element(column)
          .assign(
            (
              projection as unknown as { element(index: number): Node<"vec4"> }
            ).element(column),
          );
    })().computeKernel([1]),
  );
  return executeCompute(shader, output.array as Float32Array);
}

describe("executed angular projection", () => {
  it("projects camera forward to the center and preserves radial meters", () => {
    const result = project([0, 0, -10]);
    expect(result.slice(0, 4)).toEqual([256, 16, 10, 1]);
    expect(result[8]).toBeCloseTo((512 / (2 * Math.PI * 10)) ** 2 + 0.3, 3);
    expect(result[10]).toBeCloseTo((32 / ((Math.PI / 3) * 10)) ** 2 + 0.3, 3);
    expect(project([6, 0, -8])[2]).toBeCloseTo(10, 5);
  });
  it("keeps the seam periodic and excludes singular poles and out-of-range centers", () => {
    const left = project([-0.001, 0, 10]);
    const right = project([0.001, 0, 10]);
    expect(left[0]).toBeLessThan(0.02);
    expect(right[0]).toBeGreaterThan(511.98);
    expect(left[2]).toBeCloseTo(right[2], 5);
    expect(project([0, 10, 0])).toEqual(Array(16).fill(0));
    expect(project([0, 0, -20000])).toEqual(Array(16).fill(0));
  });
  it("matches an independent finite-difference Jacobian for tilted points", () => {
    const p: [number, number, number] = [3, 2, -7];
    const screen = ([x, y, z]: number[]) => [
      (Math.atan2(x, -z) / (2 * Math.PI) + 0.5) * 512,
      (0.5 - Math.atan2(y, Math.hypot(x, z)) / (Math.PI / 3)) * 32,
    ];
    const j = [0, 1, 2].map((axis) => {
      const a = [...p],
        b = [...p];
      a[axis] += 1e-4;
      b[axis] -= 1e-4;
      return screen(a).map((v, i) => (v - screen(b)[i]) / 2e-4);
    });
    const result = project(p);
    expect(result[8]).toBeCloseTo(
      j.reduce((sum, row) => sum + row[0] ** 2, 0) + 0.3,
      3,
    );
    expect(result[9]).toBeCloseTo(
      j.reduce((sum, row) => sum + row[0] * row[1], 0),
      3,
    );
    expect(result[10]).toBeCloseTo(
      j.reduce((sum, row) => sum + row[1] ** 2, 0) + 0.3,
      3,
    );
  });
  it("round-trips pixel-center rays through the forward projection", () => {
    const output = new StorageBufferAttribute(15, 4);
    const result = storage(output, "vec4", 15);
    const shader = buildCompute(
      Fn(() => {
        const pixel = vec2(instanceIndex.mod(5), instanceIndex.div(5));
        result
          .element(instanceIndex)
          .assign(vec4(createLidarRayNode(pixel, 5, 3, Math.PI / 3), 0));
      })().computeKernel([1]),
    );
    const rays = executeCompute(shader, output.array as Float32Array, 15);
    for (let i = 0; i < 15; i++) {
      const [x, y, z] = rays.slice(i * 4, i * 4 + 3);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
      expect((Math.atan2(x, -z) / (2 * Math.PI) + 0.5) * 5).toBeCloseTo(
        (i % 5) + 0.5,
        5,
      );
      expect(
        (0.5 - Math.atan2(y, Math.hypot(x, z)) / (Math.PI / 3)) * 3,
      ).toBeCloseTo(Math.floor(i / 5) + 0.5, 5);
    }
  });
});
