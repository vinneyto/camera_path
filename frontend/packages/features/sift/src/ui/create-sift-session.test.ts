// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createSiftSession,
  type SiftSessionState,
} from "./create-sift-session";
import type { DetectorParams, WorkerResponse } from "../types";
const viewport = vi.hoisted(() => ({
  setPoints: vi.fn(),
  clearPoints: vi.fn(),
  refreshMedia: vi.fn(),
  dispose: vi.fn(),
}));
const createViewport = vi.hoisted(() => vi.fn(() => viewport));
vi.mock("../rendering/create-sift-viewport", () => ({
  createSiftViewport: createViewport,
}));
const loadIndex = vi.hoisted(() => vi.fn());
vi.mock("./load-video-frame-index", () => ({ loadVideoFrameIndex: loadIndex }));
const params: DetectorParams = {
  n_octave_layers: 3,
  sigma: 1.6,
  contrast_threshold: 0.04,
  edge_threshold: 10,
  enable_edge_like_filtering: true,
  enable_subpixel_localization: true,
};
const result: Extract<WorkerResponse, { kind: "frame" }> = {
  kind: "frame",
  width: 480,
  height: 360,
  points: [],
  elapsed: 10,
};
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
const workers: FakeWorker[] = [];
let videos: HTMLVideoElement[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let paused: boolean;
let ended: boolean;
let seeking: boolean;
let ready: number;
const sessions: ReturnType<typeof createSiftSession>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  loadIndex.mockResolvedValue(new Float64Array([0, 0.04, 0.1, 0.25]));
  videos = [];
  workers.length = 0;
  frames = new Map();
  nextFrame = 1;
  paused = true;
  ended = false;
  seeking = false;
  ready = 0;
  const original = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((name, options) => {
    const el = original(name, options);
    if (name === "video") videos.push(el as HTMLVideoElement);
    return el;
  });
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-video");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    paused = false;
    ended = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (!paused) {
      paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  });
  for (const [property, get] of Object.entries({
    paused: (): boolean => paused,
    ended: (): boolean => ended,
    seeking: (): boolean => seeking,
    readyState: (): number => ready,
    duration: (): number => 12,
  }))
    Object.defineProperty(HTMLMediaElement.prototype, property, {
      configurable: true,
      get,
    });
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
  sessions.splice(0).forEach((s) => s.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function tick() {
  const scheduled = [...frames.values()];
  frames.clear();
  scheduled.forEach((fn) => fn(0));
}
async function start() {
  const state: Partial<SiftSessionState> = {};
  const settings = { maxDimension: 480, params };
  const session = createSiftSession({
    target: document.createElement("div"),
    source: {
      kind: "video",
      file: new File(["video"], "demo.mov", { type: "video/quicktime" }),
    },
    getConfig: () => settings,
    onUpdate: (patch) => Object.assign(state, patch),
  });
  sessions.push(session);
  const worker = workers.at(-1)!;
  worker.emit({ kind: "ready" });
  await flush();
  return { session, worker, video: videos.at(-1)!, state, settings };
}
async function loaded() {
  const s = await start();
  ready = 2;
  s.video.dispatchEvent(new Event("loadeddata"));
  await flush();
  return s;
}

it("decodes the first paused MOV frame and keeps one request in flight during playback", async () => {
  const { session, worker, video, state } = await start();
  expect(video.src).toContain("blob:local-video");
  expect(worker.postMessage).not.toHaveBeenCalled();
  ready = 2;
  video.dispatchEvent(new Event("loadeddata"));
  await flush();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(state.playback?.paused).toBe(true);
  session.togglePlayback();
  video.currentTime = 1;
  tick();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  worker.emit(result);
  tick();
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
  worker.emit(result);
  tick();
  expect(worker.postMessage).toHaveBeenCalledTimes(2); // same decoded time is not resent
  video.currentTime = 2;
  tick();
  expect(worker.postMessage).toHaveBeenCalledTimes(3);
});
it("drops an in-flight result after seeking and detects the selected paused position", async () => {
  const { session, worker, video, state } = await loaded();
  seeking = true;
  session.seekTo(7);
  video.dispatchEvent(new Event("seeking"));
  worker.emit({
    ...result,
    points: [{ x: 1, y: 1, size: 1, octave: 0, class_id: 1, response: 1 }],
  });
  tick();
  expect(viewport.setPoints).not.toHaveBeenCalled();
  expect(state.frame).toBeNull();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  seeking = false;
  video.dispatchEvent(new Event("seeked"));
  tick();
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
  worker.emit(result);
  expect(viewport.setPoints).toHaveBeenCalledOnce();
  expect(state.phase).toBe("Video paused");
  expect(frames.size).toBe(0);
  expect(state.playback?.currentTime).toBe(7);
  session.seekTo(100);
  expect(video.currentTime).toBe(12);
});
it("refreshes the exact paused frame on pause or settings changes, ignoring previous results", async () => {
  const { session, worker, video, state, settings } = await loaded();
  worker.emit(result);
  session.togglePlayback();
  video.currentTime = 2;
  tick();
  session.togglePlayback();
  expect(state.frame).toBeNull();
  worker.emit(result);
  expect(viewport.setPoints).toHaveBeenCalledTimes(1);
  tick();
  worker.emit(result);
  expect(state.phase).toBe("Video paused");
  expect(frames.size).toBe(0);
  settings.maxDimension = 320;
  session.refresh();
  tick();
  expect(worker.postMessage.mock.calls.at(-1)?.[0].width).toBe(320);
  worker.emit({ ...result, width: 320, height: 240 });
  expect(state.processedFps).toBe(0);
});
it("releases the decoder URL and worker when stopped during loading, and ignores late events", async () => {
  const { session, worker, video, state } = await start();
  session.dispose();
  ready = 2;
  video.dispatchEvent(new Event("loadeddata"));
  await flush();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
    "blob:local-video",
  );
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(createViewport).not.toHaveBeenCalled();
  expect(video.getAttribute("src")).toBeNull();
  expect(state.frame).toBeNull();
});
it("reports unsupported codecs and cleans up a failed file", async () => {
  const { worker, video, state } = await start();
  video.dispatchEvent(new Event("error"));
  await flush();
  expect(state.error).toContain("MP4 encoded with H.264");
  expect(state.phase).toBe("Stopped");
  expect(state.playback).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it("ends and replays without reinitializing the worker or leaking the old overlay", async () => {
  const { session, worker, video, state } = await loaded();
  worker.emit(result);
  session.togglePlayback();
  video.currentTime = 12;
  paused = true;
  ended = true;
  video.dispatchEvent(new Event("pause"));
  video.dispatchEvent(new Event("ended"));
  expect(state.playback?.ended).toBe(true);
  session.togglePlayback();
  expect(video.currentTime).toBe(0);
  expect(state.playback?.paused).toBe(false);
  expect(state.frame).toBeNull();
  expect(workers).toHaveLength(1);
  session.dispose();
  expect(viewport.dispose).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

it("keeps still-image refresh and bitmap cleanup when switching away from an image", async () => {
  const bitmap = { width: 640, height: 480, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  const state: Partial<SiftSessionState> = {};
  const session = createSiftSession({
    target: document.createElement("div"),
    source: { kind: "image", file: new File(["image"], "frame.png") },
    getConfig: () => ({ maxDimension: 480, params }),
    onUpdate: (patch) => Object.assign(state, patch),
  });
  sessions.push(session);
  const worker = workers.at(-1)!;
  worker.emit({ kind: "ready" });
  await flush();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  worker.emit(result);
  expect(state.phase).toBe("Image ready");
  expect(frames.size).toBe(0);
  session.refresh();
  tick();
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
  session.dispose();
  worker.emit(result);
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(viewport.dispose).toHaveBeenCalledOnce();
  expect(viewport.setPoints).toHaveBeenCalledOnce();
});

it("does not create a viewport after stopping during camera device enumeration", async () => {
  let resolveDevices!: (devices: MediaDeviceInfo[]) => void;
  const stop = vi.fn();
  const enumerateDevices = vi.fn(
    () =>
      new Promise<MediaDeviceInfo[]>((resolve) => {
        resolveDevices = resolve;
      }),
  );
  vi.stubGlobal("isSecureContext", true);
  vi.spyOn(HTMLMediaElement.prototype, "srcObject", "set").mockImplementation(
    () => {},
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop }],
        getVideoTracks: () => [{ addEventListener: vi.fn() }],
      }),
      enumerateDevices,
    },
  });
  const session = createSiftSession({
    target: document.createElement("div"),
    source: { kind: "camera", deviceId: "" },
    getConfig: () => ({ maxDimension: 480, params }),
    onUpdate: vi.fn(),
  });
  sessions.push(session);
  const worker = workers.at(-1)!;
  worker.emit({ kind: "ready" });
  await vi.waitFor(() => expect(enumerateDevices).toHaveBeenCalledOnce());
  session.dispose();
  resolveDevices([]);
  await flush();
  expect(stop).toHaveBeenCalledOnce();
  expect(createViewport).not.toHaveBeenCalled();
  expect(worker.postMessage).not.toHaveBeenCalled();
});

it("steps adjacent presentation timestamps, pauses, accumulates rapid clicks and discards old points", async () => {
  const { session, worker, video, state } = await loaded();
  await vi.waitFor(() => expect(state.playback?.frameCount).toBe(4));
  session.togglePlayback();
  seeking = true;
  session.stepFrame(1);
  session.stepFrame(1);
  expect(video.currentTime).toBeCloseTo(0.101, 8);
  expect(state.playback?.paused).toBe(true);
  expect(state.playback?.frameIndex).toBe(2);
  worker.emit(result); // first frame was still in flight
  expect(viewport.setPoints).not.toHaveBeenCalled();
  tick();
  expect(worker.postMessage).toHaveBeenCalledOnce();
  seeking = false;
  video.dispatchEvent(new Event("seeked"));
  tick();
  worker.emit(result);
  expect(viewport.setPoints).toHaveBeenCalledOnce();
  expect(state.phase).toBe("Video paused");
  session.stepFrame(-1);
  expect(video.currentTime).toBeCloseTo(0.041, 8);
  session.stepFrame(-1);
  expect(video.currentTime).toBeCloseTo(0.001, 8);
  session.stepFrame(-1);
  expect(video.currentTime).toBeCloseTo(0.001, 8);
  session.seekTo(12);
  session.stepFrame(1);
  expect(video.currentTime).toBe(12);
  session.stepFrame(-1);
  expect(video.currentTime).toBeCloseTo(0.101, 8);
});
it("keeps playback usable when indexing fails and ignores an index arriving after disposal", async () => {
  loadIndex.mockRejectedValueOnce(new Error("Bad metadata"));
  const failed = await loaded();
  await vi.waitFor(() =>
    expect(failed.state.playback?.frameStepError).toContain("unavailable"),
  );
  failed.session.togglePlayback();
  expect(failed.state.playback?.paused).toBe(false);
  expect(failed.state.error).toBeNull();
  let finish!: (times: Float64Array) => void;
  loadIndex.mockImplementationOnce(
    () =>
      new Promise<Float64Array>((resolve) => {
        finish = resolve;
      }),
  );
  const stopped = await loaded();
  stopped.session.dispose();
  const previous = stopped.state.playback;
  finish(new Float64Array([0, 1]));
  await flush();
  expect(stopped.state.playback).toBe(previous);
  const signal = loadIndex.mock.calls.at(-1)![2] as AbortSignal;
  expect(signal.aborted).toBe(true);
});
