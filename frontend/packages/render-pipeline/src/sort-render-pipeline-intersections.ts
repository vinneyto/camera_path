import type { Intersection } from "three";

import { RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER } from "./render-pipeline-scene-layers";

/** Pre-splat surfaces are composited underneath splats, regardless of depth. */
export function sortRenderPipelineIntersections<T extends Intersection>(
  intersections: readonly T[],
): T[] {
  const preSplatMask = 1 << RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER;
  return [...intersections].sort(
    (left, right) =>
      Number((left.object.layers.mask & preSplatMask) !== 0) -
        Number((right.object.layers.mask & preSplatMask) !== 0) ||
      left.distance - right.distance,
  );
}
