import type { Interpolation } from "@/entities/project/model/types";

export function interpolationWeight(value: number, interpolation: Interpolation): number {
  const t = Math.min(1, Math.max(0, value));
  if (interpolation === "hold") return 0;
  if (interpolation === "linear") return t;
  return t * t * (3 - 2 * t);
}
