// @vitest-environment happy-dom
import { Matrix4, PerspectiveCamera, Quaternion, Scene, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import {
  HOVERABLE,
  SELECTABLE,
  RENDER_PIPELINE_OVERLAY_LAYER,
} from "@camera-path/render-pipeline";
import { createSceneWidget } from "./create-scene-widget";
import { readWidgetTransform } from "./read-widget-transform";
import { syncWidgetPose } from "./sync-widget-pose";
import { Object3D } from "three";
import type { WidgetOptions } from "./widget-types";

function setup(mode: WidgetOptions["mode"] = "position") {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 400, 400);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  const orbit = { enabled: true };
  const callbacks = {
    onStart: vi.fn(),
    onChange: vi.fn(),
    onCommit: vi.fn(),
    onCancel: vi.fn(),
  };
  const initial: WidgetOptions = {
    enabled: true,
    mode,
    transform: {
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 2, 1],
    },
    parentMatrix: new Matrix4(),
    parentRotation: new Quaternion(),
  };
  const widget = createSceneWidget({
    scene,
    camera,
    canvas,
    sceneObjectID: "model",
    initial,
    getOrbitControls: () => orbit,
    callbacks,
  });
  scene.updateMatrixWorld(true);
  return { scene, canvas, camera, orbit, callbacks, initial, widget };
}

it("uses the real gizmo plane for a world-axis drag, previews repeatedly and commits once", () => {
  const test = setup();
  const { widget, callbacks, orbit } = test;
  try {
    expect(widget.helper.layers.isEnabled(SELECTABLE)).toBe(true);
    expect(widget.helper.layers.isEnabled(HOVERABLE)).toBe(true);
    expect(widget.helper.layers.isEnabled(RENDER_PIPELINE_OVERLAY_LAYER)).toBe(
      true,
    );
    expect(widget.helper.userData.sceneObjectID).toBe("model");
    widget.controls.axis = "X";
    widget.controls.pointerDown({ x: 0.1, y: 0, button: 0 } as PointerEvent);
    expect(callbacks.onStart).toHaveBeenCalledOnce();
    expect(orbit.enabled).toBe(false);
    for (const x of [0.2, 0.3, 0.4])
      widget.controls.pointerMove({ x, y: 0, button: -1 } as PointerEvent);
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    const changed = callbacks.onChange.mock.calls.at(-1)![0];
    expect(changed.position[0]).toBeGreaterThan(0);
    expect(changed.position.slice(1)).toEqual([0, 0]);
    expect(changed.scale).toEqual([1, 2, 1]);
    widget.controls.pointerUp({ x: 0.4, y: 0, button: 0 } as PointerEvent);
    expect(callbacks.onCommit).toHaveBeenCalledExactlyOnceWith(changed);
    expect(orbit.enabled).toBe(true);
  } finally {
    widget.dispose();
  }
  expect(test.scene.children).toHaveLength(0);
});

it.each(["Escape", "pointercancel", "blur", "dispose", "mode"])(
  "cancels %s without a commit and restores camera controls",
  (reason) => {
    const { widget, callbacks, orbit, canvas, initial } = setup();
    widget.controls.axis = "X";
    widget.controls.pointerDown({ x: 0.1, y: 0, button: 0 } as PointerEvent);
    widget.controls.pointerMove({ x: 0.3, y: 0, button: -1 } as PointerEvent);
    if (reason === "Escape")
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    if (reason === "blur") window.dispatchEvent(new Event("blur"));
    if (reason === "pointercancel")
      canvas.dispatchEvent(new PointerEvent("pointercancel"));
    if (reason === "dispose") widget.dispose();
    if (reason === "mode") widget.update({ ...initial, mode: "rotation" });
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    expect(orbit.enabled).toBe(true);
    expect(widget.proxy.position.toArray()).toEqual([0, 0, 0]);
    widget.dispose();
  },
);

it("converts world displacement exactly through a scaled/rotated parent and rotates local quaternion without changing position or scale", () => {
  const parentRotation = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    Math.PI / 2,
  );
  const parentMatrix = new Matrix4().compose(
    new Vector3(10, 0, 0),
    parentRotation,
    new Vector3(2, 3, 4),
  );
  const pose = {
    parentMatrix,
    parentRotation,
    transform: {
      position: [1, 2, 3] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
      scale: [1, 2, 1] as [number, number, number],
    },
  };
  const proxy = new Object3D();
  syncWidgetPose(proxy, pose);
  const original = proxy.position.clone();
  proxy.position.add(new Vector3(3, 0, 0));
  const translated = readWidgetTransform(proxy, pose, "position");
  const actualWorld = new Vector3(...translated.position).applyMatrix4(
    parentMatrix,
  );
  expect(
    actualWorld.distanceTo(original.clone().add(new Vector3(3, 0, 0))),
  ).toBeLessThan(1e-8);
  expect(translated.quaternion).toEqual([0, 0, 0, 1]);
  syncWidgetPose(proxy, pose);
  const localDelta = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    Math.PI / 4,
  );
  proxy.quaternion.multiply(localDelta);
  const rotated = readWidgetTransform(proxy, pose, "rotation");
  expect(
    new Quaternion(...rotated.quaternion).angleTo(localDelta),
  ).toBeLessThan(1e-7);
  expect(rotated.position).toEqual(pose.transform.position);
  expect(rotated.scale).toEqual(pose.transform.scale);
});
