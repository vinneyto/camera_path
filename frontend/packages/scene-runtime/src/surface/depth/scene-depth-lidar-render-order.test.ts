import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  Matrix4,
  type Material,
} from "three";
import { WebGLRenderList } from "three/src/renderers/webgl/WebGLRenderLists.js";
import { WebGLProperties } from "three/src/renderers/webgl/WebGLProperties.js";
import { expect, it } from "vitest";
import { SPARK_RENDER_ORDER } from "../adapters/spark/constants";
import { createLidarHitMesh } from "./create-lidar-hit-mesh";
import { createSparkLidarHitMaterial } from "../adapters/spark/create-spark-lidar-hit-material";

it("queues hit spheres after Spark, independently of distance, while respecting opaque mesh depth", () => {
  const settings = {
      horizontalResolution: 4,
      verticalResolution: 1,
      verticalFovDegrees: 60,
    },
    texture = new Texture();
  const object = createLidarHitMesh(
    createSparkLidarHitMaterial(texture, new Matrix4(), settings),
    settings,
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
  const hitMaterial = object.material as Material;

  for (const distance of [-100, 100]) {
    const list = new WebGLRenderList(new WebGLProperties());
    // Insert hits first to ensure traversal order cannot mask a regression.
    list.push(object, object.geometry, hitMaterial, 0, distance, null);
    list.push(spark, geometry, sparkMaterial, 0, 0, null);
    list.push(opaque, geometry, opaqueMaterial, 0, 0, null);
    // Exercise Three's default opaque/transparent sorting.
    Reflect.apply(list.sort, list, [undefined, undefined, false]);
    expect(list.opaque.map((item) => item.object)).toEqual([opaque]);
    expect(list.transparent.map((item) => item.object)).toEqual([
      spark,
      object,
    ]);
  }
  expect(hitMaterial.transparent).toBe(true);
  expect(hitMaterial.opacity).toBe(0.5);
  expect(hitMaterial.depthTest).toBe(true);
  expect(hitMaterial.depthWrite).toBe(false);
  object.geometry.dispose();
  object.material.dispose();
  texture.dispose();
  geometry.dispose();
  sparkMaterial.dispose();
  opaqueMaterial.dispose();
});
