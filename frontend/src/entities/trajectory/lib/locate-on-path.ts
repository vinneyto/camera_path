import { Vector3 } from "three";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { getArcLengthTable } from "@/entities/trajectory/lib/create-arc-length-table";
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

  const table = getArcLengthTable(trajectory);
  if (table.length === 0) {
    return { position: new Vector3(), tangent: new Vector3(0, 0, -1) };
  }

  const targetDistance = Math.min(1, Math.max(0, pathPosition)) * trajectory.total_length;
  let low = 0;
  let high = table.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (table[middle].distance <= targetDistance) low = middle + 1;
    else high = middle;
  }

  const rightIndex = Math.min(table.length - 1, low);
  const leftIndex = Math.max(0, rightIndex - 1);
  const left = table[leftIndex];
  const right = table[rightIndex];
  const distanceWidth = right.distance - left.distance;
  const weight = distanceWidth > 0 ? (targetDistance - left.distance) / distanceWidth : 0;
  const segmentIndex = right.segmentIndex;
  const leftT = left.segmentIndex === segmentIndex ? left.t : 0;
  const t = leftT + (right.t - leftT) * Math.min(1, Math.max(0, weight));
  const segment = segments[segmentIndex];

  return {
    position: evaluateBezier(segment, t),
    tangent: evaluateBezierTangent(segment, t),
  };
}
