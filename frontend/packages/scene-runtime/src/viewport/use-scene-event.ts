"use client";
import { useEffect, useEffectEvent } from "react";
import type { SceneEventMap } from "./scene-events";
import { useViewportServices } from "./viewport-provider";
export function useSceneEvent<K extends keyof SceneEventMap>(
  name: K,
  listener: (value: SceneEventMap[K]) => void,
) {
  const { events } = useViewportServices();
  const handle = useEffectEvent(listener);
  useEffect(
    () => events.subscribe(name, (value) => handle(value)),
    [events, name],
  );
}
