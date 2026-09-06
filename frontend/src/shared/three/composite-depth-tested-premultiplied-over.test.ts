import { expect, it } from "vitest";
import { float, vec4 } from "three/tsl";

import { compositeDepthTestedPremultipliedOver } from "./composite-depth-tested-premultiplied-over";

it("builds a depth selection before premultiplied-over composition", () => {
  const result = compositeDepthTestedPremultipliedOver(
    vec4(0, 0, 0, 1),
    vec4(1, 1, 1, 0.5),
    float(2),
    float(1),
  );

  expect(result.isNode).toBe(true);
  expect(JSON.stringify(result.toJSON())).toContain('"type":"ConditionalNode"');
});
