import type { FeatureManifest, FrameDeclaration, FramePhase } from "./manifest";
import { orderedGraph } from "./ordered-graph";
export interface FrameContext {
  readonly frameId: number;
  readonly deltaSeconds: number;
  readonly elapsedSeconds: number;
}
export class FrameRegistry {
  private readonly entries = new Map<
    string,
    { declaration: FrameDeclaration; handler: (context: FrameContext) => void }
  >();
  declare(
    manifest: FeatureManifest,
    id: string,
    handler: (context: FrameContext) => void,
  ) {
    const declaration = manifest.frames.find((f) => f.id === id);
    if (!declaration) throw new Error(`Undeclared frame: ${id}`);
    return this.register(declaration, handler);
  }
  register(
    declaration: FrameDeclaration,
    handler: (context: FrameContext) => void,
  ) {
    if (this.entries.has(declaration.id))
      throw new Error(`Duplicate frame: ${declaration.id}`);
    const entry = { declaration, handler };
    this.entries.set(declaration.id, entry);
    return () => {
      if (this.entries.get(declaration.id) === entry)
        this.entries.delete(declaration.id);
    };
  }
  run(phase: FramePhase, context: FrameContext) {
    const entries = [...this.entries.values()].filter(
      (e) => e.declaration.phase === phase,
    );
    for (const declaration of orderedGraph(entries.map((e) => e.declaration)))
      this.entries.get(declaration.id)!.handler(context);
  }
  clear() {
    this.entries.clear();
  }
}
