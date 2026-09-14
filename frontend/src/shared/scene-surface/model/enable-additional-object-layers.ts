import type { Object3D } from "three";

export function enableAdditionalObjectLayers(
  object: Object3D,
  layers: readonly number[],
) {
  for (const layer of layers) object.layers.enable(layer);
}
