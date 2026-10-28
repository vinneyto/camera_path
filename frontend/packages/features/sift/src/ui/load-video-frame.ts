/** Wait for a decoded frame, not just dimensions, and abort with the session. */
export function loadVideoFrame(
  video: HTMLVideoElement,
  url: string,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const ready = () => {
      if (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        cleanup();
        resolve();
      }
    };
    const failed = () => {
      cleanup();
      reject(
        new Error(
          "This browser could not decode this video. Try an MP4 encoded with H.264. MOV support depends on its video codec.",
        ),
      );
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("Video loading was cancelled", "AbortError"));
    };
    if (signal.aborted) {
      aborted();
      return;
    }
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    video.addEventListener("error", failed);
    signal.addEventListener("abort", aborted, { once: true });
    video.preload = "auto";
    video.src = url;
    video.load();
    ready();
  });
}
