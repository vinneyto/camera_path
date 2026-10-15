import type { GaussianPass } from "3dgs-tile-webgpu";
import { buildComputeNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/test-helpers/build-compute-node";
import type { TileGaussianLidar } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-lidar";
import { TileLidarFrameNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-lidar-frame-node";
import { Fn, storage, vec4 } from "three/tsl";
import { Node, NodeFrame, StorageBufferAttribute } from "three/webgpu";
import { expect, it, vi } from "vitest";

it("schedules main selection before LiDAR and submits hits before the later scene stage", () => {
  const calls: string[] = [];
  class Stage extends Node<"vec4"> {
    constructor(private readonly stageName: string) {
      super("vec4");
      this.updateBeforeType = "frame";
    }
    override setup() {
      return vec4(0);
    }
    override updateBefore() {
      calls.push(this.stageName);
      return undefined;
    }
  }
  const main = new Stage("main");
  const sensor = {
    render: vi.fn(() => calls.push("lidar", "hits")),
  } as unknown as TileGaussianLidar;
  const lidar = new TileLidarFrameNode(
    main as unknown as GaussianPass,
    new Set([sensor]),
  );
  const scene = new Stage("scene");
  const output = storage(new StorageBufferAttribute(1, 4), "vec4", 1);
  const builder = buildComputeNode(
    Fn(() => {
      output.element(0).assign(lidar.add(scene));
    })().computeKernel([1]),
  );
  const frame = new NodeFrame();
  for (const node of builder.updateBeforeNodes) {
    if (node === main || node === lidar || node === scene)
      node.updateBefore(frame);
  }
  expect(calls).toEqual(["main", "lidar", "hits", "scene"]);
});
