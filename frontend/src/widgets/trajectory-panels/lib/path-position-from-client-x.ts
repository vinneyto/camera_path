import { GRAPH_WIDTH, PLOT_LEFT, PLOT_WIDTH } from "./graph-layout";

export function pathPositionFromClientX(clientX: number, left: number, width: number) {
  if (width <= 0) return 0;
  const graphCoordinate = ((clientX - left) / width) * GRAPH_WIDTH;
  return Math.min(1, Math.max(0, (graphCoordinate - PLOT_LEFT) / PLOT_WIDTH));
}
