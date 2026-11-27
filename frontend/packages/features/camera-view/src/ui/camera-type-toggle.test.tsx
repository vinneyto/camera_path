// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import { ViewportProvider } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { CameraTypeToggle } from "./camera-type-toggle";
import { CameraModeToggle } from "./camera-mode-toggle";
afterEach(cleanup);

it("always selects one navigation type and retains it across trajectory view", () => {
  const store = createEditorStore();
  const actions = createEditorActions(store);
  render(
    <EditorStoreProvider store={store}>
      <EditorActionsProvider actions={actions}>
        <ViewportProvider>
          <CameraTypeToggle />
          <CameraModeToggle trajectoryAvailable onModeChange={() => {}} />
        </ViewportProvider>
      </EditorActionsProvider>
    </EditorStoreProvider>,
  );
  const orbit = screen.getByRole("button", { name: "OrbitControl" });
  const flight = screen.getByRole("button", { name: "FreeFlight" });
  expect(orbit.getAttribute("aria-pressed")).toBe("true");
  expect(flight.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(flight);
  expect(store.getState().camera).toEqual({
    cameraMode: "orbit",
    cameraType: "freeFlight",
  });
  expect(orbit.getAttribute("aria-pressed")).toBe("false");
  expect(flight.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "View from trajectory camera" }),
  );
  expect(store.getState().camera).toEqual({
    cameraMode: "trajectory",
    cameraType: "freeFlight",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Return to free flight camera" }),
  );
  expect(store.getState().camera.cameraType).toBe("freeFlight");
  fireEvent.click(
    screen.getByRole("button", { name: "View from trajectory camera" }),
  );
  fireEvent.click(orbit);
  expect(store.getState().camera).toEqual({
    cameraMode: "orbit",
    cameraType: "orbit",
  });
});
