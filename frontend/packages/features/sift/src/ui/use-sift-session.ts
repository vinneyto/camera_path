"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { DetectorParams, SessionSource } from "../types";
import {
  createSiftSession,
  type SiftSessionState,
} from "./create-sift-session";

export function useSiftSession(
  source: SessionSource | null,
  maxDimension: number,
  params: DetectorParams,
) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof createSiftSession> | null>(null);
  const config = useEffectEvent(() => ({ maxDimension, params }));
  const [state, setState] = useState<SiftSessionState>({
    devices: [],
    frame: null,
    error: null,
    phase: "Ready",
    processedFps: 0,
    playback: null,
  });
  useEffect(() => {
    session.current?.refresh();
  }, [maxDimension, params]);
  useEffect(() => {
    if (!source || !container.current) return;
    const current = createSiftSession({
      target: container.current,
      source,
      getConfig: () => config(),
      onUpdate: (changes) =>
        setState((previous) => ({ ...previous, ...changes })),
    });
    session.current = current;
    return () => {
      current.dispose();
      if (session.current === current) session.current = null;
    };
  }, [source]);
  return {
    ...state,
    container,
    repeatDetection: () => session.current?.refresh(),
    togglePlayback: () => session.current?.togglePlayback(),
    stepFrame: (direction: -1 | 1) => session.current?.stepFrame(direction),
    seekTo: (seconds: number) => session.current?.seekTo(seconds),
  };
}
