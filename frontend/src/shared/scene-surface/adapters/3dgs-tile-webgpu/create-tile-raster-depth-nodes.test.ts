import { describe, expect, it } from "vitest";
import { float } from "three/tsl";

import { createTileRasterDepthNodes } from "./create-tile-raster-depth-nodes";

describe("createTileRasterDepthNodes", () => {
  it("uses early break only for exact float32 sorting", () => {
    const viewDepth = float(1);
    const nodes = createTileRasterDepthNodes(viewDepth, "float32");

    expect(nodes.rasterPixelValueNode).toBe(viewDepth);
    expect(JSON.stringify(nodes.rasterBreakNode.toJSON())).toContain('"op":"<"');
    expect(JSON.stringify(nodes.rasterDiscardNode.toJSON())).toContain('"value":false');
  });

  it("uses discard for packed16 sorting", () => {
    const nodes = createTileRasterDepthNodes(float(1), "packed16");

    expect(JSON.stringify(nodes.rasterBreakNode.toJSON())).toContain('"value":false');
    expect(JSON.stringify(nodes.rasterDiscardNode.toJSON())).toContain('"op":"<"');
  });
});
