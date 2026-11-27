import { Euler, type PerspectiveCamera } from "three";

const MOVE_SPEED = 5; // metres per second
const LOOK_SPEED = 0.003; // radians per pixel
const PITCH_LIMIT = Math.PI / 2 - 0.001;
const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);

export function createFreeFlightControls(
  camera: PerspectiveCamera,
  element: HTMLElement,
  onStart: () => void,
  onChange: () => void,
) {
  const keys = new Set<string>();
  const rotation = new Euler(0, 0, 0, "YXZ");
  const previousTabIndex = element.getAttribute("tabindex");
  let drag: { id: number; x: number; y: number } | null = null;
  let disposed = false;
  element.tabIndex = 0;

  const applyRotation = () => {
    rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, rotation.x));
    rotation.z = 0;
    camera.quaternion.setFromEuler(rotation);
    camera.up.set(0, 1, 0);
    camera.updateMatrixWorld();
  };
  rotation.setFromQuaternion(camera.quaternion, "YXZ");
  applyRotation();

  const reset = () => {
    keys.clear();
    const pointerId = drag?.id;
    drag = null;
    if (pointerId !== undefined && element.hasPointerCapture(pointerId))
      element.releasePointerCapture(pointerId);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (
      event.target !== element ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !MOVEMENT_KEYS.has(event.code)
    )
      return;
    event.preventDefault();
    if (!keys.size) onStart();
    keys.add(event.code);
  };
  const keyUp = (event: KeyboardEvent) => {
    if (keys.delete(event.code)) event.preventDefault();
  };
  const pointerDown = (event: PointerEvent) => {
    element.focus({ preventScroll: true });
    if (event.button !== 2) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    // Framing or editing tools may have changed the pose since the last drag.
    rotation.setFromQuaternion(camera.quaternion, "YXZ");
    element.setPointerCapture(event.pointerId);
    onStart();
  };
  const pointerMove = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    rotation.y -= (event.clientX - drag.x) * LOOK_SPEED;
    rotation.x -= (event.clientY - drag.y) * LOOK_SPEED;
    drag.x = event.clientX;
    drag.y = event.clientY;
    applyRotation();
    onChange();
  };
  const pointerUp = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (element.hasPointerCapture(event.pointerId))
      element.releasePointerCapture(event.pointerId);
  };
  const contextMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const wheel = (event: WheelEvent) => {
    // Trackpad pinch/OS zoom should retain its usual meaning.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const unit =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? element.clientHeight
          : 1;
    onStart();
    camera.translateZ(
      Math.max(-1000, Math.min(1000, event.deltaY * unit)) * 0.01,
    );
    camera.updateMatrixWorld();
    onChange();
  };
  const visibilityChange = () => {
    if (document.hidden) reset();
  };

  element.addEventListener("keydown", keyDown);
  element.addEventListener("keyup", keyUp);
  element.addEventListener("blur", reset);
  element.addEventListener("pointerdown", pointerDown);
  element.addEventListener("pointermove", pointerMove);
  element.addEventListener("pointerup", pointerUp);
  element.addEventListener("pointercancel", reset);
  element.addEventListener("lostpointercapture", reset);
  element.addEventListener("contextmenu", contextMenu, true);
  element.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", visibilityChange);

  return {
    update(delta: number) {
      if (disposed || !keys.size) return;
      const forward =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const right =
        Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const length = Math.hypot(forward, right);
      if (!length) return;
      const distance = (MOVE_SPEED * Math.min(delta, 0.1)) / length;
      camera.translateZ(-forward * distance);
      camera.translateX(right * distance);
      camera.updateMatrixWorld();
      onChange();
    },
    dispose() {
      disposed = true;
      reset();
      element.removeEventListener("keydown", keyDown);
      element.removeEventListener("keyup", keyUp);
      element.removeEventListener("blur", reset);
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerUp);
      element.removeEventListener("pointercancel", reset);
      element.removeEventListener("lostpointercapture", reset);
      element.removeEventListener("contextmenu", contextMenu, true);
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibilityChange);
      if (previousTabIndex === null) element.removeAttribute("tabindex");
      else element.setAttribute("tabindex", previousTabIndex);
    },
  };
}
