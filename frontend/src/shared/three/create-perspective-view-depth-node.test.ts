import { expect, it } from "vitest";
import { float } from "three/tsl";
import { PerspectiveCamera } from "three/webgpu";

import { createPerspectiveViewDepthNode } from "./create-perspective-view-depth-node";

it("keeps camera clipping planes live after the depth node is created", () => {
  const camera = new PerspectiveCamera(42, 1, 0.01, 100);
  const viewDepth = createPerspectiveViewDepthNode(float(0.5), camera);
  const references: Array<{ property: string; reference: PerspectiveCamera }> = [];
  viewDepth.traverse((node) => {
    if (!("property" in node) || !("reference" in node)) return;
    references.push(node as unknown as { property: string; reference: PerspectiveCamera });
  });

  const nearReference = references.find((node) => node.property === "near");
  const farReference = references.find((node) => node.property === "far");
  expect(nearReference?.reference.near).toBe(0.01);
  expect(farReference?.reference.far).toBe(100);

  camera.near = 0.25;
  camera.far = 400;

  expect(nearReference?.reference.near).toBe(0.25);
  expect(farReference?.reference.far).toBe(400);
});
