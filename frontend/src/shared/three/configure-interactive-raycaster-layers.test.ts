import { Layers, Object3D, Raycaster } from "three";
import { expect, test } from "vitest";

import { configureInteractiveRaycasterLayers } from "./configure-interactive-raycaster-layers";
import {
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_SCENE_LAYER,
} from "./render-pipeline-scene-layers";

test("enables scene and overlay picking without enabling debug layers", () => {
  const raycaster = new Raycaster();
  const object = new Object3D();

  configureInteractiveRaycasterLayers(raycaster);

  object.layers.set(RENDER_PIPELINE_SCENE_LAYER);
  expect(raycaster.layers.test(object.layers)).toBe(true);
  object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
  expect(raycaster.layers.test(object.layers)).toBe(true);
  object.layers.set(2);
  expect(raycaster.layers.test(object.layers)).toBe(false);

  const expected = new Layers();
  expected.disableAll();
  expected.enable(RENDER_PIPELINE_SCENE_LAYER);
  expected.enable(RENDER_PIPELINE_OVERLAY_LAYER);
  expect(raycaster.layers.mask).toBe(expected.mask);
});
