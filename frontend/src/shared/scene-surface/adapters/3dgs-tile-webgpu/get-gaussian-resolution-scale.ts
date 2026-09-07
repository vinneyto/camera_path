import type { GaussianDprMode } from "../../model/gaussian-dpr-mode";

export function getGaussianResolutionScale(
  mode: GaussianDprMode,
  systemDpr: number,
): number {
  if (!Number.isFinite(systemDpr) || systemDpr <= 0) {
    throw new RangeError("systemDpr must be a positive finite number");
  }
  return mode === "system" ? 1 : 1 / systemDpr;
}
