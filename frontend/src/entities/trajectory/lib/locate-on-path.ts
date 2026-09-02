import { Vector3 } from "three";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateBezier } from "@/entities/trajectory/lib/evaluate-bezier";
import { evaluateBezierTangent } from "@/entities/trajectory/lib/evaluate-bezier-tangent";

export interface PathSample {
  position: Vector3;
  tangent: Vector3;
}

export function locateOnPath(trajectory: CompiledTrajectory, pathPosition: number): PathSample {
  const segments = trajectory.position_segments;
  if (segments.length === 0) {
    return { position: new Vector3(), tangent: new Vector3(0, 0, -1) };
  }

  const targetDistance = Math.min(1, Math.max(0, pathPosition)) * trajectory.total_length;
  let distanceBefore = 0;

  for (const segment of segments) {
    const distanceAfter = distanceBefore + segment.length;
    if (targetDistance <= distanceAfter || segment === segments.at(-1)) {
      const t = segment.length > 0 ? (targetDistance - distanceBefore) / segment.length : 0;
      const clampedT = Math.min(1, Math.max(0, t));
      return {
        position: evaluateBezier(segment, clampedT),
        tangent: evaluateBezierTangent(segment, clampedT),
      };
    }
    distanceBefore = distanceAfter;
  }

  return { position: new Vector3(), tangent: new Vector3(0, 0, -1) };
}
