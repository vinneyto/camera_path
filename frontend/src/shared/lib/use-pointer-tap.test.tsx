// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePointerTap } from "./use-pointer-tap";

interface PointerEventData {
  clientX: number;
  clientY: number;
  pointerId: number;
}

function event(
  pointerId: number,
  clientX = 10,
  clientY = 20,
): PointerEventData {
  return { clientX, clientY, pointerId };
}

describe("usePointerTap", () => {
  it("calls onTap with the latest value for a clean tap", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      usePointerTap({ movementThreshold: 5, onTap }),
    );
    const pointerTap = result.current;

    pointerTap.handlePointerDown("initial", event(1));
    expect(pointerTap.handlePointerMove("latest", event(1, 13, 24))).toBe(
      false,
    );
    pointerTap.handlePointerUp(event(1));

    expect(onTap).toHaveBeenCalledOnce();
    expect(onTap).toHaveBeenCalledWith("latest");
  });

  it("does not call onTap after movement above the threshold", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      usePointerTap({ movementThreshold: 5, onTap }),
    );
    const pointerTap = result.current;

    pointerTap.handlePointerDown("value", event(1));
    expect(pointerTap.handlePointerMove("value", event(1, 16, 20))).toBe(true);
    pointerTap.handlePointerUp(event(1, 16, 20));

    expect(onTap).not.toHaveBeenCalled();
  });

  it("does not call onTap after cancel", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      usePointerTap({ movementThreshold: 5, onTap }),
    );
    const pointerTap = result.current;

    pointerTap.handlePointerDown("value", event(1));
    pointerTap.cancel();
    pointerTap.handlePointerUp(event(1));

    expect(onTap).not.toHaveBeenCalled();
  });

  it("ignores a different pointerId", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      usePointerTap({ movementThreshold: 5, onTap }),
    );
    const pointerTap = result.current;

    pointerTap.handlePointerDown("value", event(1));
    pointerTap.handlePointerUp(event(2));

    expect(onTap).not.toHaveBeenCalled();
  });
});
