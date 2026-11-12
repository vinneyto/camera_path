import {
  MeshBasicNodeMaterial,
  type MeshStandardMaterial,
  type Material,
} from "three/webgpu";
import { positionView } from "three/tsl";
export function createWebGpuDepthMaterial(original: Material): Material {
  const source = original as MeshBasicNodeMaterial;
  const material = new MeshBasicNodeMaterial({
    side: original.side,
    map: source.map ?? null,
    alphaMap: source.alphaMap ?? null,
    alphaTest: original.alphaTest,
    opacity: original.opacity,
    clippingPlanes: original.clippingPlanes,
    clipIntersection: original.clipIntersection,
    toneMapped: false,
  });
  const displaced = original as MeshStandardMaterial;
  Object.assign(material, {
    displacementMap: displaced.displacementMap,
    displacementScale: displaced.displacementScale,
    displacementBias: displaced.displacementBias,
  });
  material.colorNode = positionView.z.negate().xxx;
  return material;
}
