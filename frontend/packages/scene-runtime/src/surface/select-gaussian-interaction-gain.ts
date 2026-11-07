import { GAUSSIAN_HOVER_GAIN, GAUSSIAN_SELECTED_GAIN } from "./constants";

export function selectGaussianInteractionGain(
  hovered: boolean,
  selected: boolean,
) {
  if (selected) return GAUSSIAN_SELECTED_GAIN;
  return hovered ? GAUSSIAN_HOVER_GAIN : 1;
}
