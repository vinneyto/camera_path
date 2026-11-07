import {
  TRAJECTORY_LINE_COLORS,
  TRAJECTORY_LINE_HIT_SLOP,
  TRAJECTORY_LINE_RADIUS,
  TRAJECTORY_LINE_WEBGPU_HIT_SLOP,
  TRAJECTORY_LINE_WIDTH,
} from "../constants";

interface TrajectoryLineAppearanceState {
  dark: boolean;
  hovered: boolean;
  selected: boolean;
}

export function selectTrajectoryLineAppearance({
  dark,
  hovered,
  selected,
}: TrajectoryLineAppearanceState) {
  let color: string = dark
    ? TRAJECTORY_LINE_COLORS.dark
    : TRAJECTORY_LINE_COLORS.light;
  if (selected) color = TRAJECTORY_LINE_COLORS.selected;
  if (hovered) color = TRAJECTORY_LINE_COLORS.hovered;

  return {
    color,
    hitSlop: TRAJECTORY_LINE_HIT_SLOP,
    radius: selected
      ? TRAJECTORY_LINE_RADIUS.selected
      : TRAJECTORY_LINE_RADIUS.normal,
    webGpuHitSlop: selected
      ? TRAJECTORY_LINE_WEBGPU_HIT_SLOP.selected
      : TRAJECTORY_LINE_WEBGPU_HIT_SLOP.normal,
    width:
      selected || hovered
        ? TRAJECTORY_LINE_WIDTH.highlighted
        : TRAJECTORY_LINE_WIDTH.normal,
  };
}
