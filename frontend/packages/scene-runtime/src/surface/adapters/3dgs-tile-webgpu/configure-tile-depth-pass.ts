import { createDepthProjectionNode } from "./create-depth-projection-node";
import {
  gaussianOpacity,
  rasterOutputDepth,
  rasterPower,
  type GaussianPass,
} from "3dgs-tile-webgpu";
import { float } from "three/tsl";
import { DEPTH_ALPHA_CUTOFF, DEPTH_SPLAT_SIGMA } from "../../depth/constants";
/** Same source-opacity cutoff and opaque 2-sigma footprint as Spark's depth demo. */
export function configureTileDepthPass(pass: GaussianPass): void {
  pass.gaussianProjectionNode = createDepthProjectionNode();
  pass.gaussianOpacityNode = gaussianOpacity
    .greaterThan(DEPTH_ALPHA_CUTOFF)
    .select(1, 0);
  pass.rasterDiscardNode = rasterPower.lessThan(-0.5 * DEPTH_SPLAT_SIGMA ** 2);
  pass.rasterAlphaNode = float(1);
  pass.rasterOutputDepthNode = rasterOutputDepth;
}
