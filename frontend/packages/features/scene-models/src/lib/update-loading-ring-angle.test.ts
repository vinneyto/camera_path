import { updateLoadingRingAngle } from "@camera-path/feature-scene-models/lib/update-loading-ring-angle";
import { BufferAttribute, RingGeometry } from "three";
import { expect, it } from "vitest";

it("matches RingGeometry arcs while retaining every buffer across progress updates", () => {
  const geometry = new RingGeometry(0.21, 0.3, 96, 1, Math.PI / 2);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.index;
  for (const fraction of [0.2, 0.9, 1, 0, 0.4]) {
    const angle = fraction * Math.PI * 2;
    const expected = new RingGeometry(0.21, 0.3, 96, 1, Math.PI / 2, angle);
    updateLoadingRingAngle(geometry, angle);
    expect(geometry.getAttribute("position")).toBe(position);
    expect(geometry.getAttribute("uv")).toBe(uv);
    expect(geometry.index).toBe(index);
    expect(geometry.boundingSphere?.center.toArray()).toEqual([0, 0, 0]);
    expect(geometry.boundingSphere?.radius).toBe(0.3);
    for (const name of ["position", "uv"]) {
      expect(Array.from(geometry.getAttribute(name).array)).toEqual(
        Array.from(expected.getAttribute(name).array),
      );
    }
    expected.dispose();
  }
  expect(position).toBeInstanceOf(BufferAttribute);
  expect((position as BufferAttribute).version).toBe(5);
  geometry.dispose();
});
