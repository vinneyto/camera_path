import { cos, sin, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import type { GaussianLidarSettings } from "../../model/gaussian-lidar";
export function createLidarDirectionNode(
  pixel: Node<"vec2">,
  settings: GaussianLidarSettings,
) {
  const azimuth = pixel.x
    .add(0.5)
    .div(settings.horizontalResolution)
    .sub(0.5)
    .mul(2 * Math.PI);
  const elevation = pixel.y
    .add(0.5)
    .div(settings.verticalResolution)
    .negate()
    .add(0.5)
    .mul((settings.verticalFovDegrees * Math.PI) / 180);
  return vec3(
    sin(azimuth).mul(cos(elevation)),
    sin(elevation),
    cos(azimuth).mul(cos(elevation)).negate(),
  );
}
