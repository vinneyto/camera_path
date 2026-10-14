import { trajectorySelectionOutput } from "@camera-path/contracts/feature-data";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export class TrajectorySelectionController {
  private host: FeatureContext<typeof manifest> | null = null;
  private value: { trajectorySelected: boolean } = {
    trajectorySelected: false,
  };
  private readonly listeners = new Set<() => void>();
  connect(host: FeatureContext<typeof manifest>) {
    this.host = host;
    host.data.provide(trajectorySelectionOutput, this.value);
  }
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: { trajectorySelected: boolean }) {
    this.value = Object.freeze(value);
    if (this.host && !this.host.signal.aborted)
      this.host.data.provide(trajectorySelectionOutput, this.value);
    this.listeners.forEach((fn) => fn());
  }
  closeTrajectory() {
    this.set({ trajectorySelected: false });
  }
  selectTrajectory() {
    this.set({ trajectorySelected: true });
  }
}
