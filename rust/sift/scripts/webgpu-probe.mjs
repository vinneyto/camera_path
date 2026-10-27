// Diagnostic worker only: timing synchronous WebGPU calls does not wait on GPU.
// Promise latency (mapAsync) is reported separately and may overlap other work.
export function installWebGpuProbe() {
  let active = null;
  const originals = [];
  const instrumented = [];
  const methods = {
    GPUDevice: [
      "createBuffer",
      "createShaderModule",
      "createComputePipeline",
      "createComputePipelineAsync",
      "createBindGroup",
      "createBindGroupLayout",
      "createPipelineLayout",
      "createCommandEncoder",
      "createQuerySet",
    ],
    GPUQueue: ["submit", "writeBuffer", "onSubmittedWorkDone"],
    GPUCommandEncoder: [
      "beginComputePass",
      "copyBufferToBuffer",
      "resolveQuerySet",
      "finish",
    ],
    GPUComputePassEncoder: [
      "setPipeline",
      "setBindGroup",
      "dispatchWorkgroups",
      "end",
    ],
    GPUBuffer: ["mapAsync", "getMappedRange", "unmap", "destroy"],
  };
  for (const [type, names] of Object.entries(methods)) {
    const prototype = globalThis[type]?.prototype;
    if (!prototype) continue;
    for (const name of names) {
      const original = prototype[name];
      if (typeof original !== "function") continue;
      const key = `${type}.${name}`;
      prototype[name] = function (...args) {
        if (!active) return Reflect.apply(original, this, args);
        const sample = active;
        const row = (sample[key] ??= {
          calls: 0,
          sync_cpu_ms: 0,
          bytes: 0,
          async_settled_ms_sum: 0,
          async_calls: 0,
          failures: 0,
        });
        row.calls++;
        const start = performance.now();
        let result;
        try {
          result = Reflect.apply(original, this, args);
        } catch (error) {
          row.failures++;
          throw error;
        } finally {
          row.sync_cpu_ms += performance.now() - start;
        }
        if (name === "createBuffer") row.bytes += Number(args[0].size);
        if (name === "writeBuffer") {
          const bytesPerElement = args[2].BYTES_PER_ELEMENT ?? 1;
          row.bytes +=
            args[4] === undefined
              ? args[2].byteLength - (args[3] ?? 0) * bytesPerElement
              : args[4] * bytesPerElement;
        }
        if (name === "copyBufferToBuffer") row.bytes += Number(args[4]);
        if (name === "getMappedRange") row.bytes += result.byteLength;
        if (result && typeof result.then === "function") {
          row.async_calls++;
          result.then(
            () => {
              row.async_settled_ms_sum += performance.now() - start;
            },
            () => {
              row.failures++;
            },
          );
        }
        return result;
      };
      originals.push(() => {
        prototype[name] = original;
      });
      instrumented.push(key);
    }
  }
  return {
    instrumented,
    start() {
      active = {};
    },
    finish() {
      const result = active;
      active = null;
      return result;
    },
    restore() {
      active = null;
      originals.reverse().forEach((restore) => restore());
    },
  };
}
