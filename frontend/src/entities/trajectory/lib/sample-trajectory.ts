import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateBezier } from "@/entities/trajectory/lib/evaluate-bezier";

export function sampleTrajectory(trajectory: CompiledTrajectory, stepsPerSegment = 32): [number, number, number][] {
  return trajectory.position_segments.flatMap((segment, segmentIndex) =>
    Array.from({ length: stepsPerSegment + 1 }, (_, index) => {
      if (segmentIndex > 0 && index === 0) return null;
      const point = evaluateBezier(segment, index / stepsPerSegment);
      return point.toArray() as [number, number, number];
    }).filter((point): point is [number, number, number] => point !== null),
  );
}
