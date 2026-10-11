import type { WebGPURenderer } from "three/webgpu";

interface DebugAttribute {
  id: number;
  version: number;
  name: string;
}

interface DebugRenderObject {
  object: { id: number; name: string; geometry: { id: number } };
  material: { id: number; name: string; type: string };
  geometry: { id: number };
  context: { id: number };
}

interface DebugSets {
  attributes: Record<number, DebugAttribute>;
}

type DebugDraw = (
  object: DebugRenderObject,
  info: unknown,
  context: unknown,
  pipeline: unknown,
  bindings: unknown,
  attributes: DebugAttribute[],
  parameters: unknown,
  encoder: object,
  sets: DebugSets,
) => void;

interface DebugBackend {
  _draw: DebugDraw;
  get: (attribute: DebugAttribute) => { buffer?: unknown };
}

/** Opt-in investigation of Three's private draw path; never repairs or skips a draw. */
export function installWebGpuDrawDiagnostics(
  renderer: WebGPURenderer,
): () => void {
  const backend = renderer.backend as unknown as DebugBackend;
  const original = backend._draw;
  if (typeof original !== "function") return () => undefined;
  const encoders = new WeakMap<object, Map<number, unknown>>();
  let reports = 0;
  const wrapped: DebugDraw = function (...args) {
    const [renderObject, , , , , attributes, parameters, encoder, sets] = args;
    let bound = encoders.get(encoder);
    if (!bound) {
      bound = new Map();
      encoders.set(encoder, bound);
    }
    const slots = attributes.map((attribute, slot) => {
      const buffer = backend.get(attribute).buffer;
      const cached = sets.attributes[slot] === attribute;
      const missing = buffer == null;
      const cacheMismatch = cached && bound.get(slot) !== buffer;
      if (!cached && !missing) bound.set(slot, buffer);
      return {
        slot,
        attributeId: attribute.id,
        attributeName: attribute.name,
        version: attribute.version,
        missing,
        cached,
        cacheMismatch,
      };
    });
    if (
      reports < 5 &&
      (slots.some((slot) => slot.missing || slot.cacheMismatch) ||
        (attributes.length === 0 &&
          renderObject.object.name.startsWith("cloud-loading-")))
    ) {
      reports++;
      // Serialize immediately: DevTools' live object expansion hides timing bugs.
      console.error(
        "[3DGS WebGPU draw]",
        JSON.stringify({
          timeMs: performance.now(),
          object: renderObject.object.name,
          objectId: renderObject.object.id,
          material: renderObject.material.name || renderObject.material.type,
          materialId: renderObject.material.id,
          geometryId: renderObject.geometry.id,
          currentGeometryId: renderObject.object.geometry.id,
          contextId: renderObject.context.id,
          parameters,
          slots,
        }),
        new Error("WebGPU draw diagnostic").stack,
      );
    }
    original.apply(backend, args);
  };
  backend._draw = wrapped;
  return () => {
    if (backend._draw === wrapped) backend._draw = original;
  };
}
