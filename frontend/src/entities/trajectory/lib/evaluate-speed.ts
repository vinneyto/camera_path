import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { interpolationWeight } from "@/entities/trajectory/lib/interpolation-weight";
import { speedControls } from "@/entities/trajectory/lib/speed-controls";

export function evaluateSpeed(trajectory: CompiledTrajectory, pathPosition: number): number {
  const controls = speedControls(trajectory);
  const position = Math.min(1, Math.max(0, pathPosition));

  for (let index = 0; index < controls.length - 1; index += 1) {
    const left = controls[index];
    const right = controls[index + 1];
    if (position <= right.pathPosition) {
      const width = right.pathPosition - left.pathPosition;
      if (width <= 0) return right.speed;
      const weight = interpolationWeight((position - left.pathPosition) / width, left.interpolation);
      return left.speed + (right.speed - left.speed) * weight;
    }
  }
  return controls.at(-1)?.speed ?? trajectory.motion_profile.default_speed;
}
