import { evaluateBezier } from "@camera-path/trajectory-math/lib/evaluate-bezier";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";

export function sampleTrajectory(
  trajectory: Pick<CompiledTrajectory, "position_segments">,
  stepsPerSegment = 32,
): [number, number, number][] {
  return trajectory.position_segments.flatMap((segment, segmentIndex) =>
    Array.from({ length: stepsPerSegment + 1 }, (_, index) => {
      if (segmentIndex > 0 && index === 0) return null;
      const point = evaluateBezier(segment, index / stepsPerSegment);
      return point.toArray() as [number, number, number];
    }).filter((point): point is [number, number, number] => point !== null),
  );
}
