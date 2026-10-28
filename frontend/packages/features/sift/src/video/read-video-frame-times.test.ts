import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { readVideoFrameTimes } from "./read-video-frame-times";
import { findVideoFrame } from "./find-video-frame";

it.each([
  ["cfr-bframes.mp4", 0.5, Array.from({ length: 12 }, (_, i) => i / 24)],
  [
    "vfr-bframes.mov",
    1,
    [0, 1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26].map((n) => n / 30),
  ],
] as const)(
  "indexes %s in display order with edit offsets and no assumed FPS",
  async (name, duration, expected) => {
    const bytes = await readFile(
      new URL(`./fixtures/${name}`, import.meta.url),
    );
    const times = await readVideoFrameTimes(new Blob([bytes]), duration);
    expect(times.length).toBe(expected.length);
    times.forEach((time, i) => {
      expect(time).toBeCloseTo(expected[i], 8);
      expect(findVideoFrame(times, time + 0.001)).toBe(i);
    });
    expect(findVideoFrame(times, duration)).toBe(times.length - 1);
    expect(findVideoFrame(times, -1)).toBe(0);
  },
);
it("rejects malformed video without an invented frame rate", async () => {
  await expect(
    readVideoFrameTimes(new Blob(["not a movie"]), 1),
  ).rejects.toThrow();
});
