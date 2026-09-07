"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Layers } from "three";
import {
  PerspectiveCamera,
  RenderPipeline,
  WebGPURenderer,
  type Node,
} from "three/webgpu";
import { pass as scenePass } from "three/tsl";

import { compositeDepthTestedPremultipliedOver } from "./composite-depth-tested-premultiplied-over";
import { compositePremultipliedOver } from "./composite-premultiplied-over";
import { createPerspectiveViewDepthNode } from "./create-perspective-view-depth-node";
import {
  RENDER_PIPELINE_OVERLAY_LAYER,
  RENDER_PIPELINE_SCENE_LAYER,
} from "./render-pipeline-scene-layers";
import type {
  RenderPipelineContextValue,
  RenderPipelineLayer,
  RenderPipelineLayerOptions,
} from "./render-pipeline-types";

interface PipelineResources {
  opaque: ReturnType<typeof scenePass>;
  overlay: ReturnType<typeof scenePass>;
  pipeline: RenderPipeline;
  transparent: ReturnType<typeof scenePass>;
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
    let output: Node<"vec4"> = resources.opaque;
    for (const layer of layers) {
      output = compositePremultipliedOver(output, layer.node);
    }
    const withTransparentScene = compositeDepthTestedPremultipliedOver(
      output,
      resources.transparent,
      resources.opaque.getViewZNode(),
      resources.transparent.getViewZNode(),
    );
    resources.pipeline.outputNode = compositePremultipliedOver(
      withTransparentScene,
      resources.overlay,
    );
    resources.pipeline.needsUpdate = true;
  }, []);

  const getOpaqueViewDepth = useCallback((screenUv: Node): Node<"float"> => {
    const resources = resourcesRef.current;
    if (resources === null) {
      throw new Error("Render pipeline depth is unavailable before pipeline initialization");
    }
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("Render pipeline depth requires a PerspectiveCamera");
    }
    const perspectiveDepth = resources.opaque.getTextureNode("depth").sample(screenUv);
    return createPerspectiveViewDepthNode(perspectiveDepth, camera);
  }, [camera]);

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
    getOpaqueViewDepth,
    registerLayer,
    renderer,
  }), [camera, getOpaqueViewDepth, registerLayer, renderer]);

  useLayoutEffect(() => {
    const sceneLayers = new Layers();
    sceneLayers.set(RENDER_PIPELINE_SCENE_LAYER);
    const overlayLayers = new Layers();
    overlayLayers.set(RENDER_PIPELINE_OVERLAY_LAYER);

    const opaque = scenePass(scene, camera);
    opaque.opaque = true;
    opaque.transparent = false;
    opaque.setLayers(sceneLayers);

    const transparent = scenePass(scene, camera);
    transparent.opaque = false;
    transparent.transparent = true;
    transparent.setLayers(sceneLayers);

    const overlay = scenePass(scene, camera);
    overlay.opaque = false;
    overlay.transparent = true;
    overlay.setLayers(overlayLayers);

    const pipeline = new RenderPipeline(renderer, opaque);
    resourcesRef.current = { opaque, overlay, pipeline, transparent };
    rebuildOutput();
    return () => {
      resourcesRef.current = null;
      pipeline.dispose();
      opaque.dispose();
      transparent.dispose();
      overlay.dispose();
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
  const value = useOptionalRenderPipeline();
  if (value === null) {
    throw new Error("useRenderPipeline must be used inside RenderPipelineCanvas");
  }
  return value;
}

export function useOptionalRenderPipeline(): RenderPipelineContextValue | null {
  return useContext(RenderPipelineContext);
}
