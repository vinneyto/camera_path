import type { PlaybackState } from "@camera-path/contracts/host-state";
export class PlaybackController {
  private value: PlaybackState = {
    elapsed: 0,
    pathPosition: 0,
    playing: false,
  };
  private readonly listeners = new Set<() => void>();
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: PlaybackState) {
    this.value = Object.freeze(value);
    this.listeners.forEach((fn) => fn());
  }
  resetPlayback() {
    this.set({ elapsed: 0, pathPosition: 0, playing: false });
  }
  setPlaybackFrame(pathPosition: number, elapsed: number) {
    this.set({ ...this.value, pathPosition, elapsed });
  }
  setPlaying(playing: boolean) {
    this.set({ ...this.value, playing });
  }
}
