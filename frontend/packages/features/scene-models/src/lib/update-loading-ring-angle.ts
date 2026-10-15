import { Sphere, type RingGeometry } from "three";

/** Change the arc without replacing geometry or disposing live vertex buffers. */
export function updateLoadingRingAngle(
  geometry: RingGeometry,
  angle: number,
): void {
  const { innerRadius, outerRadius, thetaStart } = geometry.parameters;
  const segments = Math.max(3, Math.floor(geometry.parameters.thetaSegments));
  const rows = Math.max(1, Math.floor(geometry.parameters.phiSegments));
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  // Keep full-ring bounds even if the first visible frame is a tiny arc.
  geometry.boundingSphere ??= new Sphere();
  geometry.boundingSphere.center.set(0, 0, 0);
  geometry.boundingSphere.radius = outerRadius;
  for (let row = 0; row <= rows; row++) {
    const radius = innerRadius + ((outerRadius - innerRadius) * row) / rows;
    for (let segment = 0; segment <= segments; segment++) {
      const theta = thetaStart + (angle * segment) / segments;
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      const index = row * (segments + 1) + segment;
      position.setXY(index, x, y);
      uv.setXY(index, (x / outerRadius + 1) / 2, (y / outerRadius + 1) / 2);
    }
  }
  position.needsUpdate = true;
  uv.needsUpdate = true;
}
