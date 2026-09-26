import type {
  BackendCommand,
  BackendEvent,
  GaussianBackend,
} from "3dgs-tile-webgpu";
import { describe, expect, it, vi } from "vitest";

import { LoggingGaussianBackend } from "./logging-gaussian-backend";

describe("LoggingGaussianBackend", () => {
  it("forwards the original command and event while logging transferred buffers", () => {
    let emit: ((event: BackendEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const backend: GaussianBackend = {
      dispatch: vi.fn(),
      subscribe: vi.fn((listener) => {
        emit = listener;
        return unsubscribe;
      }),
      dispose: vi.fn(),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const decorator = new LoggingGaussianBackend(backend);
      const listener = vi.fn();
      const stop = decorator.subscribe(listener);
      const buffer = new ArrayBuffer(16);
      const command: BackendCommand = {
        type: "load-cloud-from-buffer",
        id: "load-1",
        cloudId: "cloud-1",
        buffer,
        options: {},
      };
      decorator.dispatch(command);
      expect(backend.dispatch).toHaveBeenCalledWith(command);
      expect(log).toHaveBeenCalledWith("[3DGS backend →]", {
        ...command,
        buffer: { byteLength: 16 },
      });

      const event: BackendEvent = {
        type: "command-completed",
        commandId: "load-1",
      };
      emit?.(event);
      expect(listener).toHaveBeenCalledWith(event);
      expect(log).toHaveBeenCalledWith("[3DGS backend ←]", event);
      stop();
      expect(unsubscribe).toHaveBeenCalledOnce();
      decorator.dispose();
      expect(backend.dispose).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
