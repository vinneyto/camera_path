import type { ThreeEvent } from "@react-three/fiber";
import type { SceneSurfaceHit } from "../surface";
export interface SceneEventMap {
  surfacePointerDown: { hit: SceneSurfaceHit; event: ThreeEvent<PointerEvent> };
  surfacePointerMove: { hit: SceneSurfaceHit; event: ThreeEvent<PointerEvent> };
  surfacePointerUp: { hit: SceneSurfaceHit; event: ThreeEvent<PointerEvent> };
  surfacePointerOut: undefined;
  surfacePointerCancel: ThreeEvent<PointerEvent>;
  controlsChange: undefined;
  controlsStart: undefined;
}
export class SceneEvents {
  private listeners = new Map<
    keyof SceneEventMap,
    Set<(value: never) => void>
  >();
  subscribe<K extends keyof SceneEventMap>(
    event: K,
    listener: (value: SceneEventMap[K]) => void,
  ) {
    const listeners = this.listeners.get(event) ?? new Set();
    this.listeners.set(event, listeners);
    listeners.add(listener as (value: never) => void);
    return () => {
      listeners.delete(listener as (value: never) => void);
    };
  }
  emit<K extends keyof SceneEventMap>(event: K, value: SceneEventMap[K]) {
    this.listeners.get(event)?.forEach((listener) => listener(value as never));
  }
}
