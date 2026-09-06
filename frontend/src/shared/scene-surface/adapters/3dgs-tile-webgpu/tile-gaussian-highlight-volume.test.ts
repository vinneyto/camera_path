import type { GaussianPass } from "3dgs-tile-webgpu";
import { expect, it, vi } from "vitest";
import { vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

import { TileGaussianHighlightVolume } from "./tile-gaussian-highlight-volume";

it("restores the Gaussian pass color node when the volume is disposed", () => {
  const baseColorNode = vec3(0.2, 0.3, 0.4);
  const pass = { gaussianColorNode: baseColorNode } as unknown as GaussianPass;
  const onDispose = vi.fn();
  const volume = new TileGaussianHighlightVolume(
    pass,
    baseColorNode as Node<"vec3">,
    {
      bottomOffset: 0.02,
      color: [1, 1, 1],
      height: 0.5,
      position: [1, 2, 3],
      radius: 0.18,
      strength: 0.42,
    },
    onDispose,
  );
  const highlightNode = pass.gaussianColorNode;

  expect(highlightNode).not.toBe(baseColorNode);
  expect(JSON.stringify(highlightNode.toJSON())).toContain('"type":"ConditionalNode"');
  volume.update({
    bottomOffset: 0.01,
    color: [1, 0.8, 0.6],
    height: 0.75,
    position: [4, 5, 6],
    radius: 0.25,
    strength: 0.5,
  });
  expect(pass.gaussianColorNode).toBe(highlightNode);

  volume.dispose();
  volume.dispose();

  expect(pass.gaussianColorNode).toBe(baseColorNode);
  expect(onDispose).toHaveBeenCalledOnce();
});
