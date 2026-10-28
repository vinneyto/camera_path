// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VideoPlaybackControls } from "./video-playback-controls";
import { formatVideoTime } from "./format-video-time";
afterEach(cleanup);
it("exposes loading, playback, seeking and replay controls with an accessible time value", () => {
  const onToggle = vi.fn(),
    onSeek = vi.fn();
  const { rerender } = render(
    <VideoPlaybackControls
      name="demo.mov"
      playback={null}
      onToggle={onToggle}
      onSeek={onSeek}
    />,
  );
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  rerender(
    <VideoPlaybackControls
      name="demo.mov"
      playback={{ currentTime: 3, duration: 12, paused: true, ended: false }}
      onToggle={onToggle}
      onSeek={onSeek}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Play video" }));
  expect(onToggle).toHaveBeenCalledOnce();
  const slider = screen.getByRole("slider", { name: "Video position" });
  expect(slider.getAttribute("aria-valuetext")).toBe("0:03 of 0:12");
  fireEvent.change(slider, { target: { value: "7.5" } });
  expect(onSeek).toHaveBeenCalledWith(7.5);
  rerender(
    <VideoPlaybackControls
      name="demo.mov"
      playback={{ currentTime: 12, duration: 12, paused: true, ended: true }}
      onToggle={onToggle}
      onSeek={onSeek}
    />,
  );
  expect(screen.getByRole("button", { name: "Replay video" })).toBeTruthy();
});
it("formats finite times, including recordings longer than one hour", () => {
  expect([0, 63, 3661, Infinity, -1].map(formatVideoTime)).toEqual([
    "0:00",
    "1:03",
    "1:01:01",
    "0:00",
    "0:00",
  ]);
});
