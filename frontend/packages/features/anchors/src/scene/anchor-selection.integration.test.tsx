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
import { act } from "react";
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

vi.mock("@react-three/drei", () => ({ Html: () => null }));
vi.mock("@camera-path/scene-runtime/three/surface-target-ring", () => ({
  SurfaceTargetRing: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function Interaction({
  anchors,
  onCommit,
  canEdit,
}: {
  anchors: Anchor[];
  onCommit: (id: string, lift: number) => Promise<void>;
  canEdit: boolean;
}) {
  const { activeTool } = useEditorTool();
  const { hoverObject, selectObject, referenceChatObject } = useEditorActions();
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
        onActivate={(id) => {
          const anchor = anchors.find((item) => anchorObjectId(item.id) === id);
          if (canEdit && anchor) referenceChatObject(anchor.label);
        }}
      />
      {anchors.map((anchor) => (
        <SceneObject
          key={anchor.id}
          sceneObjectID={anchorObjectId(anchor.id)}
          hoverable={activeTool === null}
          selectable={false}
          clickable={activeTool === null}
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
              {...(canEdit ? height.getAnchorInteractionProps(anchor) : {})}
            />
          )}
        </SceneObject>
      ))}
    </>
  );
}

async function setup(anchors: Anchor[], canEdit = true) {
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
            <Interaction
              anchors={items}
              onCommit={onCommit}
              canEdit={canEdit}
            />
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

it("hovers and references anchor cylinders without selecting them, including touch taps", async () => {
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
    const collider = test.scene.getObjectByName(
      "anchor-selection-collider",
    ) as Mesh;
    expect((collider.material as MeshBasicMaterial).visible).toBe(false);
    await test.pointer("pointerdown", [0, 0, 0]);
    expect(test.store.getState().tool.activeTool).toBeNull();
    await test.pointer("pointerup", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(null);
    expect(test.store.getState().chatComposer.message).toBe("@A ");
    expect(test.onCommit).not.toHaveBeenCalled();
    await test.pointer("pointerleave", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(null);
    await test.pointer("pointerdown", [1.5, 0, 0], { pointerType: "touch" });
    await test.pointer("pointerup", [1.5, 0, 0], { pointerType: "touch" });
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(null);
    expect(test.store.getState().chatComposer.message).toBe("@A @B ");
    await test.pointer("pointerdown", [2.5, 2.5, 0]);
    await test.pointer("pointerup", [2.5, 2.5, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBeNull();
  } finally {
    await test.unmount();
  }
});

it.each([null, "model"])(
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
      expect(test.store.getState().chatComposer.message).toBe("");
      await test.pointer("pointermove", [0, 1.6, 0], { buttons: 1 });
      await test.pointer("pointerup", [0, 1.6, 0]);
      expect(test.onCommit).toHaveBeenCalledExactlyOnceWith("a", 2.5);
      expect(test.store.getState().chatComposer.message).toBe("");
      expect(test.store.getState().tool.activeTool).toBeNull();
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        selected,
      );
    } finally {
      await test.unmount();
    }
  },
);

it("keeps the selected model while repeated cylinder clicks add anchor references", async () => {
  const test = await setup([first]);
  try {
    await act(async () =>
      test.actions.selectObject({ id: "model", name: "Chair 01" }),
    );
    for (let i = 0; i < 2; i++) {
      await test.pointer("pointerdown", [0, 0, 0]);
      await test.pointer("pointerup", [0, 0, 0]);
    }
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
      "model",
    );
    expect(test.store.getState().chatComposer.message).toBe("@Chair 01 @A @A ");
    expect(test.onCommit).not.toHaveBeenCalled();
  } finally {
    await test.unmount();
  }
});

it.each([
  { pointerType: "mouse", canEdit: true },
  { pointerType: "pen", canEdit: true },
  { pointerType: "touch", canEdit: true },
  { pointerType: "mouse", canEdit: false },
])(
  "references the upper icon on $pointerType click without selection or height changes (canEdit: $canEdit)",
  async ({ pointerType, canEdit }) => {
    const test = await setup([first], canEdit);
    try {
      await act(async () => test.actions.selectObject({ id: "model" }));
      await test.pointer("pointerdown", [0, 1.1, 0], { pointerType });
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        "model",
      );
      await test.pointer("pointerup", [0, 1.1, 0], { pointerType });
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        "model",
      );
      expect(test.store.getState().chatComposer.message).toBe(
        canEdit ? "@A " : "",
      );
      expect(test.store.getState().tool.activeTool).toBeNull();
      expect(test.onCommit).not.toHaveBeenCalled();
    } finally {
      await test.unmount();
    }
  },
);

it("tolerates a small pointer jitter when clicking the upper icon", async () => {
  const test = await setup([first]);
  try {
    await test.pointer("pointerdown", [0, 1.1, 0]);
    await test.pointer("pointermove", [0, 1.12, 0], { buttons: 1 });
    await test.pointer("pointerup", [0, 1.12, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(null);
    expect(test.store.getState().chatComposer.message).toBe("@A ");
    expect(test.onCommit).not.toHaveBeenCalled();
  } finally {
    await test.unmount();
  }
});

it.each(["return", "cancel", "distant-release"])(
  "does not turn a height gesture into a mention after %s",
  async (ending) => {
    const test = await setup([first]);
    try {
      await act(async () => test.actions.selectObject({ id: "model" }));
      await test.pointer("pointerdown", [0, 1.1, 0]);
      if (ending !== "distant-release")
        await test.pointer("pointermove", [0, 1.6, 0], { buttons: 1 });
      if (ending === "return") {
        await test.pointer("pointermove", [0, 1.1, 0], { buttons: 1 });
        await test.pointer("pointerup", [0, 1.1, 0]);
      } else {
        await test.pointer(
          ending === "cancel" ? "pointercancel" : "pointerup",
          [0, 1.6, 0],
        );
      }
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        "model",
      );
      expect(test.store.getState().tool.activeTool).toBeNull();
      expect(test.onCommit).not.toHaveBeenCalled();
      expect(test.store.getState().chatComposer.message).toBe("");
    } finally {
      await test.unmount();
    }
  },
);

it("respects the closest occluder and clears hover when the anchor is removed", async () => {
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
    expect(test.store.getState().chatComposer.message).toBe("");
    blocker.visible = false;
    await test.pointer("pointermove", [0, 0, 0]);
    await test.pointer("pointerdown", [0, 0, 0]);
    await test.pointer("pointerup", [0, 0, 0]);
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(null);
    expect(test.store.getState().chatComposer.message).toBe("@A ");
    await test.render([]);
    expect(test.store.getState().sceneInteraction).toMatchObject({
      hoveredObjectId: null,
      selectedObjectId: null,
    });
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
  "keeps zero-height and tilted anchors clickable ($anchor.lift_axis, $anchor.lift)",
  async ({ anchor, point }) => {
    const test = await setup([anchor]);
    try {
      await test.pointer("pointerdown", point);
      await test.pointer("pointerup", point);
      expect(test.store.getState().sceneInteraction.selectedObjectId).toBe(
        null,
      );
      expect(test.store.getState().chatComposer.message).toBe("@A ");
      expect(test.onCommit).not.toHaveBeenCalled();
    } finally {
      await test.unmount();
    }
  },
);
