// @vitest-environment happy-dom
import {
  createEditorActions,
  EditorActionsProvider,
  useEditorActions,
} from "@camera-path/actions";
import {
  configureInteractiveRaycasterLayers,
  createRenderPipelineEvents,
} from "@camera-path/render-pipeline";
import { SceneHover } from "@camera-path/scene-runtime/interaction/scene-hover";
import { SceneObject } from "@camera-path/scene-runtime/interaction/scene-object";
import { SceneSelect } from "@camera-path/scene-runtime/interaction/scene-select";
import {
  createEditorStore,
  EditorStoreProvider,
  useEditorTool,
} from "@camera-path/store";
import { anchorObjectId } from "@camera-path/types/anchor-object-id";
import type { Anchor, Vec3 } from "@camera-path/types/project";
import { createRoot, extend, type RootState } from "@react-three/fiber";
import { act, useEffect } from "react";
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import { afterEach, expect, it, vi } from "vitest";
import { AnchorMarkerContent } from "./anchor-marker-content";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";

const indicators = new Map<string, { selected: boolean; position: Vec3 }>();
vi.mock("@react-three/drei", () => ({ Html: () => null }));
vi.mock("@camera-path/scene-runtime/three/surface-target-ring", () => ({
  SurfaceTargetRing: () => null,
}));
vi.mock("./anchor-selection-indicator", () => ({
  AnchorSelectionIndicator: (props: {
    anchorId: string;
    selected: boolean;
    position: Vec3;
  }) => {
    useEffect(() => {
      indicators.set(props.anchorId, props);
      return () => {
        indicators.delete(props.anchorId);
      };
    }, [props]);
    return null;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  indicators.clear();
});

function Interaction({
  anchors,
  onCommit,
}: {
  anchors: Anchor[];
  onCommit: (id: string, lift: number) => Promise<void>;
}) {
  const { activeTool } = useEditorTool();
  const { hoverObject, selectObject } = useEditorActions();
  const height = useAnchorHeightEditing({ anchors, onCommit });
  return (
    <>
      <SceneHover
        enabled={activeTool === null}
        onHover={(id) => hoverObject({ id })}
      />
      <SceneSelect
        enabled={activeTool === null}
        onSelect={(id) => selectObject({ id })}
      />
      {anchors.map((anchor) => (
        <SceneObject
          key={anchor.id}
          sceneObjectID={anchorObjectId(anchor.id)}
          hoverable={activeTool === null}
        >
          {({ hovered, selected }) => (
            <AnchorMarkerContent
              anchor={
                height.preview?.anchorId === anchor.id
                  ? {
                      ...anchor,
                      lift: height.preview.lift,
                      lift_axis: "world_up",
                    }
                  : anchor
              }
              hovered={hovered}
              selected={selected}
              selectable={activeTool === null}
              dragging={
                height.preview?.anchorId === anchor.id &&
                height.preview.dragging
              }
              {...height.getAnchorInteractionProps(anchor)}
            />
          )}
        </SceneObject>
      ))}
    </>
  );
}

async function setup(anchors: Anchor[]) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({
    BoxGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    MeshBasicMaterial,
    SphereGeometry,
  });
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 400, 400);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  document.body.append(canvas);
  const scene = new Scene();
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const onCommit = vi.fn(async () => {});
  const root = createRoot(canvas);
  let state!: RootState;
  await root.configure({
    scene,
    camera: { position: [0, 0, 5] },
    events: createRenderPipelineEvents,
    onCreated: (created) => {
      state = created;
      configureInteractiveRaycasterLayers(created.raycaster);
    },
    frameloop: "never",
    size: { width: 400, height: 400, top: 0, left: 0 },
    gl: {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement: canvas,
    } as unknown as WebGLRenderer,
  });
  async function render(items = anchors) {
    await act(async () =>
      root.render(
        <EditorStoreProvider store={store}>
          <EditorActionsProvider actions={actions}>
            <Interaction anchors={items} onCommit={onCommit} />
          </EditorActionsProvider>
        </EditorStoreProvider>,
      ),
    );
  }
  await render();
  return {
    store,
    actions,
    scene,
    onCommit,
    render,
    async pointer(type: string, point: Vec3, init: PointerEventInit = {}) {
      state.camera.updateWorldMatrix(true, false);
      scene.updateMatrixWorld(true);
      const screen = new Vector3(...point).project(state.camera);
      const event = new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        pointerType: "mouse",
        clientX: (screen.x + 1) * 200,
        clientY: (1 - screen.y) * 200,
        buttons: type === "pointerdown" ? 1 : 0,
        ...init,
      });
      Object.defineProperties(event, {
        offsetX: { value: event.clientX },
        offsetY: { value: event.clientY },
      });
      await act(async () => canvas.dispatchEvent(event));
    },
    async unmount() {
      await act(async () => root.unmount());
      canvas.remove();
    },
  };
}

const first: Anchor = {
  id: "a",
  label: "A",
  surface_position: [0, -1, 0],
  surface_normal: [0, 1, 0],
  lift: 2,
  lift_axis: "world_up",
};

it("selects the cylinder through the shared picker, retains the indicator after pointer-out, switches anchors and deselects on empty space", async () => {
  const second = {
    ...first,
    id: "b",
    label: "B",
    surface_position: [1.5, -1, 0] as Vec3,
  };
  const test = await setup([first, second]);
  try {
    await test.pointer("pointermove", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe(
      "anchor:a",
    );
    expect(indicators.get("a")?.selected).toBe(false);
    expect(
      new Vector3(...indicators.get("a")!.position).distanceTo(
        new Vector3(0, -1, 0),
      ),
    ).toBe(0);
    const collider = test.scene.getObjectByName(
      "anchor-selection-collider",
    ) as Mesh;
    expect((collider.material as MeshBasicMaterial).visible).toBe(false);
    await test.pointer("pointerdown", [0, 0, 0]);
    expect(test.store.getState().tool.activeTool).toBeNull();
    await test.pointer("pointerup", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
      "anchor:a",
    );
    expect(test.onCommit).not.toHaveBeenCalled();
    await test.pointer("pointerleave", [0, 0, 0]);
    expect(indicators.get("a")?.selected).toBe(true);
    await test.pointer("pointerdown", [1.5, 0, 0], { pointerType: "touch" });
    await test.pointer("pointerup", [1.5, 0, 0], { pointerType: "touch" });
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
      "anchor:b",
    );
    expect(indicators.has("a")).toBe(false);
    await test.pointer("pointerdown", [2.5, 2.5, 0]);
    await test.pointer("pointerup", [2.5, 2.5, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBeNull();
    expect(indicators.size).toBe(0);
  } finally {
    await test.unmount();
  }
});

it.each([null, "model", "anchor:a"])(
  "keeps selection %s unchanged during actual height-handle pointer events",
  async (selected) => {
    const test = await setup([first]);
    try {
      await act(async () => test.actions.selectObject({ id: selected }));
      await test.pointer("pointerdown", [0, 1.1, 0]);
      expect(test.store.getState().tool.activeTool).toBe("anchor-height");
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        selected,
      );
      if (selected === "anchor:a")
        expect(indicators.get("a")?.selected).toBe(true);
      await test.pointer("pointermove", [0, 1.6, 0], { buttons: 1 });
      await test.pointer("pointerup", [0, 1.6, 0]);
      expect(test.onCommit).toHaveBeenCalledExactlyOnceWith("a", 2.5);
      expect(test.store.getState().tool.activeTool).toBeNull();
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        selected,
      );
    } finally {
      await test.unmount();
    }
  },
);

it("respects the closest occluder and clears interaction when the anchor is removed", async () => {
  const test = await setup([first]);
  const blocker = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  blocker.position.z = 2;
  test.scene.add(blocker);
  try {
    await test.pointer("pointermove", [0, 0, 0]);
    await test.pointer("pointerdown", [0, 0, 0]);
    await test.pointer("pointerup", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction).toMatchObject({
      hoveredObjectId: null,
      selectedObjectId: null,
    });
    blocker.visible = false;
    await test.pointer("pointermove", [0, 0, 0]);
    await test.pointer("pointerdown", [0, 0, 0]);
    await test.pointer("pointerup", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
      "anchor:a",
    );
    await test.render([]);
    expect(test.store.getState().sceneInteraction).toMatchObject({
      hoveredObjectId: null,
      selectedObjectId: null,
    });
    expect(indicators.size).toBe(0);
  } finally {
    test.scene.remove(blocker);
    blocker.geometry.dispose();
    blocker.material.dispose();
    await test.unmount();
  }
});

it.each([
  {
    anchor: { ...first, lift: 0, surface_position: [0, 0, 0] as Vec3 },
    point: [0.15, 0, 0] as Vec3,
  },
  {
    anchor: {
      ...first,
      lift_axis: "surface_normal" as const,
      surface_normal: [Math.SQRT1_2, Math.SQRT1_2, 0] as Vec3,
    },
    point: [Math.SQRT1_2, -1 + Math.SQRT1_2, 0] as Vec3,
  },
])(
  "keeps zero-height and tilted anchors selectable ($anchor.lift_axis, $anchor.lift)",
  async ({ anchor, point }) => {
    const test = await setup([anchor]);
    try {
      await test.pointer("pointerdown", point);
      await test.pointer("pointerup", point);
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        "anchor:a",
      );
      expect(test.onCommit).not.toHaveBeenCalled();
    } finally {
      await test.unmount();
    }
  },
);
