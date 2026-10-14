import { playbackOutput } from "@camera-path/contracts/feature-data";
import type { PlaybackState } from "@camera-path/contracts/host-state";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export class PlaybackController {
  private host: FeatureContext<typeof manifest> | null = null;
  private value: PlaybackState = {
    elapsed: 0,
    pathPosition: 0,
    playing: false,
  };
  private readonly listeners = new Set<() => void>();
  connect(host: FeatureContext<typeof manifest>) {
    this.host = host;
    host.data.provide(playbackOutput, this.value);
  }
  readonly read = () => this.value;
  readonly subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: PlaybackState) {
    this.value = Object.freeze(value);
    if (this.host && !this.host.signal.aborted)
      this.host.data.provide(playbackOutput, this.value);
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
