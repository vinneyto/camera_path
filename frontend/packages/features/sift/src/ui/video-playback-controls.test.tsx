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
      onStep={vi.fn()}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Play video" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  rerender(
    <VideoPlaybackControls
      name="demo.mov"
      playback={{
        currentTime: 3,
        duration: 12,
        paused: true,
        ended: false,
        frameIndex: 72,
        frameCount: 288,
        frameStepError: null,
      }}
      onToggle={onToggle}
      onSeek={onSeek}
      onStep={vi.fn()}
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
      playback={{
        currentTime: 12,
        duration: 12,
        paused: true,
        ended: true,
        frameIndex: 287,
        frameCount: 288,
        frameStepError: null,
      }}
      onToggle={onToggle}
      onSeek={onSeek}
      onStep={vi.fn()}
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

it("exposes single-frame controls and disables steps at the boundaries while compact", () => {
  const onStep = vi.fn();
  const props = {
    name: "demo.mov",
    onToggle: vi.fn(),
    onSeek: vi.fn(),
    onStep,
    compact: true,
  };
  const playback = {
    currentTime: 0,
    duration: 1,
    paused: true,
    ended: false,
    frameIndex: 0,
    frameCount: 12,
    frameStepError: null,
  };
  const { rerender } = render(
    <VideoPlaybackControls {...props} playback={playback} />,
  );
  expect(screen.queryByText("demo.mov")).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "Previous frame",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
  expect(onStep).toHaveBeenCalledWith(1);
  expect(screen.getByText("Frame 1 / 12")).toBeTruthy();
  rerender(
    <VideoPlaybackControls
      {...props}
      playback={{ ...playback, frameIndex: 11 }}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "Next frame" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous frame" }));
  expect(onStep).toHaveBeenLastCalledWith(-1);
});
