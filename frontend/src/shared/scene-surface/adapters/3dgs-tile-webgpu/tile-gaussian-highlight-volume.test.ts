import type { GaussianPass } from "3dgs-tile-webgpu";
import { expect, it, vi } from "vitest";
import { vec3 } from "three/tsl";

import { TileGaussianHighlightVolume } from "./tile-gaussian-highlight-volume";

it("restores the Gaussian pass color node when the volume is disposed", () => {
  const baseColorNode = vec3(0.2, 0.3, 0.4);
  const basePositionWorldNode = vec3(1, 2, 3);
  const pass = {
    gaussianColorNode: baseColorNode,
    gaussianPositionWorldNode: basePositionWorldNode,
  } as unknown as GaussianPass;
  const onDispose = vi.fn();
  const volume = new TileGaussianHighlightVolume(
    pass,
    {
      bottomOffset: 0.02,
      color: [1, 1, 1],
      height: 0.5,
      position: [1, 2, 3],
      radius: 0.18,
      strength: 0.42,
      type: "color",
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
    type: "color",
  });
  expect(pass.gaussianColorNode).toBe(highlightNode);
  expect(pass.gaussianPositionWorldNode).toBe(basePositionWorldNode);

  volume.dispose();
  volume.dispose();

  expect(pass.gaussianColorNode).toBe(baseColorNode);
  expect(onDispose).toHaveBeenCalledOnce();
});

it("restores the Gaussian pass position node when a ripple volume is disposed", () => {
  const baseColorNode = vec3(0.2, 0.3, 0.4);
  const basePositionWorldNode = vec3(1, 2, 3);
  const pass = {
    gaussianColorNode: baseColorNode,
    gaussianPositionWorldNode: basePositionWorldNode,
  } as unknown as GaussianPass;
  const onDispose = vi.fn();
  const volume = new TileGaussianHighlightVolume(
    pass,
    {
      amplitude: 0.05,
      position: [1, 2, 3],
      radius: 0.1,
      speed: 1.2,
      tintColor: [1, 0.98, 0.92],
      tintStrength: 0.22,
      type: "ripple",
      verticalCoreRadius: 0.05,
      verticalFalloffRadius: 0.2,
      wavelength: 0.035,
    },
    onDispose,
  );
  const rippleNode = pass.gaussianPositionWorldNode;

  expect(rippleNode).not.toBe(basePositionWorldNode);
  expect(pass.gaussianColorNode).not.toBe(baseColorNode);
  expect(JSON.stringify(rippleNode.toJSON())).toContain('"type":"ConditionalNode"');

  volume.dispose();

  expect(pass.gaussianPositionWorldNode).toBe(basePositionWorldNode);
  expect(pass.gaussianColorNode).toBe(baseColorNode);
  expect(onDispose).toHaveBeenCalledOnce();
});
