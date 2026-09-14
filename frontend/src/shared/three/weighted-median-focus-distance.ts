export interface AutofocusDistanceSample {
  readonly distance: number;
  readonly weight: number;
}

export function weightedMedianFocusDistance(
  samples: readonly AutofocusDistanceSample[],
): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort(
    (left, right) => left.distance - right.distance,
  );
  const middleWeight =
    sorted.reduce((total, sample) => total + sample.weight, 0) / 2;
  let accumulatedWeight = 0;
  for (const sample of sorted) {
    accumulatedWeight += sample.weight;
    if (accumulatedWeight >= middleWeight) return sample.distance;
  }
  return sorted.at(-1)!.distance;
}
