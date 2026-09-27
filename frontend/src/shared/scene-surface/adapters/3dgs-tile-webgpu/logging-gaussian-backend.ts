import type {
  BackendCommand,
  BackendEvent,
  GaussianBackend,
} from "3dgs-tile-webgpu";

/** Diagnostic decorator: preserves the protocol while logging stable payload snapshots. */
export class LoggingGaussianBackend implements GaussianBackend {
  private readonly commandTypes = new Map<string, BackendCommand["type"]>();

  constructor(private readonly backend: GaussianBackend) {}

  dispatch(command: BackendCommand): void {
    // Buffers are transferred to the worker and detach after dispatch.
    console.log("[3DGS backend →]", snapshot(command));
    this.commandTypes.set(command.id, command.type);
    if (this.commandTypes.size > 4096) {
      this.commandTypes.delete(this.commandTypes.keys().next().value!);
    }
    try {
      this.backend.dispatch(command);
    } catch (error) {
      this.commandTypes.delete(command.id);
      throw error;
    }
  }

  subscribe(listener: (event: BackendEvent) => void): () => void {
    return this.backend.subscribe((event) => {
      const commandId = "commandId" in event ? event.commandId : undefined;
      const commandType = commandId
        ? this.commandTypes.get(commandId)
        : undefined;
      console.log("[3DGS backend ←]", {
        ...snapshot(event),
        ...(commandType ? { commandType } : {}),
      });
      if (commandId) this.commandTypes.delete(commandId);
      listener(event);
    });
  }

  dispose(): void {
    this.commandTypes.clear();
    this.backend.dispose();
  }
}

function snapshot(
  message: BackendCommand | BackendEvent,
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
