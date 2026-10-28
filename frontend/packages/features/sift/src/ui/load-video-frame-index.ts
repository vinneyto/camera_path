/** Keep metadata scanning off the UI thread and cancel it with the source session. */
export function loadVideoFrameIndex(
  file: File,
  duration: number,
  signal: AbortSignal,
) {
  return new Promise<Float64Array>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const worker = new Worker(
      new URL("../worker/frame-index.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      signal.removeEventListener("abort", cancel);
      worker.terminate();
    };
    const cancel = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ times: Float64Array } | { error: string }>,
    ) => {
      cleanup();
      if ("error" in event.data) reject(new Error(event.data.error));
      else resolve(event.data.times);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("Could not read video frame timestamps."));
    };
    try {
      worker.postMessage({ file, duration });
    } catch (cause) {
      cleanup();
      reject(cause);
    }
  });
}
