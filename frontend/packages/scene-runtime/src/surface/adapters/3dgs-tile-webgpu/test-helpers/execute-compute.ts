import { WgslExec, WgslParser } from "wgsl_reflect/wgsl_reflect.module.js";

export function executeCompute(
  shader: string,
  output: Float32Array,
  count = 1,
  input?: Float32Array,
): number[] {
  const exec = new WgslExec(new WgslParser().parse(shader));
  const bindings: Record<number, Record<number, ArrayBufferLike>> = {};
  for (const resource of exec.reflection.storage) {
    const group = (bindings[resource.group] ??= {});
    group[resource.binding] =
      resource.access === "read" && input ? input.buffer : output.buffer;
  }
  exec.dispatchWorkgroups("main", count, bindings);
  return Array.from(output);
}
