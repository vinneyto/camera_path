import { expect, it, vi } from "vitest";
import { waitForWebGlGpu } from "./wait-for-webgl-gpu";
it("polls GPU completion asynchronously and deletes the fence without reading pixels", async () => {
  vi.useFakeTimers();
  const fence = {},
    gl = {
      SYNC_GPU_COMMANDS_COMPLETE: 1,
      ALREADY_SIGNALED: 2,
      CONDITION_SATISFIED: 3,
      WAIT_FAILED: 4,
      fenceSync: vi.fn(() => fence),
      flush: vi.fn(),
      isContextLost: () => false,
      clientWaitSync: vi.fn().mockReturnValueOnce(0).mockReturnValue(3),
      deleteSync: vi.fn(),
      readPixels: vi.fn(),
    };
  try {
    const done = waitForWebGlGpu(gl as unknown as WebGL2RenderingContext);
    expect(gl.deleteSync).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await done;
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(gl.readPixels).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
