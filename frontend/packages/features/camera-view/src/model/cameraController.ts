import { cameraModeOutput } from "@camera-path/contracts/feature-data";
import type { CameraMode } from "@camera-path/contracts/host-state";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export class CameraController {
  private host: FeatureContext<typeof manifest> | null = null;
  private value: { cameraMode: CameraMode } = { cameraMode: "orbit" };
  private readonly listeners = new Set<() => void>();
  connect(host: FeatureContext<typeof manifest>) {
    this.host = host;
    host.data.provide(cameraModeOutput, this.value.cameraMode);
  }
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: { cameraMode: CameraMode }) {
    this.value = Object.freeze(value);
    if (this.host && !this.host.signal.aborted)
      this.host.data.provide(cameraModeOutput, this.value.cameraMode);
    this.listeners.forEach((fn) => fn());
  }
  setCameraMode(cameraMode: CameraMode) {
    this.set({ cameraMode });
  }
}
