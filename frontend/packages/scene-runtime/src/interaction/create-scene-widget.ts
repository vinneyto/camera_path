import {
  HOVERABLE,
  SELECTABLE,
  RENDER_PIPELINE_OVERLAY_LAYER,
} from "@camera-path/render-pipeline";
import { Object3D, type Camera, type Material, type Scene } from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { SceneObjectTransform } from "@camera-path/types/scene-object-transform";
import { WIDGET_RENDER_ORDER, WIDGET_SIZE } from "./constants";
import { hasTransformChange } from "./has-transform-change";
import { readWidgetTransform } from "./read-widget-transform";
import { syncWidgetPose } from "./sync-widget-pose";
import type {
  WidgetCallbacks,
  WidgetOptions,
  WidgetPose,
} from "./widget-types";

export function createSceneWidget({
  scene,
  camera,
  canvas,
  sceneObjectID,
  getOrbitControls,
  canRestoreOrbit = () => true,
  callbacks,
  initial,
}: {
  scene: Scene;
  camera: Camera;
  canvas: HTMLCanvasElement;
  sceneObjectID: string;
  getOrbitControls: () => { enabled: boolean } | null;
  canRestoreOrbit?: () => boolean;
  callbacks: WidgetCallbacks;
  initial: WidgetOptions;
}) {
  const proxy = new Object3D();
  proxy.name = `widget-target:${sceneObjectID}`;
  const previousTouchAction = canvas.style.touchAction;
  const controls = new TransformControls(camera, canvas);
  const helper = controls.getHelper();
  helper.name = `widget:${sceneObjectID}`;
  helper.traverse((object) => {
    object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
    object.renderOrder = WIDGET_RENDER_ORDER;
    const materials = (
      object as Object3D & { material?: Material | Material[] }
    ).material;
    for (const material of Array.isArray(materials)
      ? materials
      : materials
        ? [materials]
        : []) {
      material.transparent = true;
      material.depthTest = false;
      material.depthWrite = false;
    }
  });
  // A handle click retains the same logical selection, even without movement.
  helper.userData.sceneObjectID = sceneObjectID;
  helper.layers.enable(HOVERABLE);
  helper.layers.enable(SELECTABLE);
  const raycaster = controls.getRaycaster();
  const previousLayers = raycaster.layers.mask;
  raycaster.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
  controls.setSize(WIDGET_SIZE);
  scene.add(proxy, helper);
  controls.attach(proxy);
  let options = initial;
  let session: {
    pose: WidgetPose;
    mode: WidgetOptions["mode"];
    value: SceneObjectTransform;
  } | null = null;
  let orbit: { enabled: boolean } | null = null;
  let orbitEnabled = false;
  let pointerId: number | null = null;
  let disposed = false;
  function restoreOrbit() {
    if (orbit && canRestoreOrbit() && getOrbitControls() === orbit)
      orbit.enabled = orbitEnabled;
    orbit = null;
  }
  function start() {
    session = {
      pose: {
        transform: {
          position: [...options.transform.position],
          quaternion: [...options.transform.quaternion],
          scale: [...options.transform.scale],
        },
        parentMatrix: options.parentMatrix.clone(),
        parentRotation: options.parentRotation.clone(),
      },
      mode: options.mode,
      value: options.transform,
    };
    orbit = getOrbitControls();
    orbitEnabled = orbit?.enabled ?? false;
    if (orbit) orbit.enabled = false;
    callbacks.onStart();
  }
  function change() {
    if (!session) return;
    session.value = readWidgetTransform(proxy, session.pose, session.mode);
    callbacks.onChange(session.value);
  }
  function finish() {
    if (!session) return;
    const completed = session;
    session = null;
    restoreOrbit();
    if (hasTransformChange(completed.pose.transform, completed.value))
      callbacks.onCommit(completed.value);
    else callbacks.onCancel();
  }
  function cancel() {
    if (!session) return;
    const cancelled = session;
    session = null;
    controls.dragging = false;
    controls.axis = null;
    syncWidgetPose(proxy, cancelled.pose);
    if (pointerId !== null && canvas.hasPointerCapture?.(pointerId))
      canvas.releasePointerCapture(pointerId);
    // TransformControls has no pointercancel handler; release its drag listener too.
    controls.disconnect();
    if (!disposed) controls.connect(canvas);
    restoreOrbit();
    callbacks.onCancel();
  }
  function pointerDown(event: PointerEvent) {
    pointerId = event.pointerId;
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && session) {
      event.preventDefault();
      cancel();
    }
  }
  const target = canvas.ownerDocument.defaultView!;
  controls.addEventListener("mouseDown", start);
  controls.addEventListener("objectChange", change);
  controls.addEventListener("mouseUp", finish);
  canvas.addEventListener("pointerdown", pointerDown, true);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  target.addEventListener("blur", cancel);
  target.addEventListener("keydown", keyDown);
  function update(next: WidgetOptions) {
    if (disposed) return;
    if (session && (!next.enabled || next.mode !== options.mode)) cancel();
    options = next;
    controls.enabled = next.enabled;
    controls.setMode(next.mode === "position" ? "translate" : "rotate");
    controls.setSpace(next.mode === "position" ? "world" : "local");
    if (!session) syncWidgetPose(proxy, next);
  }
  update(initial);
  return {
    controls,
    helper,
    proxy,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      restoreOrbit();
      canvas.removeEventListener("pointerdown", pointerDown, true);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
      target.removeEventListener("blur", cancel);
      target.removeEventListener("keydown", keyDown);
      controls.removeEventListener("mouseDown", start);
      controls.removeEventListener("objectChange", change);
      controls.removeEventListener("mouseUp", finish);
      controls.detach();
      controls.dispose();
      scene.remove(proxy, helper);
      raycaster.layers.mask = previousLayers;
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
