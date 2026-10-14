import type {
  BackendCommand,
  BackendFailure,
  BackendResponse,
  GaussianBackend,
} from "3dgs-tile-webgpu";

/** Diagnostic decorator: preserves the protocol while logging stable payload snapshots. */
export class LoggingGaussianBackend implements GaussianBackend {
  constructor(private readonly backend: GaussianBackend) {}

  dispatch(command: BackendCommand): void {
    // Buffers are transferred to the worker and detach after dispatch.
    console.log("[3DGS backend →]", snapshot(command));
    this.backend.dispatch(command);
  }

  subscribe(listener: (response: BackendResponse) => void): () => void {
    return this.backend.subscribe((response) => {
      console.log("[3DGS backend ←]", snapshot(response));
      listener(response);
    });
  }

  onFailure(listener: (failure: BackendFailure) => void): () => void {
    return this.backend.onFailure((failure) => {
      console.error("[3DGS backend failure]", snapshot(failure));
      listener(failure);
    });
  }

  abort(commandId: string): void {
    this.backend.abort(commandId);
  }

  dispose(): void {
    this.backend.dispose();
  }
}

function snapshot(
  message: BackendCommand | BackendResponse | BackendFailure,
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(message, (_key, value: unknown) => {
      if (value instanceof ArrayBuffer) return { byteLength: value.byteLength };
      if (ArrayBuffer.isView(value)) {
        return { byteLength: value.byteLength, type: value.constructor.name };
      }
      return value;
    }),
  );
}
