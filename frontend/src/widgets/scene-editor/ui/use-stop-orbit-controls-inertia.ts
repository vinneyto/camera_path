"use client";

import { type RefObject, useLayoutEffect } from "react";
import type { OrbitControls } from "three-stdlib";

import { stopOrbitControlsInertia } from "../lib/stop-orbit-controls-inertia";

export function useStopOrbitControlsInertia(
  controlsRef: RefObject<OrbitControls | null>,
  stopped: boolean,
): void {
  useLayoutEffect(() => {
    if (!stopped || controlsRef.current === null) return;
    stopOrbitControlsInertia(controlsRef.current);
  }, [controlsRef, stopped]);
}
