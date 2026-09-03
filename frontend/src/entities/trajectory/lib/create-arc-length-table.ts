import type { CompiledTrajectory } from "../model/types";

import { evaluateBezier } from "./evaluate-bezier";

export interface ArcLengthSample {
  segmentIndex: number;
  t: number;
  distance: number;
}

const tableCache = new WeakMap<CompiledTrajectory, ArcLengthSample[]>();

export function createArcLengthTable(
  trajectory: CompiledTrajectory,
  samplesPerSegment = 64,
): ArcLengthSample[] {
  const steps = Math.max(2, Math.floor(samplesPerSegment));
  const table: ArcLengthSample[] = [];
  let distanceBefore = 0;

  trajectory.position_segments.forEach((segment, segmentIndex) => {
    const localDistances = [0];
    let previous = evaluateBezier(segment, 0);

    for (let index = 1; index <= steps; index += 1) {
      const point = evaluateBezier(segment, index / steps);
      localDistances.push(localDistances.at(-1)! + point.distanceTo(previous));
      previous = point;
    }

    const sampledLength = localDistances.at(-1) ?? 0;
    const scale = sampledLength > 0 ? segment.length / sampledLength : 0;
    for (let index = 0; index <= steps; index += 1) {
      table.push({
        segmentIndex,
        t: index / steps,
        distance: distanceBefore + localDistances[index] * scale,
      });
    }
    distanceBefore += segment.length;
  });

  return table;
}

export function getArcLengthTable(trajectory: CompiledTrajectory): ArcLengthSample[] {
  const cached = tableCache.get(trajectory);
  if (cached) return cached;
  const table = createArcLengthTable(trajectory);
  tableCache.set(trajectory, table);
  return table;
}
