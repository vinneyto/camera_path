// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSiftSession } from "./use-sift-session";
import type { DetectorParams, SessionSource, WorkerResponse } from "../types";
const viewport = vi.hoisted(() => ({ setPoints: vi.fn(), dispose: vi.fn() }));
vi.mock("../rendering/create-sift-viewport", () => ({
  createSiftViewport: () => viewport,
}));
const params: DetectorParams = {
  n_octave_layers: 3,
  sigma: 1.6,
  contrast_threshold: 0.04,
  edge_threshold: 10,
  enable_edge_like_filtering: true,
  enable_subpixel_localization: true,
};
const camera: SessionSource = { kind: "camera", deviceId: "rear" };
const workers: FakeWorker[] = [];
let callbacks: FrameRequestCallback[];
class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    workers.push(this);
  }
  emit(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }
}
function Harness({ source }: { source: SessionSource | null }) {
  const { container, phase, frame, error } = useSiftSession(
    source,
    480,
    params,
  );
  return (
    <>
      <div ref={container} />
      <p>{phase}</p>
      <p>{frame?.points.length ?? 0} points</p>
      <p role="alert">{error}</p>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  callbacks = [];
  workers.length = 0;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "srcObject", "set").mockImplementation(
    () => {},
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true,
    get: () => 480,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(480 * 360 * 4) }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("stops a camera granted after navigation and never starts processing it", async () => {
  let grant!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        grant = resolve;
      }),
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  const { unmount } = render(<Harness source={camera} />);
  act(() => workers.at(-1)!.emit({ kind: "ready" }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
  unmount();
  await act(async () =>
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream),
  );
  expect(stop).toHaveBeenCalledOnce();
  expect(workers.at(-1)!.terminate).toHaveBeenCalledOnce();
  expect(workers.at(-1)!.postMessage).not.toHaveBeenCalled();
});
it("allows one detection in flight, clears empty results, and releases resources on Stop", async () => {
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop }],
        getVideoTracks: () => [{ addEventListener: vi.fn() }],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });
  const { rerender } = render(<Harness source={camera} />);
  act(() => workers.at(-1)!.emit({ kind: "ready" }));
  await waitFor(() =>
    expect(workers.at(-1)!.postMessage).toHaveBeenCalledOnce(),
  );
  expect(callbacks).toHaveLength(0);
  act(() =>
    workers.at(-1)!.emit({
      kind: "frame",
      width: 480,
      height: 360,
      points: [],
      elapsed: 10,
    }),
  );
  expect(viewport.setPoints).toHaveBeenCalledWith([], 480, 360);
  expect(screen.getByText("Camera running")).toBeTruthy();
  expect(callbacks).toHaveLength(1);
  rerender(<Harness source={null} />);
  expect(stop).toHaveBeenCalledOnce();
  expect(viewport.dispose).toHaveBeenCalledOnce();
  expect(workers.at(-1)!.terminate).toHaveBeenCalledOnce();
});
it("shows WebGPU initialization errors without requesting a camera", async () => {
  const getUserMedia = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  render(<Harness source={camera} />);
  act(() =>
    workers.at(-1)!.emit({ kind: "error", message: "WebGPU is required" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("WebGPU is required"),
  );
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(workers.at(-1)!.terminate).toHaveBeenCalledOnce();
});
