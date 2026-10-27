import { expect, it } from "vitest";
import {
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  BoxGeometry,
  Vector2,
} from "three";
import {
  DEPTH_OF_FIELD_AUTOFOCUS_LAYER,
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
} from "@camera-path/render-pipeline";
import { configureWebGlViewport } from "./configure-webgl-viewport";

it("renders overlays and the grid alongside the scene, without exposing autofocus-only objects", () => {
  const camera = new PerspectiveCamera();
  const raycaster = new Raycaster();
  configureWebGlViewport({ camera, raycaster });
  const object = new Object3D();
  for (const layer of [
    0,
    RENDER_PIPELINE_OVERLAY_LAYER,
    RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
  ]) {
    object.layers.set(layer);
    expect(camera.layers.test(object.layers)).toBe(true);
  }
  object.layers.set(DEPTH_OF_FIELD_AUTOFOCUS_LAYER);
  expect(camera.layers.test(object.layers)).toBe(false);
});

it("picks trajectory overlays and the grid while ignoring autofocus-only geometry", () => {
  const camera = new PerspectiveCamera();
  const raycaster = new Raycaster();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  const object = new Mesh(geometry, material);
  object.position.z = -2;
  object.updateMatrixWorld();
  configureWebGlViewport({ camera, raycaster });
  raycaster.setFromCamera(new Vector2(0.1, 0.05), camera);
  try {
    for (const layer of [
      0,
      RENDER_PIPELINE_OVERLAY_LAYER,
      RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
    ]) {
      object.layers.set(layer);
      expect(raycaster.intersectObject(object).length).toBeGreaterThan(0);
    }
    object.layers.set(DEPTH_OF_FIELD_AUTOFOCUS_LAYER);
    expect(raycaster.intersectObject(object)).toEqual([]);
  } finally {
    geometry.dispose();
    material.dispose();
  }
});
