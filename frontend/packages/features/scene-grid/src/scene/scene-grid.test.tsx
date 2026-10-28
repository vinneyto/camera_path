import { expect, it, vi } from "vitest";
import { Mesh, MeshBasicMaterial, Scene } from "three";
import { WebGLRenderLists } from "three/src/renderers/webgl/WebGLRenderLists.js";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { SceneGrid } from "./scene-grid";

vi.mock("@camera-path/render-pipeline", () => ({
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER: 3,
  useOptionalRenderPipeline: () => null,
}));

it("sorts the plane and grid lines before transparent splats regardless of distance", () => {
  const grid = SceneGrid({
    dark: true,
    interactive: false,
    placementEvents: {},
  });
  const [plane, lines] = grid.props.children;
  for (const depths of [
    [1, 2, 100],
    [100, 2, 1],
    [5, 5, 5],
  ]) {
    const list = new WebGLRenderLists(new WebGLProperties()).get(
      new Scene(),
      0,
    );
    const material = new MeshBasicMaterial({ transparent: true });
    const objects = [new Mesh(), new Mesh(), new Mesh()];
    objects[0].renderOrder = plane.props.renderOrder;
    objects[1].renderOrder = lines.props.renderOrder;
    for (const i of [2, 1, 0]) {
      list.push(objects[i], null, material, 0, depths[i], null);
    }
    // Three accepts null to select its built-in comparators; its typings omit it.
    // @ts-expect-error Use the actual renderer defaults rather than a test comparator.
    list.sort(null, null, false);
    expect(list.transparent.map((item) => item.object)).toEqual(objects);
    material.dispose();
  }
});
