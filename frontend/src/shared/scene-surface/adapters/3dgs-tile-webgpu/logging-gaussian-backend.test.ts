import type {
  BackendCommand,
  BackendFailure,
  BackendResponse,
  GaussianBackend,
} from "3dgs-tile-webgpu";
import { describe, expect, it, vi } from "vitest";

import { LoggingGaussianBackend } from "./logging-gaussian-backend";

describe("LoggingGaussianBackend", () => {
  it("forwards commands, streaming responses, failures and aborts", () => {
    let emit: ((response: BackendResponse) => void) | undefined;
    let fail: ((failure: BackendFailure) => void) | undefined;
    const unsubscribe = vi.fn();
    const unsubscribeFailure = vi.fn();
    const backend: GaussianBackend = {
      dispatch: vi.fn(),
      subscribe: vi.fn((listener) => {
        emit = listener;
        return unsubscribe;
      }),
      onFailure: vi.fn((listener) => {
        fail = listener;
        return unsubscribeFailure;
      }),
      abort: vi.fn(),
      dispose: vi.fn(),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const decorator = new LoggingGaussianBackend(backend);
      const listener = vi.fn();
      const stop = decorator.subscribe(listener);
      const failureListener = vi.fn();
      const stopFailure = decorator.onFailure(failureListener);
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

      const response: BackendResponse = {
        command: { id: "load-1", type: "load-cloud-from-buffer" },
        durationMs: 10,
        isFinal: false,
        payload: {
          type: "cloud-loaded",
          cloudId: "cloud-1",
          objectId: 0,
          sourceCount: 1,
          shDegree: 0,
          bounds: [0, 0, 0, 0, 0, 0],
        },
      };
      emit?.(response);
      emit?.({ ...response, payload: undefined, isFinal: true });
      expect(listener).toHaveBeenNthCalledWith(1, response);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith("[3DGS backend ←]", response);
      decorator.abort("load-1");
      expect(backend.abort).toHaveBeenCalledWith("load-1");
      const failure = { code: "worker-error", message: "worker stopped" };
      fail?.(failure);
      expect(failureListener).toHaveBeenCalledWith(failure);
      expect(errorLog).toHaveBeenCalledWith("[3DGS backend failure]", failure);
      stop();
      stopFailure();
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(unsubscribeFailure).toHaveBeenCalledOnce();
      decorator.dispose();
      expect(backend.dispose).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
      errorLog.mockRestore();
    }
  });
});
