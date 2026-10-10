import { afterEach, expect, it, vi } from "vitest";
import { downloadGaussianCloud } from "./download-gaussian-cloud";

afterEach(() => vi.unstubAllGlobals());

it("reports streamed byte progress below completion until the renderer is ready", async () => {
  const progress = vi.fn();
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2]));
            controller.enqueue(new Uint8Array([3, 4]));
            controller.close();
          },
        }),
        { headers: { "Content-Length": "4" } },
      ),
  );
  const buffer = await downloadGaussianCloud(
    "/model.sog",
    new AbortController().signal,
    progress,
  );
  expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
  expect(progress.mock.calls.map(([event]) => event.fraction)).toEqual([
    0, 0.45, 0.9,
  ]);
  expect(progress.mock.calls.at(-1)?.[0]).toEqual({
    fraction: 0.9,
    loadedBytes: 4,
    totalBytes: 4,
    phase: "download",
  });
});

it.each([
  new Headers(),
  new Headers({ "Content-Length": "2", "Content-Encoding": "gzip" }),
])(
  "uses indeterminate progress if decoded size is unknown: %j",
  async (headers) => {
    const progress = vi.fn();
    vi.stubGlobal(
      "fetch",
      async () => new Response(new Uint8Array([1, 2, 3, 4]), { headers }),
    );
    await downloadGaussianCloud(
      "/model.sog",
      new AbortController().signal,
      progress,
    );
    expect(progress.mock.calls.at(-1)?.[0]).toEqual({
      fraction: null,
      loadedBytes: 4,
      totalBytes: null,
      phase: "download",
    });
  },
);

it("cancels an unfinished stream and rejects when its final scene owner releases it", async () => {
  const cancelled = vi.fn();
  vi.stubGlobal(
    "fetch",
    async () => new Response(new ReadableStream({ cancel: cancelled })),
  );
  const controller = new AbortController();
  const result = downloadGaussianCloud("/slow.sog", controller.signal);
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  controller.abort();
  await rejected;
  expect(cancelled).toHaveBeenCalledOnce();
});

it("reports HTTP failures instead of passing an error page to the parser", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("Not found", { status: 404 }),
  );
  await expect(
    downloadGaussianCloud("/missing.sog", new AbortController().signal),
  ).rejects.toThrow("Gaussian fetch failed: 404");
});
