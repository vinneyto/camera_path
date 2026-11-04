import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { LibraryAsset } from "@camera-path/types/api";
import type { Vec3 } from "@camera-path/types/project";

export function createLibraryObjectTransform(
  asset: LibraryAsset,
  target: Vec3,
) {
  const rotation = new Quaternion().setFromEuler(
    new Euler(...(asset.default_rotation_deg.map(MathUtils.degToRad) as Vec3)),
  );
  const position = new Vector3(...asset.default_offset)
    .multiplyScalar(asset.default_scale)
    .applyQuaternion(rotation)
    .add(new Vector3(...target));
  return {
    position: position.toArray(),
    quaternion: rotation.toArray(),
    scale: [
      asset.default_scale,
      asset.default_scale,
      asset.default_scale,
    ] as Vec3,
  };
}
