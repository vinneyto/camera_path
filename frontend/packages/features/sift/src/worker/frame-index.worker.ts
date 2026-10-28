import { readVideoFrameTimes } from "../video/read-video-frame-times";

self.onmessage = async (
  event: MessageEvent<{ file: File; duration: number }>,
) => {
  try {
    const times = await readVideoFrameTimes(
      event.data.file,
      event.data.duration,
    );
    self.postMessage({ times }, { transfer: [times.buffer] });
  } catch (cause) {
    self.postMessage({
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
