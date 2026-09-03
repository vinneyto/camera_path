import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateSpeed } from "@/entities/trajectory/lib/evaluate-speed";

export interface PlaybackSample {
  pathPosition: number;
  time: number;
}

export function createPlaybackTable(
  trajectory: CompiledTrajectory,
  sampleCount = 512,
): PlaybackSample[] {
  if (trajectory.total_length <= 0) return [{ pathPosition: 0, time: 0 }];

  const table: PlaybackSample[] = [{ pathPosition: 0, time: 0 }];
  let time = 0;
  for (let index = 1; index <= sampleCount; index += 1) {
    const previousPosition = (index - 1) / sampleCount;
    const pathPosition = index / sampleCount;
    const meanSpeed = (evaluateSpeed(trajectory, previousPosition) + evaluateSpeed(trajectory, pathPosition)) / 2;
    time += trajectory.total_length / sampleCount / Math.max(meanSpeed, 1e-6);
    table.push({ pathPosition, time });
  }

  if (time > 0 && trajectory.duration_seconds > 0) {
    const durationScale = trajectory.duration_seconds / time;
    const scaled = table.map((sample) => ({ ...sample, time: sample.time * durationScale }));
    scaled[scaled.length - 1] = { pathPosition: 1, time: trajectory.duration_seconds };
    return scaled;
  }
  return table;
}
