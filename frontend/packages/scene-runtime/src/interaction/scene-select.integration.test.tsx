// @vitest-environment happy-dom
import { HOVERABLE, SELECTABLE } from "@camera-path/render-pipeline";
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import { createRoot, extend } from "@react-three/fiber";
import { act, StrictMode, type ReactNode } from "react";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  type WebGLRenderer,
} from "three";
import { afterEach, expect, it, vi } from "vitest";
import { SceneObject } from "./scene-object";
import { SceneSelect } from "./scene-select";

afterEach(() => vi.unstubAllGlobals());

async function createScene() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({ BoxGeometry, Group, Mesh, MeshBasicMaterial });
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  canvas.getBoundingClientRect = () => new DOMRect(10, 20, 100, 100);
  const scene = new Scene();
  const store = createEditorStore();
  const onSelect = vi.fn((id: string | null) =>
    store.setState((state) => ({
      sceneInteraction: { ...state.sceneInteraction, selectedObjectId: id },
    })),
  );
  const root = createRoot(canvas);
  await root.configure({
    scene,
    camera: { position: [0, 0, 5] },
    frameloop: "never",
    size: { width: 100, height: 100, top: 20, left: 10 },
    gl: {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement: canvas,
    } as unknown as WebGLRenderer,
  });
  return {
    canvas,
    scene,
    store,
    onSelect,
    async render(children: ReactNode, enabled = true) {
      await act(async () => {
        root.render(
          <StrictMode>
            <EditorStoreProvider store={store}>
              <SceneSelect enabled={enabled} onSelect={onSelect} />
              {children}
            </EditorStoreProvider>
          </StrictMode>,
        );
      });
    },
    async pointer(type: string, options: PointerEventInit = {}) {
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 1,
            isPrimary: true,
            clientX: 60,
            clientY: 70,
            button: 0,
            pointerType: "mouse",
            ...options,
          }),
        );
      });
    },
    selected() {
      return store.getState().sceneInteraction.selectedObjectId;
    },
    async unmount() {
      await act(async () => root.unmount());
      canvas.remove();
    },
  };
}

it("selects the nearest marked ancestor of only the first actual hit, independent of hover", async () => {
  const test = await createScene();
  const renderState = vi.fn();
  const objects = (selectable = true) => (
    <SceneObject
      sceneObjectID="outer"
      name="outer"
      userData={{ retained: true }}
    >
      {() => (
        <SceneObject
          sceneObjectID="inner"
          name="inner"
          selectable={selectable}
          hoverable={false}
          position={[0, 0, 1]}
        >
          {(state) => {
            renderState(state);
            return (
              <mesh>
                <boxGeometry />
                <meshBasicMaterial />
              </mesh>
            );
          }}
        </SceneObject>
      )}
    </SceneObject>
  );
  try {
    await test.render(objects());
    const outer = test.scene.getObjectByName("outer")!;
    expect(outer.userData).toEqual({ retained: true, sceneObjectID: "outer" });
    expect(
      [0, HOVERABLE, SELECTABLE].every((layer) =>
        outer.layers.isEnabled(layer),
      ),
    ).toBe(true);
    await test.pointer("pointerdown");
    expect(test.selected()).toBeNull();
    await test.pointer("pointerup");
    expect(test.selected()).toBe("inner");
    expect(renderState).toHaveBeenLastCalledWith({
      hovered: false,
      selected: true,
    });
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.render(objects(false));
    expect(
      test.scene.getObjectByName("inner")!.layers.isEnabled(SELECTABLE),
    ).toBe(false);
    expect(test.scene.getObjectByName("inner")!.layers.isEnabled(0)).toBe(true);
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    expect(test.selected()).toBe("outer");
    const blocker = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    blocker.position.z = 3;
    test.scene.add(blocker);
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    expect(test.selected()).toBeNull();
    blocker.visible = false;
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    expect(test.selected()).toBe("outer");
    test.scene.remove(blocker);
    blocker.geometry.dispose();
    blocker.material.dispose();
    await test.pointer("pointerdown", { clientX: 105 });
    await test.pointer("pointerup", { clientX: 105 });
    expect(test.selected()).toBeNull();
  } finally {
    await test.unmount();
  }
});

it("supports mouse, pen and touch taps and direct layer/userData contracts", async () => {
  const test = await createScene();
  try {
    await test.render(
      <mesh name="direct" userData={{ sceneObjectID: "direct" }}>
        <boxGeometry />
        <meshBasicMaterial />
      </mesh>,
    );
    test.scene.getObjectByName("direct")!.layers.enable(SELECTABLE);
    for (const pointerType of ["mouse", "pen", "touch"]) {
      test.onSelect.mockClear();
      await test.pointer("pointerdown", { pointerType });
      await test.pointer("pointerup", { pointerType });
      expect(test.onSelect).toHaveBeenCalledExactlyOnceWith("direct");
    }
  } finally {
    await test.unmount();
  }
});

it("retains selection through drags, cancellation, secondary clicks, multiple touches and disabled authoring modes", async () => {
  const test = await createScene();
  const objects = (
    <SceneObject sceneObjectID="model">
      {() => (
        <mesh>
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      )}
    </SceneObject>
  );
  try {
    await test.render(objects);
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    test.onSelect.mockClear();
    await test.pointer("pointerdown");
    await test.pointer("pointermove", { clientX: 85 });
    await test.pointer("pointermove"); // Returning to the start still counts as a drag.
    await test.pointer("pointerup");
    await test.pointer("pointerdown");
    await test.pointer("pointercancel");
    await test.pointer("pointerup");
    await test.pointer("pointerdown", { button: 2 });
    await test.pointer("pointerup", { button: 2 });
    await test.pointer("pointerdown", { pointerType: "touch" });
    await test.pointer("pointerdown", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: false,
    });
    await test.pointer("pointerup", {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: false,
    });
    await test.pointer("pointerup", { pointerType: "touch" });
    await test.pointer("pointerdown");
    await test.pointer("pointerup", { clientX: 200 });
    await test.pointer("pointerdown");
    await test.render(objects, false); // A comment marker starts a height drag.
    await test.render(objects, true);
    await test.pointer("pointerup");
    expect(test.onSelect).not.toHaveBeenCalled();
    expect(test.selected()).toBe("model");
    await test.render(objects, false);
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    expect(test.selected()).toBe("model");
  } finally {
    await test.unmount();
  }
});

it("retains logical selection when the Three.js object is recreated", async () => {
  const test = await createScene();
  const state = vi.fn();
  const objects = (key: string) => (
    <SceneObject key={key} sceneObjectID="model" name="model">
      {(flags) => {
        state(flags);
        return (
          <mesh>
            <boxGeometry />
            <meshBasicMaterial />
          </mesh>
        );
      }}
    </SceneObject>
  );
  try {
    await test.render(objects("first"));
    await test.pointer("pointerdown");
    await test.pointer("pointerup");
    const old = test.scene.getObjectByName("model");
    await test.render(objects("second"));
    expect(test.scene.getObjectByName("model")).not.toBe(old);
    expect(test.selected()).toBe("model");
    expect(state).toHaveBeenLastCalledWith({ hovered: false, selected: true });
  } finally {
    await test.unmount();
  }
});
