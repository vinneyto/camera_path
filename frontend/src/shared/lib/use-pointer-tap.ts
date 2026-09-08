"use client";

import { useCallback, useRef } from "react";

interface PointerTapEvent {
  clientX: number;
  clientY: number;
  pointerId: number;
}

interface PendingPointerTap<T> {
  pointerId: number;
  startX: number;
  startY: number;
  value: T;
}

interface UsePointerTapOptions<T> {
  movementThreshold?: number;
  onTap: (value: T) => void;
}

export function usePointerTap<T>({
  movementThreshold = 5,
  onTap,
}: UsePointerTapOptions<T>) {
  const pendingTapRef = useRef<PendingPointerTap<T> | null>(null);

  const cancel = useCallback(() => {
    pendingTapRef.current = null;
  }, []);

  const handlePointerDown = useCallback((value: T, event: PointerTapEvent) => {
    pendingTapRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      value,
    };
  }, []);

  const handlePointerMove = useCallback((value: T, event: PointerTapEvent) => {
    const pendingTap = pendingTapRef.current;
    if (pendingTap === null || pendingTap.pointerId !== event.pointerId) return false;

    const distance = Math.hypot(
      event.clientX - pendingTap.startX,
      event.clientY - pendingTap.startY,
    );
    if (distance > movementThreshold) {
      cancel();
      return true;
    }

    pendingTap.value = value;
    return false;
  }, [cancel, movementThreshold]);

  const handlePointerUp = useCallback((event: Pick<PointerTapEvent, "pointerId">) => {
    const pendingTap = pendingTapRef.current;
    if (pendingTap === null || pendingTap.pointerId !== event.pointerId) return;
    cancel();
    onTap(pendingTap.value);
  }, [cancel, onTap]);

  return {
    cancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
