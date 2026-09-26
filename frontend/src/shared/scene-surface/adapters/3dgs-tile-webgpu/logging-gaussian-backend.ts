import type {
  BackendCommand,
  BackendEvent,
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

  subscribe(listener: (event: BackendEvent) => void): () => void {
    return this.backend.subscribe((event) => {
      console.log("[3DGS backend ←]", snapshot(event));
      listener(event);
    });
  }

  dispose(): void {
    this.backend.dispose();
  }
}

function snapshot(message: BackendCommand | BackendEvent): unknown {
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
