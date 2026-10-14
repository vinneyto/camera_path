import {
  gaussianCovarianceView,
  gaussianPassDepthRange,
  gaussianPassViewport,
  gaussianPositionView,
  gaussianProjectionResult,
} from "3dgs-tile-webgpu";
import { Fn, If, atan, dot, float, mat4, vec2, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";

/** Equirectangular azimuth/elevation, pixel coordinates measured from the top left. */
export function createLidarProjectionNode(
  verticalFovRadians: number,
): Node<"mat4"> {
  return Fn(() => {
    const p = gaussianPositionView.toVar();
    const horizontalSquared = p.x.mul(p.x).add(p.z.mul(p.z)).toVar();
    const radiusSquared = dot(p, p).toVar();
    const range = radiusSquared.sqrt().toVar();
    // The Jacobian is singular on the poles; the vertical field excludes them.
    const result = mat4(vec4(0), vec4(0), vec4(0), vec4(0)).toVar();
    If(
      horizontalSquared
        .greaterThan(1e-10)
        .and(range.greaterThanEqual(gaussianPassDepthRange.x))
        .and(range.lessThanEqual(gaussianPassDepthRange.y)),
      () => {
        const horizontal = horizontalSquared.sqrt().toVar();
        const azimuth = atan(p.x, p.z.negate()).toVar();
        const elevation = atan(p.y, horizontal).toVar();
        const screen = vec2(
          azimuth
            .div(2 * Math.PI)
            .add(0.5)
            .mul(gaussianPassViewport.x),
          float(0.5)
            .sub(elevation.div(verticalFovRadians))
            .mul(gaussianPassViewport.y),
        );
        const jx = vec3(p.z.negate(), 0, p.x)
          .div(horizontalSquared)
          .mul(gaussianPassViewport.x.div(2 * Math.PI));
        const jy = vec3(
          p.y.negate().mul(p.x).div(horizontal),
          horizontal,
          p.y.negate().mul(p.z).div(horizontal),
        )
          .div(radiusSquared)
          .mul(gaussianPassViewport.y.div(-verticalFovRadians));
        const covariance = gaussianCovarianceView;
        result.assign(
          gaussianProjectionResult(
            screen,
            range,
            vec3(
              dot(jx, covariance.mul(jx)),
              dot(jx, covariance.mul(jy)),
              dot(jy, covariance.mul(jy)),
            ),
          ),
        );
      },
    );
    return result;
  })();
}
