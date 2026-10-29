import { expect, it, vi } from "vitest";
import {
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  type WebGLRenderer,
} from "three";
import { WebGLRenderLists } from "three/src/renderers/webgl/WebGLRenderLists.js";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { SparkGaussianRenderingBackend } from "@camera-path/scene-runtime/surface/adapters/spark/spark-gaussian-rendering-backend";
import { SceneGrid } from "./scene-grid";

const pipeline = vi.hoisted(() => ({ enabled: false }));

vi.mock("@camera-path/render-pipeline", () => ({
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER: 3,
  useOptionalRenderPipeline: () => (pipeline.enabled ? {} : null),
}));

vi.mock("@sparkjsdev/spark", async () => {
  const { Mesh, MeshBasicMaterial, Object3D } = await import("three");
  return {
    SparkRenderer: class extends Mesh {
      constructor(options: {
        transparent?: boolean;
        depthTest?: boolean;
        depthWrite?: boolean;
      }) {
        super(
          undefined,
          new MeshBasicMaterial({
            transparent: options.transparent ?? true,
            depthTest: options.depthTest ?? true,
            depthWrite: options.depthWrite ?? false,
          }),
        );
      }
      dispose() {
        this.geometry.dispose();
        const materials = Array.isArray(this.material)
          ? this.material
          : [this.material];
        for (const material of materials) material.dispose();
      }
    },
    SplatMesh: Object3D,
  };
});

it("sorts grid, Spark and transparent helpers independently of camera distance and insertion order", () => {
  const grid = SceneGrid({
    dark: true,
    interactive: false,
    placementEvents: {},
  });
  const [plane, lines] = grid.props.children;
  const renderer = {
    getClearColor: (target: Color) => target.set("#123456"),
    getClearAlpha: () => 1,
    setClearColor: vi.fn(),
  } as unknown as WebGLRenderer;
  const backend = new SparkGaussianRenderingBackend({ renderer });
  const planeMesh = new Mesh(
    undefined,
    new MeshBasicMaterial(plane.props.children[1].props),
  );
  const gridLines = new LineSegments(
    undefined,
    new LineBasicMaterial(lines.props.children.props),
  );
  planeMesh.renderOrder = plane.props.renderOrder;
  gridLines.renderOrder = lines.props.renderOrder;

  // Trajectory/anchor helpers use the default order 0; camera and DOF use 1/2.
  const helpers = [0, 1, 2].map((renderOrder) => {
    const helper = new Mesh(
      undefined,
      new MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    helper.renderOrder = renderOrder;
    return helper;
  });
  const objects = [planeMesh, gridLines, backend.container, ...helpers];
  try {
    expect(backend.container.material.depthTest).toBe(true);
    expect(backend.container.material.depthWrite).toBe(false);
    expect(planeMesh.material.depthWrite).toBe(false);
    for (const depths of [
      [1, 2, 100, 500, 600, 700],
      [100, 90, 1, 2, 3, 4],
      [5, 5, 5, 5, 5, 5],
    ]) {
      for (const insertion of [
        [0, 1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1, 0],
      ]) {
        const list = new WebGLRenderLists(new WebGLProperties()).get(
          new Scene(),
          0,
        );
        for (const i of insertion) {
          const object = objects[i];
          expect(object.material.transparent).toBe(true);
          list.push(
            object,
            object.geometry,
            object.material,
            0,
            depths[i],
            null,
          );
        }
        // Use Three's actual queue routing and default transparent comparator.
        // @ts-expect-error Three accepts null comparators; its typings omit it.
        list.sort(null, null, false);
        expect(list.opaque).toHaveLength(0);
        expect(list.transmissive).toHaveLength(0);
        expect(list.transparent.map((item) => item.object)).toEqual(objects);
      }
    }
  } finally {
    for (const object of [planeMesh, gridLines, ...helpers]) {
      object.geometry.dispose();
      object.material.dispose();
    }
    backend.dispose();
  }
});

it("keeps the WebGPU pre-splat layer and grid depth settings unchanged", () => {
  pipeline.enabled = true;
  try {
    const grid = SceneGrid({
      dark: false,
      interactive: false,
      placementEvents: {},
    });
    const [plane, lines] = grid.props.children;
    expect(plane.props.renderOrder).toBe(-2);
    expect(lines.props.renderOrder).toBe(-1);
    expect(plane.props.children[1].props.depthWrite).toBe(true);
    expect(lines.props.children.props.depthWrite).toBe(false);
    for (const element of [plane, lines]) {
      const object = new Object3D();
      element.props.onUpdate(object);
      expect(object.layers.isEnabled(3)).toBe(true);
      expect(object.layers.isEnabled(0)).toBe(false);
    }
  } finally {
    pipeline.enabled = false;
  }
});
