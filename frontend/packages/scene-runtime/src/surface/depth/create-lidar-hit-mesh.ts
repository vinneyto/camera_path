import {
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  type Material,
} from "three";
import type { GaussianLidarSettings } from "../model/gaussian-lidar";
import { LIDAR_HIT_RENDER_ORDER } from "./constants";

/** Four vertices per analytic sphere. Fragment shaders solve ray/sphere intersection.
 * No per-instance CPU attributes or instanceMatrix buffer. */
export function createLidarHitMesh(
  material: Material,
  settings: GaussianLidarSettings,
) {
  const quad = new PlaneGeometry(2, 2);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(quad.getIndex());
  for (const [name, attribute] of Object.entries(quad.attributes))
    geometry.setAttribute(name, attribute);
  geometry.instanceCount =
    settings.horizontalResolution * settings.verticalResolution;
  quad.dispose();
  const object = new Mesh<InstancedBufferGeometry, Material>(
    geometry,
    material,
  );
  object.name = "LiDAR hits";
  object.renderOrder = LIDAR_HIT_RENDER_ORDER;
  object.userData.excludeFromSceneDepth = true;
  object.frustumCulled = false;
  object.raycast = () => undefined;
  return object;
}
