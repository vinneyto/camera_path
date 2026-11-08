// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Euler, PerspectiveCamera, Vector3 } from "three";
import { createFreeFlightControls } from "./create-free-flight-controls";

let camera: PerspectiveCamera;
let element: HTMLCanvasElement;
let controls: ReturnType<typeof createFreeFlightControls>;
let start: ReturnType<typeof vi.fn<() => void>>;
let change: ReturnType<typeof vi.fn<() => void>>;
beforeEach(() => {
  camera = new PerspectiveCamera();
  element = document.createElement("canvas");
  document.body.append(element);
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn(() => true);
  element.releasePointerCapture = vi.fn();
  start = vi.fn();
  change = vi.fn();
  controls = createFreeFlightControls(camera, element, start, change);
  element.focus();
});
afterEach(() => {
  controls.dispose();
  document.body.replaceChildren();
});

it.each([
  ["KeyW", [0, 0, -0.5]],
  ["ArrowUp", [0, 0, -0.5]],
  ["KeyS", [0, 0, 0.5]],
  ["ArrowDown", [0, 0, 0.5]],
  ["KeyA", [-0.5, 0, 0]],
  ["ArrowLeft", [-0.5, 0, 0]],
  ["KeyD", [0.5, 0, 0]],
  ["ArrowRight", [0.5, 0, 0]],
])("moves with %s along the camera's local axes", (code, expected) => {
  camera.rotation.set(0.6, 0.9, 0, "YXZ");
  const displacement = new Vector3(...expected).applyQuaternion(
    camera.quaternion,
  );
  element.dispatchEvent(
    new KeyboardEvent("keydown", { code, cancelable: true }),
  );
  controls.update(0.1);
  expect(camera.position.distanceTo(displacement)).toBeLessThan(1e-8);
  expect(start).toHaveBeenCalledOnce();
  expect(change).toHaveBeenCalledOnce();
  element.dispatchEvent(new KeyboardEvent("keyup", { code }));
  controls.update(0.1);
  expect(change).toHaveBeenCalledOnce();
});

it("normalizes diagonal input, treats aliases as one key and limits frame gaps", () => {
  for (const code of ["KeyW", "ArrowUp", "KeyD"])
    element.dispatchEvent(new KeyboardEvent("keydown", { code }));
  controls.update(5);
  expect(camera.position.length()).toBeCloseTo(0.5);
  expect(camera.position.x).toBeCloseTo(-camera.position.z);
});

it("moves at the same speed across frame rates", () => {
  element.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  for (let i = 0; i < 60; i++) controls.update(1 / 60);
  expect(camera.position.z).toBeCloseTo(-5);
  camera.position.set(0, 0, 0);
  for (let i = 0; i < 30; i++) controls.update(1 / 30);
  expect(camera.position.z).toBeCloseTo(-5);
});

it("ignores text inputs, page shortcuts and modified keys", () => {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }),
  );
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  for (const modifier of ["ctrlKey", "metaKey", "altKey"])
    element.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyW", [modifier]: true }),
    );
  controls.update(0.1);
  expect(camera.position.length()).toBe(0);
});

it("stops held movement when the canvas or window loses focus", () => {
  element.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  element.blur();
  controls.update(0.1);
  expect(camera.position.length()).toBe(0);
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  window.dispatchEvent(new Event("blur"));
  controls.update(0.1);
  expect(camera.position.length()).toBe(0);
});

it("uses the wheel to dolly along the pitched camera direction without changing zoom", () => {
  camera.rotation.set(0.6, 0.9, 0, "YXZ");
  const direction = camera.getWorldDirection(new Vector3());
  const zoom = camera.zoom;
  const wheel = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
  element.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true);
  expect(camera.position.distanceTo(direction)).toBeLessThan(1e-8);
  expect(camera.zoom).toBe(zoom);
  element.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  expect(camera.position.length()).toBeCloseTo(0);
  const pinch = new WheelEvent("wheel", {
    deltaY: 100,
    ctrlKey: true,
    cancelable: true,
  });
  // happy-dom's WheelEvent currently omits MouseEvent modifier properties.
  Object.defineProperty(pinch, "ctrlKey", { value: true });
  element.dispatchEvent(pinch);
  expect(pinch.defaultPrevented).toBe(false);
  expect(camera.position.length()).toBeCloseTo(0);
});

it("rotates only yaw and pitch, clamps at the poles and releases dragging", () => {
  element.dispatchEvent(
    new PointerEvent("pointerdown", {
      button: 2,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    }),
  );
  element.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 1,
      clientX: 200,
      clientY: -100,
    }),
  );
  let rotation = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
  expect(rotation.x).toBeCloseTo(0.3);
  expect(rotation.y).toBeCloseTo(-0.6);
  expect(rotation.z).toBeCloseTo(0);
  element.dispatchEvent(
    new PointerEvent("pointermove", {
      pointerId: 1,
      clientX: 200,
      clientY: -100000,
    }),
  );
  rotation = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
  expect(rotation.x).toBeLessThan(Math.PI / 2);
  expect(rotation.z).toBeCloseTo(0);
  element.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  const final = camera.quaternion.clone();
  element.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 300, clientY: 0 }),
  );
  expect(camera.quaternion.equals(final)).toBe(true);
  expect(element.releasePointerCapture).toHaveBeenCalledWith(1);
});

it("removes initial roll and completely releases event handlers on disposal", () => {
  controls.dispose();
  element.tabIndex = -1;
  camera.rotation.set(0.3, 0.5, 0.4, "YXZ");
  controls = createFreeFlightControls(camera, element, start, change);
  expect(new Euler().setFromQuaternion(camera.quaternion, "YXZ").z).toBeCloseTo(
    0,
  );
  element.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  controls.dispose();
  controls.update(0.1);
  element.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  expect(camera.position.length()).toBe(0);
  expect(element.tabIndex).toBe(-1);
  expect(change).not.toHaveBeenCalled();
});
