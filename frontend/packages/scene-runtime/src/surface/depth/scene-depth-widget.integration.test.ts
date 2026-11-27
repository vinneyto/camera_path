// @vitest-environment happy-dom
import { RENDER_PIPELINE_OVERLAY_LAYER } from "@camera-path/render-pipeline";
import { MeshBasicMaterial, Object3D, PerspectiveCamera, Scene } from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { expect, it } from "vitest";
import { SceneDepthMaterials } from "./scene-depth-materials";

it("keeps live transform handle materials intact during the depth render's matrix update", () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  const controls = new TransformControls(
    camera,
    document.createElement("canvas"),
  );
  const helper = controls.getHelper(),
    target = new Object3D();
  helper.traverse((object) => object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER));
  scene.add(target, helper);
  controls.attach(target);
  const depth = new SceneDepthMaterials(() => new MeshBasicMaterial());
  try {
    expect(() =>
      depth.draw(scene, () => scene.updateMatrixWorld(true)),
    ).not.toThrow();
  } finally {
    controls.dispose();
    depth.dispose();
  }
});
