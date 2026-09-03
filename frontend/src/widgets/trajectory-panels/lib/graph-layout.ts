export const GRAPH_WIDTH = 400;
export const GRAPH_HEIGHT = 92;
export const PLOT_LEFT = 46;
export const PLOT_RIGHT = 388;
export const PLOT_TOP = 8;
export const PLOT_BOTTOM = 66;
export const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;

export function graphX(pathPosition: number) {
  return PLOT_LEFT + Math.min(1, Math.max(0, pathPosition)) * PLOT_WIDTH;
}

export function graphLeft(pathPosition: number) {
  return `${(graphX(pathPosition) / GRAPH_WIDTH) * 100}%`;
}
