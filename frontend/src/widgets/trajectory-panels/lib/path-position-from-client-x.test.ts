import { describe, expect, it } from "vitest";

import { GRAPH_WIDTH, PLOT_LEFT, PLOT_RIGHT } from "./graph-layout";
import { pathPositionFromClientX } from "./path-position-from-client-x";

describe("timeline scrub layout", () => {
  it("maps the shared plot bounds to a normalized path position", () => {
    expect(pathPositionFromClientX(PLOT_LEFT, 0, GRAPH_WIDTH)).toBe(0);
    expect(pathPositionFromClientX(PLOT_RIGHT, 0, GRAPH_WIDTH)).toBe(1);
    expect(
      pathPositionFromClientX((PLOT_LEFT + PLOT_RIGHT) / 2, 0, GRAPH_WIDTH),
    ).toBe(0.5);
  });

  it("clamps pointer positions outside the shared hit area", () => {
    expect(pathPositionFromClientX(-100, 0, GRAPH_WIDTH)).toBe(0);
    expect(pathPositionFromClientX(GRAPH_WIDTH + 100, 0, GRAPH_WIDTH)).toBe(1);
    expect(pathPositionFromClientX(10, 0, 0)).toBe(0);
  });
});
