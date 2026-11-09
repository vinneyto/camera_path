import {
  gaussianCovarianceView,
  gaussianPassProjectionMatrix,
  gaussianPassViewport,
  gaussianPositionView,
  gaussianProjectionResult,
} from "3dgs-tile-webgpu";
import { float, mat4, vec2, vec3, vec4 } from "three/tsl";
import {
  DEPTH_CLIP_XY,
  DEPTH_FAR,
  DEPTH_NEAR,
  DEPTH_COVARIANCE_EPSILON,
} from "../../depth/constants";

export function createDepthProjectionNode() {
  const view = gaussianPositionView,
    depth = view.z.negate();
  const clip = gaussianPassProjectionMatrix.mul(vec4(view, 1));
  const center = vec2(
    clip.x.div(clip.w).mul(0.5).add(0.5),
    float(0.5).sub(clip.y.div(clip.w).mul(0.5)),
  ).mul(gaussianPassViewport);
  const fx = gaussianPassViewport.x
    .mul(0.5)
    .mul(gaussianPassProjectionMatrix.mul(vec4(1, 0, 0, 0)).x);
  const fy = gaussianPassViewport.y
    .mul(0.5)
    .mul(gaussianPassProjectionMatrix.mul(vec4(0, 1, 0, 0)).y);
  const j0 = vec3(fx.div(depth), 0, fx.mul(view.x).div(depth.mul(depth)));
  const j1 = vec3(
    0,
    fy.div(depth).negate(),
    fy.mul(view.y).div(depth.mul(depth)).negate(),
  );
  const xx = j0.dot(gaussianCovarianceView.mul(j0));
  // The public projection helper's eigensolver reaches atan2(0,0) for an
  // exactly circular footprint. A sub-pixel perturbation avoids NaNs on Metal.
  const covariance = vec3(
    xx.add(xx.max(1).mul(DEPTH_COVARIANCE_EPSILON)),
    j0.dot(gaussianCovarianceView.mul(j1)),
    j1.dot(gaussianCovarianceView.mul(j1)),
  );
  const result = gaussianProjectionResult(center, depth, covariance, float(0));
  const valid = depth
    .greaterThan(DEPTH_NEAR)
    .and(depth.lessThan(DEPTH_FAR))
    .and(clip.x.abs().lessThanEqual(clip.w.mul(DEPTH_CLIP_XY)))
    .and(clip.y.abs().lessThanEqual(clip.w.mul(DEPTH_CLIP_XY)));
  return mat4(
    vec4(result.mul(vec4(1, 0, 0, 0)).xyz, valid.select(1, 0)),
    result.mul(vec4(0, 1, 0, 0)),
    result.mul(vec4(0, 0, 1, 0)),
    vec4(0),
  );
}
