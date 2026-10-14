export class TrajectorySelectionController {
  private value: { trajectorySelected: boolean } = {
    trajectorySelected: false,
  };
  private readonly listeners = new Set<() => void>();
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: { trajectorySelected: boolean }) {
    this.value = Object.freeze(value);
    this.listeners.forEach((fn) => fn());
  }
  closeTrajectory() {
    this.set({ trajectorySelected: false });
  }
  selectTrajectory() {
    this.set({ trajectorySelected: true });
  }
}
