import { createSiftViewport } from "../rendering/create-sift-viewport";
import type {
  DetectorParams,
  FrameRequest,
  SessionSource,
  VideoPlaybackState,
  WorkerResponse,
} from "../types";
import { findVideoFrame } from "../video/find-video-frame";
import { loadVideoFrameIndex } from "./load-video-frame-index";
import { loadVideoFrame } from "./load-video-frame";

export interface SiftSessionState {
  devices: MediaDeviceInfo[];
  frame: Extract<WorkerResponse, { kind: "frame" }> | null;
  error: string | null;
  phase: string;
  processedFps: number;
  playback: VideoPlaybackState | null;
}
interface SiftSessionOptions {
  target: HTMLDivElement;
  source: SessionSource;
  getConfig: () => { maxDimension: number; params: DetectorParams };
  onUpdate: (changes: Partial<SiftSessionState>) => void;
}

/** One source owns its decoder, object URL, worker and Three.js resources. */
export function createSiftSession({
  target,
  source,
  getConfig,
  onUpdate,
}: SiftSessionOptions) {
  let disposed = false;
  let stream: MediaStream | null = null;
  let viewport: ReturnType<typeof createSiftViewport> | null = null;
  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;
  let raf = 0;
  let inFlight = false;
  let pending = false;
  let lastTime = -1;
  let version = 0;
  let requestVersion = 0;
  let lastCompleted = 0;
  let frameTimes: Float64Array | null = null;
  let frameStepError: string | null = null;
  let holdForDetection = false;
  let heldTime = 0;
  let lastStepAt = -Infinity;
  let rapidStepping = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  // A second step within this window enters immediate preview until input settles.
  const stepBurstMs = 250;
  const intervals: number[] = [];
  const listeners: (() => void)[] = [];
  const abort = new AbortController();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement("canvas");
  const worker = new Worker(
    new URL("../worker/sift.worker.ts", import.meta.url),
    { type: "module" },
  );
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(settleTimer);
    listeners.forEach((remove) => remove());
    abort.abort();
    worker.terminate();
    stream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.srcObject = null;
    if (objectUrl) {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
    bitmap?.close();
    viewport?.dispose();
  };
  const fail = (cause: unknown) => {
    if (disposed) return;
    onUpdate({
      error: cause instanceof Error ? cause.message : String(cause),
      phase: "Stopped",
      playback: null,
    });
    dispose();
  };
  const workerReady = new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.kind === "ready") resolve();
      if (event.data.kind === "error") reject(new Error(event.data.message));
    };
    worker.onerror = () =>
      reject(
        new Error(
          "Could not load the SIFT worker. Run npm run sift:build and retry.",
        ),
      );
  });
  void workerReady.catch(fail);
  let capture = () => {};
  const schedule = () => {
    if (disposed || inFlight || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      capture();
    });
  };
  const resetRate = () => {
    lastCompleted = 0;
    intervals.length = 0;
    onUpdate({ processedFps: 0 });
  };
  const syncPlayback = () => {
    if (disposed || source.kind !== "video") return;
    onUpdate({
      playback: {
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration)
          ? Math.max(0, video.duration)
          : 0,
        paused: video.paused,
        ended: video.ended,
        frameIndex: frameTimes
          ? findVideoFrame(frameTimes, video.currentTime)
          : null,
        displayedFrameIndex: frameTimes
          ? findVideoFrame(
              frameTimes,
              holdForDetection ? heldTime : video.currentTime,
            )
          : null,
        frameCount: frameTimes?.length ?? 0,
        frameStepError,
      },
    });
  };
  const phase = () =>
    bitmap
      ? "Image ready"
      : source.kind === "camera"
        ? "Camera running"
        : video.ended
          ? "Video ended"
          : video.paused
            ? "Video paused"
            : "Video playing";
  const refresh = () => {
    if (disposed || !viewport) return;
    version++;
    lastTime = -1;
    pending = true;
    if (!holdForDetection) viewport.clearPoints();
    resetRate();
    onUpdate({
      ...(holdForDetection ? {} : { frame: null }),
      phase:
        source.kind === "video"
          ? "Detecting video frame…"
          : bitmap
            ? "Detecting image…"
            : "Camera running",
    });
    schedule();
  };
  const resetStepping = () => {
    clearTimeout(settleTimer);
    lastStepAt = -Infinity;
    rapidStepping = false;
    holdForDetection = false;
    viewport?.releaseMedia();
  };
  const listen = (name: string, handler: () => void) => {
    video.addEventListener(name, handler);
    listeners.push(() => video.removeEventListener(name, handler));
  };
  const initialize = async () => {
    onUpdate({
      error: null,
      frame: null,
      phase: "Initializing Burn WebGPU…",
      processedFps: 0,
      playback: null,
    });
    await workerReady;
    if (disposed) return;
    if (source.kind === "camera") {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access requires HTTPS or localhost. On a phone, open a trusted HTTPS address.",
        );
      onUpdate({ phase: "Waiting for camera permission…" });
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: source.deviceId
          ? { deviceId: { exact: source.deviceId } }
          : { facingMode: { ideal: "environment" } },
      });
      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream
        .getVideoTracks()
        .forEach((track) =>
          track.addEventListener("ended", () =>
            fail(
              new Error(
                "Camera disconnected. Select a camera and start again.",
              ),
            ),
          ),
        );
      video.srcObject = stream;
      await video.play();
      if (disposed) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (disposed) return;
      onUpdate({ devices: devices.filter((d) => d.kind === "videoinput") });
    } else if (source.kind === "image") {
      bitmap = await createImageBitmap(source.file);
      if (disposed) {
        bitmap.close();
        return;
      }
    } else {
      onUpdate({ phase: "Loading video…" });
      objectUrl = URL.createObjectURL(source.file);
      await loadVideoFrame(video, objectUrl, abort.signal);
      if (disposed) return;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create the media frame buffer.");
    viewport = createSiftViewport(target, bitmap ?? video);
    capture = () => {
      if (disposed || inFlight || rapidStepping) return;
      if (
        !bitmap &&
        (video.currentTime === lastTime ||
          video.seeking ||
          (source.kind === "video" && video.readyState < 2))
      ) {
        if (source.kind === "camera" || !video.paused) schedule();
        return;
      }
      try {
        const settings = getConfig();
        const width = bitmap?.width ?? video.videoWidth;
        const height = bitmap?.height ?? video.videoHeight;
        const scale = Math.min(
          1,
          settings.maxDimension / Math.max(width, height),
        );
        const frameWidth = Math.max(3, Math.round(width * scale));
        const frameHeight = Math.max(3, Math.round(height * scale));
        if (canvas.width !== frameWidth) canvas.width = frameWidth;
        if (canvas.height !== frameHeight) canvas.height = frameHeight;
        context.drawImage(bitmap ?? video, 0, 0, canvas.width, canvas.height);
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height)
          .data.buffer;
        viewport?.refreshMedia();
        lastTime = video.currentTime;
        requestVersion = version;
        pending = false;
        inFlight = true;
        worker.postMessage(
          {
            width: canvas.width,
            height: canvas.height,
            rgba,
            params: settings.params,
          } satisfies FrameRequest,
          [rgba],
        );
      } catch (cause) {
        fail(cause);
      }
    };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (disposed) return;
      const result = event.data;
      if (result.kind === "error") {
        fail(new Error(result.message));
        return;
      }
      if (result.kind !== "frame") return;
      try {
        inFlight = false;
        if (requestVersion === version && !video.seeking && !rapidStepping) {
          viewport?.setPoints(result.points, result.width, result.height);
          if (holdForDetection) {
            // No browser paint can occur between the new geometry and releasing the held image.
            viewport?.releaseMedia();
            holdForDetection = false;
            syncPlayback();
          }
          const now = performance.now();
          let fps = 0;
          if (
            source.kind === "camera" ||
            (source.kind === "video" && !video.paused)
          ) {
            if (lastCompleted) {
              intervals.push(now - lastCompleted);
              if (intervals.length > 20) intervals.shift();
              fps =
                (1000 * intervals.length) /
                intervals.reduce((a, b) => a + b, 0);
            }
            lastCompleted = now;
          }
          onUpdate({ frame: result, phase: phase(), processedFps: fps });
        }
        if (
          pending ||
          source.kind === "camera" ||
          (source.kind === "video" && !video.paused)
        )
          schedule();
      } catch (cause) {
        fail(cause);
      }
    };
    worker.onerror = () =>
      fail(new Error("SIFT worker failed. Stop and reopen the source."));
    if (source.kind === "video") {
      for (const name of ["timeupdate", "durationchange"])
        listen(name, syncPlayback);
      listen("play", () => {
        resetRate();
        syncPlayback();
        onUpdate({ phase: phase() });
        schedule();
      });
      listen("pause", () => {
        syncPlayback();
        refresh();
      });
      listen("ended", () => {
        syncPlayback();
        onUpdate({ phase: phase() });
      });
      listen("seeking", () => {
        syncPlayback();
        refresh();
      });
      listen("seeked", () => {
        syncPlayback();
        viewport?.refreshMedia();
        schedule();
      });
      listen("error", () =>
        fail(
          new Error("Video playback failed. Try an MP4 encoded with H.264."),
        ),
      );
      syncPlayback();
      void loadVideoFrameIndex(source.file, video.duration, abort.signal).then(
        (times) => {
          if (disposed) return;
          frameTimes = times;
          syncPlayback();
        },
        () => {
          if (disposed) return;
          frameStepError = "Frame stepping unavailable for this file.";
          syncPlayback();
        },
      );
    }
    capture();
  };
  void initialize().catch(fail);
  return {
    dispose,
    refresh,
    togglePlayback: () => {
      if (disposed || !viewport || source.kind !== "video") return;
      if (!video.paused) {
        video.pause();
        return;
      }
      resetStepping();
      refresh();
      if (video.ended) video.currentTime = 0;
      void video.play().catch(fail);
    },
    stepFrame: (direction: -1 | 1) => {
      if (disposed || !viewport || source.kind !== "video" || !frameTimes)
        return;
      const current = findVideoFrame(frameTimes, video.currentTime);
      const next = Math.max(
        0,
        Math.min(frameTimes.length - 1, current + direction),
      );
      if (next === current) return;
      try {
        const now = performance.now();
        const repeated = now - lastStepAt < stepBurstMs;
        lastStepAt = now;
        clearTimeout(settleTimer);
        if (repeated) {
          holdForDetection = false;
          rapidStepping = true;
          viewport.releaseMedia();
          settleTimer = setTimeout(() => {
            rapidStepping = false;
            schedule();
          }, stepBurstMs);
        } else {
          rapidStepping = false;
          if (!holdForDetection) heldTime = video.currentTime;
          viewport.holdMedia();
          holdForDetection = true;
        }
        video.pause();
        refresh();
        const start = frameTimes[next];
        const end = frameTimes[next + 1] ?? video.duration;
        // Seek just inside the selected frame, avoiding boundary rounding in native decoders.
        video.currentTime = start + Math.min(0.001, (end - start) / 2);
        syncPlayback();
      } catch (cause) {
        fail(cause);
      }
    },
    seekTo: (seconds: number) => {
      if (
        disposed ||
        !viewport ||
        source.kind !== "video" ||
        !Number.isFinite(seconds) ||
        !Number.isFinite(video.duration)
      )
        return;
      try {
        resetStepping();
        refresh();
        video.currentTime = Math.min(Math.max(0, seconds), video.duration);
        syncPlayback();
      } catch (cause) {
        fail(cause);
      }
    },
  };
}
