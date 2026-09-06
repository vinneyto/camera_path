"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { RenderPipeline, WebGPURenderer, type Node } from "three/webgpu";
import { pass as scenePass } from "three/tsl";

import { compositePremultipliedOver } from "./composite-premultiplied-over";
import type {
  RenderPipelineContextValue,
  RenderPipelineLayer,
  RenderPipelineLayerOptions,
} from "./render-pipeline-types";

interface PipelineResources {
  pipeline: RenderPipeline;
  scene: ReturnType<typeof scenePass>;
}

const RenderPipelineContext = createContext<RenderPipelineContextValue | null>(null);

export function RenderPipelineProvider({ children }: PropsWithChildren) {
  const camera = useThree((state) => state.camera);
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const layersRef = useRef(new Map<symbol, RenderPipelineLayer>());
  const nextSequenceRef = useRef(0);
  const resourcesRef = useRef<PipelineResources | null>(null);

  if (!(renderer instanceof WebGPURenderer)) {
    throw new TypeError("RenderPipelineCanvas requires Three.js WebGPURenderer");
  }

  const rebuildOutput = useCallback(() => {
    const resources = resourcesRef.current;
    if (resources === null) return;
    const layers = [...layersRef.current.values()].sort(
      (left, right) => left.order - right.order || left.sequence - right.sequence,
    );
    let output: Node<"vec4"> | null = null;
    for (const layer of layers) {
      output = output === null
        ? layer.node
        : compositePremultipliedOver(output, layer.node);
    }
    resources.pipeline.outputNode = output === null
      ? resources.scene
      : compositePremultipliedOver(output, resources.scene);
    resources.pipeline.needsUpdate = true;
  }, []);

  const registerLayer = useCallback((
    node: Node<"vec4">,
    options: RenderPipelineLayerOptions = {},
  ) => {
    const key = Symbol("render-pipeline-layer");
    layersRef.current.set(key, {
      node,
      order: options.order ?? 0,
      sequence: nextSequenceRef.current++,
    });
    rebuildOutput();
    return () => {
      layersRef.current.delete(key);
      rebuildOutput();
    };
  }, [rebuildOutput]);

  const value = useMemo<RenderPipelineContextValue>(() => ({
    camera,
    registerLayer,
    renderer,
  }), [camera, registerLayer, renderer]);

  useEffect(() => {
    const applicationScene = scenePass(scene, camera);
    const pipeline = new RenderPipeline(renderer, applicationScene);
    resourcesRef.current = { pipeline, scene: applicationScene };
    rebuildOutput();
    return () => {
      resourcesRef.current = null;
      pipeline.dispose();
      applicationScene.dispose();
    };
  }, [camera, rebuildOutput, renderer, scene]);

  useFrame(() => {
    resourcesRef.current?.pipeline.render();
  }, 1);

  return (
    <RenderPipelineContext.Provider value={value}>
      {children}
    </RenderPipelineContext.Provider>
  );
}

export function useRenderPipeline(): RenderPipelineContextValue {
  const value = useContext(RenderPipelineContext);
  if (value === null) {
    throw new Error("useRenderPipeline must be used inside RenderPipelineCanvas");
  }
  return value;
}
