// @vitest-environment happy-dom
import { HOVERABLE } from "@camera-path/render-pipeline";
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
import { SceneHover } from "./scene-hover";

afterEach(() => vi.unstubAllGlobals());

async function createScene() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({ BoxGeometry, Group, Mesh, MeshBasicMaterial });
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => new DOMRect(10, 20, 100, 100);
  const scene = new Scene();
  const store = createEditorStore();
  const onHover = vi.fn((id: string | null) =>
    store.setState((state) => ({
      sceneInteraction: { ...state.sceneInteraction, hoveredObjectId: id },
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
    onHover,
    async render(children: ReactNode, enabled = true) {
      await act(async () => {
        root.render(
          <StrictMode>
            <EditorStoreProvider store={store}>
              <SceneHover enabled={enabled} onHover={onHover} />
              {children}
            </EditorStoreProvider>
          </StrictMode>,
        );
      });
    },
    async move(pointerType = "mouse", clientX = 60, buttons = 0) {
      await act(async () =>
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX,
            clientY: 70,
            pointerType,
            buttons,
          }),
        ),
      );
    },
    async unmount() {
      await act(async () => root.unmount());
    },
  };
}

it("uses actual scene intersections, nested logical IDs and per-object render props", async () => {
  const test = await createScene();
  const renderState = vi.fn();
  const objects = (
    <SceneObject
      sceneObjectID="outer"
      name="outer"
      userData={{ retained: true }}
    >
      {() => (
        <SceneObject sceneObjectID="inner" name="inner" position={[0, 0, 1]}>
          {({ hovered }) => {
            renderState(hovered);
            return (
              <mesh name="geometry">
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
    await test.render(objects);
    const outer = test.scene.getObjectByName("outer")!;
    expect(outer.userData).toEqual({ retained: true, sceneObjectID: "outer" });
    expect(outer.layers.isEnabled(0)).toBe(true);
    expect(outer.layers.isEnabled(HOVERABLE)).toBe(true);
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe(
      "inner",
    );
    expect(renderState).toHaveBeenLastCalledWith(true);
    // No individual mesh handlers are registered. A plain mesh still blocks.
    const blocker = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    blocker.position.z = 3;
    test.scene.add(blocker);
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    expect(renderState).toHaveBeenLastCalledWith(false);
    blocker.visible = false;
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe(
      "inner",
    );
    test.scene.remove(blocker);
    blocker.geometry.dispose();
    blocker.material.dispose();
    await test.move("mouse", 110);
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.move();
    await test.render(
      <SceneObject sceneObjectID="outer" name="outer" hoverable={false}>
        {() => (
          <group visible={false}>
            <mesh>
              <boxGeometry />
              <meshBasicMaterial />
            </mesh>
          </group>
        )}
      </SceneObject>,
    );
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    expect(test.scene.getObjectByName("outer")!.layers.isEnabled(0)).toBe(true);
    expect(
      test.scene.getObjectByName("outer")!.layers.isEnabled(HOVERABLE),
    ).toBe(false);
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
  } finally {
    await test.unmount();
  }
});

it("clears on leave, cancellation, removal and disable; ignores touch and drags", async () => {
  const test = await createScene();
  const objects = (
    <SceneObject sceneObjectID="model" name="model">
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
    for (const type of ["pointerleave", "pointercancel"]) {
      await test.move("pen");
      expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe(
        "model",
      );
      await act(async () => test.canvas.dispatchEvent(new PointerEvent(type)));
      expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    }
    await test.move("touch");
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.move("mouse", 60, 1);
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.move();
    await test.render(null);
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.render(objects);
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBe(
      "model",
    );
    await test.render(objects, false);
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    await test.move();
    expect(test.store.getState().sceneInteraction.hoveredObjectId).toBeNull();
    expect(test.store.getState().sceneInteraction.selectedObjectId).toBeNull();
  } finally {
    await test.unmount();
  }
});
