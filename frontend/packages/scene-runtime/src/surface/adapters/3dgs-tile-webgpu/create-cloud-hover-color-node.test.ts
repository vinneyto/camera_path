import { gaussianObjectId } from "3dgs-tile-webgpu";
import { Fn, float, storage, uint, vec3, vec4 } from "three/tsl";
import { StorageBufferAttribute } from "three/webgpu";
import { expect, it } from "vitest";
import { createCloudHoverColorNode } from "./create-cloud-hover-color-node";
import { buildCompute } from "./test-helpers/build-compute";
import { executeCompute } from "./test-helpers/execute-compute";

it.each([
  { id: 5, gain: 1.18, expected: 1.18 },
  { id: 9, gain: 1.18, expected: 1 },
  { id: 5, gain: 1, expected: 1 },
])(
  "brightens only the hovered cloud (id=$id, gain=$gain)",
  ({ id, gain, expected }) => {
    const output = storage(new StorageBufferAttribute(1, 4), "vec4", 1);
    const color = createCloudHoverColorNode(
      vec3(0.2, 0.3, 0.4),
      uint(5),
      float(gain),
    );
    const shader = buildCompute(
      Fn(() => {
        gaussianObjectId.assign(uint(id));
        output.element(0).assign(vec4(color, 1));
      })().computeKernel([1]),
    );
    const actual = executeCompute(shader, new Float32Array(4));
    for (const [index, value] of [0.2, 0.3, 0.4].entries())
      expect(actual[index]).toBeCloseTo(value * expected);
    expect(actual[3]).toBe(1);
  },
);
