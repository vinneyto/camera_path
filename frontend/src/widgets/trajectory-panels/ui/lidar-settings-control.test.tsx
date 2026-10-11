// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createLidarTrack } from "../lib/create-lidar-track";
import { LidarSettingsControl } from "./lidar-settings-control";

it("offers one fixed presence marker and edits only static angular settings", () => {
  const settings = {
    vertical_fov_deg: 60,
    horizontal_resolution: 512,
    vertical_resolution: 32,
  };
  const remove = vi.fn(),
    save = vi.fn();
  const track = createLidarTrack({ id: "lidar", ...settings }, remove);
  expect(track.keyframes.map((key) => key.pathPosition)).toEqual([0]);
  track.onDeleteKeyframe("lidar");
  expect(remove).toHaveBeenCalledOnce();
  const view = render(
    <LidarSettingsControl settings={settings} pending={false} onSave={save} />,
  );
  fireEvent.change(screen.getByLabelText("Vertical angle (°)"), {
    target: { value: "90" },
  });
  fireEvent.change(screen.getByLabelText("Azimuth samples"), {
    target: { value: "1024" },
  });
  fireEvent.change(screen.getByLabelText("Elevation samples"), {
    target: { value: "64" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply LiDAR settings" }));
  expect(save).toHaveBeenCalledWith({
    vertical_fov_deg: 90,
    horizontal_resolution: 1024,
    vertical_resolution: 64,
  });
  fireEvent.change(screen.getByLabelText("Vertical angle (°)"), {
    target: { value: "180" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Apply LiDAR settings",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  view.unmount();
});
