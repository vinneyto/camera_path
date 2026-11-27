import { Layers, Object3D, Raycaster } from "three";
import { expect, test } from "vitest";

import { WIDGET_PICK_LAYER } from "./scene-interaction-layers";
import { configureInteractiveRaycasterLayers } from "./configure-interactive-raycaster-layers";
import {
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
  RENDER_PIPELINE_SCENE_LAYER,
  RENDER_PIPELINE_DECORATION_LAYER,
} from "./render-pipeline-scene-layers";

test("enables scene and overlay picking without enabling debug layers", () => {
  const raycaster = new Raycaster();
  const object = new Object3D();

  configureInteractiveRaycasterLayers(raycaster);

  object.layers.set(RENDER_PIPELINE_SCENE_LAYER);
  expect(raycaster.layers.test(object.layers)).toBe(true);
  object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
  expect(raycaster.layers.test(object.layers)).toBe(true);
  object.layers.set(RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER);
  expect(raycaster.layers.test(object.layers)).toBe(true);
  for (const layer of [
    2,
    RENDER_PIPELINE_DECORATION_LAYER,
    WIDGET_PICK_LAYER,
  ]) {
    object.layers.set(layer);
    expect(raycaster.layers.test(object.layers)).toBe(false);
  }

  const expected = new Layers();
  expected.disableAll();
  expected.enable(RENDER_PIPELINE_SCENE_LAYER);
  expected.enable(RENDER_PIPELINE_OVERLAY_LAYER);
  expected.enable(RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER);
  expect(raycaster.layers.mask).toBe(expected.mask);
});
