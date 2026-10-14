import type { CameraMode } from "@camera-path/contracts/host-state";
export class CameraController {
  private value: { cameraMode: CameraMode } = { cameraMode: "orbit" };
  private readonly listeners = new Set<() => void>();
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: { cameraMode: CameraMode }) {
    this.value = Object.freeze(value);
    this.listeners.forEach((fn) => fn());
  }
  setCameraMode(cameraMode: CameraMode) {
    this.set({ cameraMode });
  }
}
