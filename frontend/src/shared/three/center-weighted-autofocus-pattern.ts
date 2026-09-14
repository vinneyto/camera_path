export interface AutofocusRaySample {
  readonly x: number;
  readonly y: number;
  readonly weight: number;
}

const RADIUS = 0.04;

export const CENTER_WEIGHTED_AUTOFOCUS_PATTERN: readonly AutofocusRaySample[] =
  [
    { x: 0, y: 0, weight: 6 },
    { x: -RADIUS, y: 0, weight: 2 },
    { x: RADIUS, y: 0, weight: 2 },
    { x: 0, y: -RADIUS, weight: 2 },
    { x: 0, y: RADIUS, weight: 2 },
    { x: -RADIUS, y: -RADIUS, weight: 1 },
    { x: RADIUS, y: -RADIUS, weight: 1 },
    { x: -RADIUS, y: RADIUS, weight: 1 },
    { x: RADIUS, y: RADIUS, weight: 1 },
  ];
