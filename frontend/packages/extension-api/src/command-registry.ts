import type { CommandState } from "@camera-path/contracts/commands";
import type { FeatureManifest } from "./manifest";
export class CommandRegistry {
  private readonly entries = new Map<string, CommandState>();
  private readonly listeners = new Set<() => void>();
  private state: CommandState = { commands: [], disabled: false, error: null };
  readonly read = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  publish(manifest: FeatureManifest, id: string, state: CommandState) {
    if (
      !manifest.contributions.some((c) => c.kind === "command" && c.id === id)
    )
      throw new Error(`Undeclared commands: ${id}`);
    if (this.entries.has(id))
      throw new Error(`Duplicate command provider: ${id}`);
    this.entries.set(id, state);
    this.update();
    return () => {
      if (this.entries.get(id) === state) {
        this.entries.delete(id);
        this.update();
      }
    };
  }
  private update() {
    const values = [...this.entries]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
    const commands = values.flatMap((v) => v.commands);
    if (new Set(commands.map((c) => c.id)).size !== commands.length)
      throw new Error("Duplicate command id");
    this.state = {
      commands,
      disabled: values.some((v) => v.disabled),
      error: values.find((v) => v.error)?.error ?? null,
    };
    this.listeners.forEach((fn) => fn());
  }
}
