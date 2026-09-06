import { CatmullRomCurve3, SphereGeometry, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { ScreenSpaceLinePoint } from "./screen-space-line";

export function createScreenSpaceLineGeometry(
  points: readonly ScreenSpaceLinePoint[],
  radius: number,
) {
  const vectors = points.map((point) => point instanceof Vector3 ? point.clone() : new Vector3(...point));
  const curve = new CatmullRomCurve3(vectors, false, "centripetal");
  const tube = new TubeGeometry(curve, Math.max(1, vectors.length - 1), radius, 8, false);
  const startCap = new SphereGeometry(radius, 8, 6).translate(...vectors[0].toArray());
  const endCap = new SphereGeometry(radius, 8, 6).translate(...vectors.at(-1)!.toArray());
  const geometry = mergeGeometries([tube, startCap, endCap]);
  tube.dispose();
  startCap.dispose();
  endCap.dispose();
  if (geometry === null) throw new Error("Could not create line geometry");
  return geometry;
}
