import { gaussianObjectId } from "3dgs-tile-webgpu";
import { Fn, float, storage, uint, vec3, vec4 } from "three/tsl";
import { StorageBufferAttribute } from "three/webgpu";
import { expect, it } from "vitest";
import { GAUSSIAN_HOVER_GAIN, GAUSSIAN_SELECTED_GAIN } from "../../constants";
import { createCloudInteractionColorNode } from "./create-cloud-interaction-color-node";
import { buildCompute } from "./test-helpers/build-compute";
import { executeCompute } from "./test-helpers/execute-compute";

it.each([
  {
    id: 5,
    selectedId: 9,
    selectedGain: GAUSSIAN_SELECTED_GAIN,
    expected: GAUSSIAN_HOVER_GAIN,
  },
  {
    id: 9,
    selectedId: 9,
    selectedGain: GAUSSIAN_SELECTED_GAIN,
    expected: GAUSSIAN_SELECTED_GAIN,
  },
  { id: 7, selectedId: 9, selectedGain: GAUSSIAN_SELECTED_GAIN, expected: 1 },
  {
    id: 5,
    selectedId: 5,
    selectedGain: GAUSSIAN_SELECTED_GAIN,
    expected: GAUSSIAN_SELECTED_GAIN,
  },
  { id: 5, selectedId: 5, selectedGain: 1, expected: GAUSSIAN_HOVER_GAIN },
])(
  "keeps hover and selection independent (cloud=$id, selected=$selectedId, gain=$selectedGain)",
  ({ id, selectedId, selectedGain, expected }) => {
    const output = storage(new StorageBufferAttribute(1, 4), "vec4", 1);
    const color = createCloudInteractionColorNode(
      vec3(0.2, 0.3, 0.4),
      uint(5),
      float(GAUSSIAN_HOVER_GAIN),
      uint(selectedId),
      float(selectedGain),
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
