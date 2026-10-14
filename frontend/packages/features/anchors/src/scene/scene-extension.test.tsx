// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ThreeEvent } from "@react-three/fiber";
import type { DataContract } from "@camera-path/contracts/contract-types";
import * as data from "@camera-path/contracts/host-data";
import * as requests from "@camera-path/contracts/host-requests";
import { HostProvider } from "@camera-path/extension-api/host-provider";
import { HostRuntime } from "@camera-path/extension-api/host-runtime";
import { DataCell } from "@camera-path/extension-api/data-cell";
import {
  SceneServicesProvider,
  type SceneServices,
} from "@camera-path/scene-runtime/viewport/scene-services-provider";
import {
  ViewportProvider,
  useViewportServices,
} from "@camera-path/scene-runtime/viewport/viewport-provider";
import { SceneExtension } from "./scene-extension";
vi.mock("./anchor-marker", () => ({ AnchorMarker: () => null }));
vi.mock("./anchor-placement-preview", () => ({
  AnchorPlacementPreview: () => null,
}));
vi.mock("./anchor-height-editing-overlay", () => ({
  AnchorHeightEditingOverlay: () => null,
}));
afterEach(cleanup);
function bind<T>(
  runtime: HostRuntime,
  contract: DataContract<string, T>,
  value: unknown,
) {
  const cell = new DataCell(contract);
  cell.set(contract.schema.parse(value));
  runtime.bindData(contract, cell.read, cell.subscribe);
  return cell;
}
function Surface() {
  const { events } = useViewportServices();
  return (
    <button
      onClick={(event) => {
        const nativeEvent = new PointerEvent("pointerdown", {
          pointerType: "mouse",
          pointerId: 1,
          clientX: 0,
          clientY: 0,
        });
        const pointer = {
          nativeEvent,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
          target: event.currentTarget,
          stopPropagation: vi.fn(),
        } as unknown as ThreeEvent<PointerEvent>;
        const hit = {
          position: [1, 2, 3] as [number, number, number],
          normal: [0, 1, 0] as [number, number, number],
        };
        events.emit("surfacePointerDown", { hit, event: pointer });
        events.emit("surfacePointerUp", { hit, event: pointer });
      }}
    >
      Pick surface
    </button>
  );
}
it("consumes generic surface events and calls addAnchor with its own placement defaults", async () => {
  const runtime = new HostRuntime("project", "project");
  const permission = bind(runtime, data.projectPermissions, { canEdit: true });
  bind(runtime, data.anchors, []);
  bind(runtime, data.cameraMode, "orbit");
  bind(runtime, data.sceneInteraction, {
    hoveredObjectId: null,
    selectedObjectId: null,
  });
  const tool = bind(runtime, data.editorTool, {
    activeTool: "anchor",
    pendingCloud: null,
  });
  runtime.bindRequest(requests.setActiveTool, (activeTool) =>
    tool.set({ activeTool, pendingCloud: null }),
  );
  const add = vi.fn();
  runtime.bindRequest(requests.addAnchor, add);
  const services = {
    backend: { invalidate: vi.fn() },
    dark: true,
    interactive: true,
    bottomInset: 0,
    depthSupported: false,
    radius: null,
    orbitTarget: [0, 0, 0],
    setOrbitTarget: vi.fn(),
    frame: vi.fn(),
    reportBounds: vi.fn(),
    requestDepth: vi.fn(),
  } as unknown as SceneServices;
  const mounted = render(
    <HostProvider runtime={runtime}>
      <ViewportProvider>
        <SceneServicesProvider value={services}>
          <SceneExtension />
          <Surface />
        </SceneServicesProvider>
      </ViewportProvider>
    </HostProvider>,
  );
  await act(async () => fireEvent.click(screen.getByText("Pick surface")));
  expect(add).toHaveBeenCalledWith(
    {
      label: "A",
      surface_position: [1, 2, 3],
      surface_normal: [0, 1, 0],
      lift: 0.5,
      lift_axis: "world_up",
    },
    expect.any(AbortSignal),
  );
  act(() => permission.set({ canEdit: false }));
  await act(async () => fireEvent.click(screen.getByText("Pick surface")));
  expect(add).toHaveBeenCalledOnce();
  mounted.unmount();
  runtime.dispose();
});
