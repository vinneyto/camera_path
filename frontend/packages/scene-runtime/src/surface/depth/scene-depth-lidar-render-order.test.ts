import { Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial } from "three";
import { WebGLRenderList } from "three/src/renderers/webgl/WebGLRenderLists.js";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { expect, it, vi } from "vitest";
import { SPARK_RENDER_ORDER } from "../adapters/spark/constants";
import { SceneDepthLidar } from "./scene-depth-lidar";

it("queues hit spheres after Spark, independently of distance, while respecting opaque mesh depth", () => {
  const lidar = new SceneDepthLidar(
    { capture: vi.fn(), dispose: vi.fn() },
    { horizontalResolution: 4, verticalResolution: 1, verticalFovDegrees: 60 },
  );
  const geometry = new PlaneGeometry();
  const sparkMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
  });
  const spark = new Mesh(geometry, sparkMaterial);
  spark.renderOrder = SPARK_RENDER_ORDER;
  const opaqueMaterial = new MeshBasicMaterial();
  const opaque = new Mesh(geometry, opaqueMaterial);
  const hitMaterial = lidar.object.material as MeshBasicMaterial;

  for (const distance of [-100, 100]) {
    const list = new WebGLRenderList(new WebGLProperties());
    // Insert hits first to ensure traversal order cannot mask a regression.
    list.push(
      lidar.object,
      lidar.object.geometry,
      hitMaterial,
      0,
      distance,
      null,
    );
    list.push(spark, geometry, sparkMaterial, 0, 0, null);
    list.push(opaque, geometry, opaqueMaterial, 0, 0, null);
    // Exercise Three's default opaque/transparent sorting.
    Reflect.apply(list.sort, list, [undefined, undefined, false]);
    expect(list.opaque.map((item) => item.object)).toEqual([opaque]);
    expect(list.transparent.map((item) => item.object)).toEqual([
      spark,
      lidar.object,
    ]);
  }
  expect(hitMaterial.transparent).toBe(true);
  expect(hitMaterial.opacity).toBe(0.5);
  expect(hitMaterial.depthTest).toBe(true);
  expect(hitMaterial.depthWrite).toBe(false);
  lidar.dispose();
  geometry.dispose();
  sparkMaterial.dispose();
  opaqueMaterial.dispose();
});
