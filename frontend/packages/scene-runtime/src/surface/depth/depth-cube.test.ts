import { Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createDepthCameras } from "./create-depth-cameras";
import { createLidarRays } from "./create-lidar-rays";
import { sampleDepthCube } from "./sample-depth-cube";

describe("shared depth cube convention", () => {
  it("covers the full sphere once, including face boundaries, poles and a rotated/translated sensor", () => {
    const pose = new Matrix4().compose(
      new Vector3(7, 3, -2),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7),
      new Vector3(1, 1, 1),
    );
    const cameras = createDepthCameras(pose),
      size = 32;
    // A sphere centered on the sensor: each face stores view-Z, not radial range.
    const faces = cameras.map(() => {
      const data = new Float32Array(size * size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const u = ((x + 0.5) / size) * 2 - 1,
            v = ((y + 0.5) / size) * 2 - 1;
          data[y * size + x] = 4 / Math.sqrt(1 + u * u + v * v);
        }
      return data;
    });
    const rays = createLidarRays({
      horizontalResolution: 101,
      verticalResolution: 51,
      verticalFovDegrees: 180,
    });
    const ranges = new Float32Array(rays.length / 3);
    sampleDepthCube({ faces, size }, rays, ranges);
    expect(Math.max(...ranges)).toBeLessThan(4.12);
    expect(Math.min(...ranges)).toBeGreaterThan(3.88);
    // Project each ray through the chosen camera and verify sample addressing
    // against Three's actual matrices, rather than a second copy of the mapping.
    const localToWorld = pose.clone();
    for (let i = 0; i < ranges.length; i++) {
      const world = new Vector3()
        .fromArray(rays, i * 3)
        .multiplyScalar(4)
        .applyMatrix4(localToWorld);
      const inFace = cameras
        .map((camera) => ({ camera, p: world.clone().project(camera) }))
        .filter(
          ({ p }) =>
            Math.abs(p.x) <= 1.000001 &&
            Math.abs(p.y) <= 1.000001 &&
            p.z >= -1 &&
            p.z <= 1,
        );
      expect(inFace.length).toBeGreaterThan(0);
      const { camera, p } = inFace[0];
      const face = cameras.indexOf(camera);
      const x = Math.min(size - 1, Math.floor((p.x * 0.5 + 0.5) * size));
      const y = Math.min(size - 1, Math.floor((0.5 - p.y * 0.5) * size));
      const viewZ = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
      expect(ranges[i]).toBeCloseTo(faces[face][y * size + x] / (viewZ / 4), 4);
    }
  });
  it("uses pixel-center rays, invalidates misses/NaN/far-plane samples and preserves off-axis meters", () => {
    const size = 2,
      faces = Array.from({ length: 6 }, () => new Float32Array(4).fill(3));
    const rays = new Float32Array([
      0,
      0,
      -1,
      ...new Vector3(0.5, 0, -1).normalize().toArray(),
    ]);
    const output = new Float32Array(2);
    sampleDepthCube({ faces, size }, rays, output);
    expect(output[0]).toBe(3);
    expect(output[1]).toBeCloseTo(3 * Math.sqrt(1.25));
    for (const value of [0, -1, NaN, Infinity, 10001]) {
      faces[5].fill(value);
      sampleDepthCube({ faces, size }, rays, output);
      expect([...output]).toEqual([Infinity, Infinity]);
    }
    const angular = createLidarRays({
      horizontalResolution: 4,
      verticalResolution: 2,
      verticalFovDegrees: 60,
    });
    expect(angular[1]).toBeCloseTo(Math.sin(Math.PI / 12));
    expect(angular[4 * 3 + 1]).toBeCloseTo(-Math.sin(Math.PI / 12));
  });
});
