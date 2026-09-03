"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { createPlaybackTable } from "@/entities/trajectory/lib/create-playback-table";
import { pathPositionAtTime } from "@/entities/trajectory/lib/path-position-at-time";

export function useTrajectoryPlayback(trajectory: CompiledTrajectory | null) {
  const table = useMemo(() => trajectory ? createPlaybackTable(trajectory) : [], [trajectory]);
  const duration = table.at(-1)?.time ?? 0;
  const [pathPosition, setPathPositionState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const revision = trajectory?.revision ?? null;
  const elapsedRef = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      elapsedRef.current = 0;
      setPathPositionState(0);
      setPlaying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [revision]);

  useEffect(() => {
    if (!playing || duration <= 0) return;
    let frame = 0;
    let previous = performance.now();

    function animate(now: number) {
      elapsedRef.current += (now - previous) / 1000;
      previous = now;
      if (elapsedRef.current >= duration) {
        elapsedRef.current = duration;
        setPathPositionState(1);
        setPlaying(false);
        return;
      }
      setPathPositionState(pathPositionAtTime(table, elapsedRef.current));
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing, table]);

  const seek = useCallback((position: number) => {
    const clamped = Math.min(1, Math.max(0, position));
    setPathPositionState(clamped);
    const exactIndex = clamped * Math.max(0, table.length - 1);
    const leftIndex = Math.floor(exactIndex);
    const rightIndex = Math.min(table.length - 1, Math.ceil(exactIndex));
    const weight = exactIndex - leftIndex;
    elapsedRef.current = (table[leftIndex]?.time ?? 0) * (1 - weight) + (table[rightIndex]?.time ?? 0) * weight;
  }, [table]);

  const toggle = useCallback(() => {
    if (pathPosition >= 1) seek(0);
    setPlaying((current) => !current);
  }, [pathPosition, seek]);

  return { duration, pathPosition, playing, seek, toggle };
}
