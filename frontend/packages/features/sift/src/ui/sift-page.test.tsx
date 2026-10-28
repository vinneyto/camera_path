// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiftPage } from "./sift-page";
const session = vi.hoisted(() => ({
  container: { current: null },
  devices: [],
  frame: null,
  error: null,
  phase: "Video paused",
  processedFps: 0,
  playback: null,
  repeatDetection: vi.fn(),
  togglePlayback: vi.fn(),
  seekTo: vi.fn(),
  stepFrame: vi.fn(),
}));
vi.mock("./use-sift-session", () => ({ useSiftSession: vi.fn(() => session) }));
afterEach(cleanup);
it("maximizes in place and restores with Escape without replacing the media target", () => {
  render(<SiftPage />);
  fireEvent.change(screen.getByLabelText("Open video", { exact: true }), {
    target: { files: [new File(["movie"], "portrait.mov")] },
  });
  const target = screen.getByLabelText("Three.js media and keypoint viewer");
  const playback = screen.getByLabelText("Video playback");
  fireEvent.click(screen.getByRole("button", { name: "Maximize video" }));
  expect(screen.getByLabelText("Three.js media and keypoint viewer")).toBe(
    target,
  );
  expect(screen.getByLabelText("Video playback")).toBe(playback);
  expect(
    screen
      .getByRole("button", { name: "Restore video size" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.getByRole("heading", { hidden: true }).closest(".hidden"),
  ).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Maximize video" })).toBeTruthy();
  expect(screen.getByLabelText("Three.js media and keypoint viewer")).toBe(
    target,
  );
});
