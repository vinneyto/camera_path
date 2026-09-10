import {
  rasterPixelValue,
  rasterViewDepth,
  type DepthSortMode,
} from "3dgs-tile-webgpu";
import { bool } from "three/tsl";
import type { Node } from "three/webgpu";

export function createTileRasterDepthNodes(
  viewDepth: Node,
  mode: DepthSortMode,
) {
  const occluded = rasterPixelValue.lessThan(rasterViewDepth);
  return {
    rasterPixelValueNode: viewDepth,
    rasterBreakNode: mode === "float32" ? occluded : bool(false),
    rasterDiscardNode: mode === "packed16" ? occluded : bool(false),
  };
}
