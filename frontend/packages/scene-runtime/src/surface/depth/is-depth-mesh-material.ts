import type { Material } from "three";
export function isDepthMeshMaterial(material: Material): boolean {
  return material.visible && material.depthWrite && !material.transparent;
}
