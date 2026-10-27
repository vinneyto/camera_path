"use client";
import { createSiftViewport } from "../rendering/create-sift-viewport";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  DetectorParams,
  FrameRequest,
  SessionSource,
  WorkerResponse,
} from "../types";

export function useSiftSession(
  source: SessionSource | null,
  maxDimension: number,
  params: DetectorParams,
) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<{ refresh: () => void } | null>(null);
  const config = useEffectEvent(() => ({ maxDimension, params }));
  useEffect(() => {
    session.current?.refresh();
  }, [maxDimension, params]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [frame, setFrame] = useState<Extract<
    WorkerResponse,
    { kind: "frame" }
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState("Ready");
  const [processedFps, setProcessedFps] = useState(0);
  useEffect(() => {
    if (!source || !container.current) return;
    let disposed = false;
    let stream: MediaStream | null = null;
    let viewport: ReturnType<typeof createSiftViewport> | null = null;
    let raf = 0;
    let bitmap: ImageBitmap | null = null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement("canvas");
    const worker = new Worker(
      new URL("../worker/sift.worker.ts", import.meta.url),
      { type: "module" },
    );
    const release = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      session.current = null;
      worker.terminate();
      stream?.getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
      bitmap?.close();
      viewport?.dispose();
    };
    const fail = (cause: unknown) => {
      if (disposed) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setPhase("Stopped");
      release();
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
    // Observe failures immediately, including while the camera permission dialog is open.
    void workerReady.catch(fail);
    const target = container.current;
    const initialize = async () => {
      setError(null);
      setFrame(null);
      setPhase("Initializing Burn WebGPU…");
      setProcessedFps(0);
      await workerReady;
      if (disposed) return;
      if (source.kind === "camera") {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera access requires HTTPS or localhost. On a phone, open a trusted HTTPS address.",
          );
        }
        setPhase("Waiting for camera permission…");
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
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ),
        );
      } else {
        bitmap = await createImageBitmap(source.file);
        if (disposed) {
          bitmap.close();
          return;
        }
      }
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context)
        throw new Error("Could not create the camera frame buffer.");
      let lastTime = -1;
      let inFlight = false;
      let pendingImage = false;
      viewport = createSiftViewport(target, bitmap ?? video);
      let lastCompleted = 0;
      const intervals: number[] = [];
      const capture = () => {
        if (disposed || inFlight) return;
        if (!bitmap && video.currentTime === lastTime) {
          raf = requestAnimationFrame(capture);
          return;
        }
        try {
          const settings = config();
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
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );
          lastTime = video.currentTime;
          const rgba = pixels.data.buffer;
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
          viewport?.setPoints(result.points, result.width, result.height);
          const now = performance.now();
          if (lastCompleted) {
            intervals.push(now - lastCompleted);
            if (intervals.length > 20) intervals.shift();
            setProcessedFps(
              (1000 * intervals.length) / intervals.reduce((a, b) => a + b, 0),
            );
          }
          lastCompleted = now;
          setFrame(result);
          setPhase(bitmap ? "Image ready" : "Camera running");
          if (!bitmap || pendingImage) {
            pendingImage = false;
            raf = requestAnimationFrame(capture);
          }
        } catch (cause) {
          fail(cause);
        }
      };
      worker.onerror = () =>
        fail(new Error("SIFT worker failed. Stop and start the camera again."));
      session.current = {
        refresh: () => {
          if (!bitmap) return;
          setPhase("Detecting image…");
          if (inFlight) pendingImage = true;
          else capture();
        },
      };
      capture();
    };
    void initialize().catch(fail);
    return release;
  }, [source]);
  return {
    container,
    devices,
    frame,
    error,
    phase,
    processedFps,
    repeatDetection: () => session.current?.refresh(),
  };
}
