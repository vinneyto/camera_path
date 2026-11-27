"use client";
import { useThree } from "@react-three/fiber";
import { useEditorStoreApi } from "@camera-path/store";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { createSceneWidget } from "./create-scene-widget";
import type { WidgetCallbacks, WidgetOptions } from "./widget-types";

export interface WidgetsProps extends WidgetCallbacks, WidgetOptions {
  sceneObjectID: string;
}

export function Widgets({
  sceneObjectID,
  onStart,
  onChange,
  onCommit,
  onCancel,
  ...options
}: WidgetsProps) {
  const get = useThree((state) => state.get);
  const store = useEditorStoreApi();
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const resource = useRef<ReturnType<typeof createSceneWidget> | null>(null);
  const start = useEffectEvent(onStart);
  const change = useEffectEvent(onChange);
  const commit = useEffectEvent(onCommit);
  const cancel = useEffectEvent(onCancel);
  const initial = useEffectEvent(() => options);
  useEffect(() => {
    const widget = createSceneWidget({
      scene,
      camera,
      canvas,
      sceneObjectID,
      initial: initial(),
      getOrbitControls: () => get().controls as { enabled: boolean } | null,
      canRestoreOrbit: () => {
        const { camera, tool } = store.getState();
        return (
          camera.cameraMode === "orbit" &&
          (tool.activeTool === null || tool.activeTool === "object-transform")
        );
      },
      callbacks: {
        onStart: () => start(),
        onChange: (value) => change(value),
        onCommit: (value) => commit(value),
        onCancel: () => cancel(),
      },
    });
    resource.current = widget;
    return () => {
      resource.current = null;
      widget.dispose();
    };
  }, [scene, camera, canvas, sceneObjectID, get, store]);
  useLayoutEffect(() => {
    resource.current?.update(options);
  });
  return null;
}
