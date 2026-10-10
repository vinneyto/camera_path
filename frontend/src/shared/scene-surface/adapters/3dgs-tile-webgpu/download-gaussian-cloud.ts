import type { GaussianCloudLoadProgress } from "../../model/gaussian-cloud-load-progress";

export async function downloadGaussianCloud(
  url: string,
  signal: AbortSignal,
  onProgress?: (progress: GaussianCloudLoadProgress) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(
      `Gaussian fetch failed: ${response.status} ${response.statusText}`,
    );
  const length = Number(response.headers.get("Content-Length"));
  // Compressed responses report wire length, while ReadableStream exposes decoded bytes.
  const total =
    Number.isFinite(length) &&
    length > 0 &&
    !response.headers.get("Content-Encoding")
      ? length
      : null;
  let loaded = 0;
  const report = () =>
    onProgress?.({
      fraction: total ? Math.min(loaded / total, 1) * 0.9 : null,
      loadedBytes: loaded,
      totalBytes: total,
      phase: "download",
    });
  report();
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    signal.throwIfAborted();
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      report();
    }
    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes.buffer;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
