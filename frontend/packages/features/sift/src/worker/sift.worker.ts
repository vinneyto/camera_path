import type {
  DetectionReport,
  FrameRequest,
  SiftWasm,
  WorkerResponse,
} from "../types";
const ready = import(
  /* webpackIgnore: true */ /* turbopackIgnore: true */ "/sift/camera_path_sift.js"
).then(async (module: SiftWasm) => {
  await module.default({ module_or_path: "/sift/camera_path_sift_bg.wasm" });
  if (!("gpu" in navigator))
    throw new Error(
      "WebGPU is required for Burn. Use a browser with WebGPU support over HTTPS or localhost.",
    );
  const detector = await module.Detector.create();
  self.postMessage({ kind: "ready" } satisfies WorkerResponse);
  return detector;
});
void ready.catch((error: unknown) =>
  self.postMessage({
    kind: "error",
    message: String(error),
  } satisfies WorkerResponse),
);
self.onmessage = async (event: MessageEvent<FrameRequest>) => {
  try {
    const wasm = await ready;
    const { width, height, rgba, params } = event.data;
    const pixels = new Uint8Array(rgba);
    const start = performance.now();
    const result = JSON.parse(
      await wasm.detect_rgba(width, height, pixels, JSON.stringify(params)),
    ) as DetectionReport;
    self.postMessage({
      kind: "frame",
      ...result,
      elapsed: performance.now() - start,
      width,
      height,
    } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      kind: "error",
      message: String(error),
    } satisfies WorkerResponse);
  }
};
