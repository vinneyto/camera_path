import type { GaussianPass } from "3dgs-tile-webgpu";
import type { TileGaussianLidar } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-lidar";
import { vec4 } from "three/tsl";
import { Node, type NodeBuilder } from "three/webgpu";

/** A transparent pipeline layer whose dependency schedules the main pass first. */
export class TileLidarFrameNode extends Node<"vec4"> {
  constructor(
    private readonly mainPass: GaussianPass,
    private readonly sensors: ReadonlySet<TileGaussianLidar>,
  ) {
    super("vec4");
    this.updateBeforeType = "frame";
  }
  override setup(builder: NodeBuilder) {
    // Three builds sequential update-before nodes after their dependencies.
    // The existing Gaussian layer resolves opaque depth and managed selection first.
    super.setup(builder);
    return vec4(0);
  }
  override updateBefore() {
    for (const sensor of this.sensors) sensor.render();
    return undefined;
  }
}
