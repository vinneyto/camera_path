import { expect, it } from "vitest";
import { Matrix4, StorageBufferAttribute } from "three/webgpu";
import { Fn, instanceIndex, mat4, storage, vec3 } from "three/tsl";
import { createLidarHitNode } from "./create-lidar-hit-node";
import { buildCompute } from "./test-helpers/build-compute";
import { executeCompute } from "./test-helpers/execute-compute";

it("reconstructs meters with the sensor world transform and suppresses missing returns", () => {
  const input = new StorageBufferAttribute(
    new Float32Array([5, Infinity, NaN, 0, -1, 20000]),
    1,
  );
  const output = new StorageBufferAttribute(6, 4);
  const ranges = storage(input, "float", 6).toReadOnly();
  const hits = storage(output, "vec4", 6);
  const transform = new Matrix4()
    .makeRotationY(Math.PI / 2)
    .setPosition(10, 2, 3);
  const shader = buildCompute(
    Fn(() => {
      hits
        .element(instanceIndex)
        .assign(
          createLidarHitNode(
            ranges.element(instanceIndex),
            vec3(0, 0, -1),
            mat4(transform),
            10000,
          ),
        );
    })().computeKernel([1]),
  );
  const result = executeCompute(
    shader,
    output.array as Float32Array,
    6,
    input.array as Float32Array,
  );
  expect(result.slice(0, 4)).toEqual([5, 2, 3, 1]);
  expect(result.slice(4)).toEqual(Array(20).fill(0));
});
