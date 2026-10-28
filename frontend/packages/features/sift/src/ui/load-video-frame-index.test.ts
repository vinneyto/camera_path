// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { loadVideoFrameIndex } from "./load-video-frame-index";
class FakeWorker {
  static current: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.current = this;
  }
}
afterEach(() => vi.unstubAllGlobals());
it("terminates the metadata worker after success or source cancellation", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const abort = new AbortController();
  const file = new File(["video"], "demo.mov");
  const pending = loadVideoFrameIndex(file, 1, abort.signal);
  const worker = FakeWorker.current;
  const times = new Float64Array([0, 0.1]);
  worker.onmessage?.({ data: { times } });
  await expect(pending).resolves.toBe(times);
  expect(worker.terminate).toHaveBeenCalledOnce();
  const cancelled = loadVideoFrameIndex(file, 1, abort.signal);
  const rejected = expect(cancelled).rejects.toMatchObject({
    name: "AbortError",
  });
  abort.abort();
  await rejected;
  expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
});
