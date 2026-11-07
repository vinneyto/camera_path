export const TRAJECTORY_LINE_COLORS = {
  hovered: "#fb923c",
  selected: "#f97316",
  dark: "#e5e7eb",
  light: "#171717",
} as const;

export const TRAJECTORY_LINE_RADIUS = {
  normal: 0.014,
  selected: 0.018,
} as const;

export const TRAJECTORY_LINE_WIDTH = {
  normal: 3,
  highlighted: 4,
} as const;

export const TRAJECTORY_LINE_HIT_SLOP = 0.025;
export const TRAJECTORY_LINE_MIN_POINTS = 2;

export const TRAJECTORY_LINE_WEBGPU_HIT_SLOP = {
  normal: 6.5,
  selected: 6,
} as const;
