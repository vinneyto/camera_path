"use client";

import { Canvas, type CanvasProps, useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  RenderPipeline,
  WebGPURenderer,
  type Camera,
  type Node,
} from "three/webgpu";
import { pass as scenePass, vec4 } from "three/tsl";

type FunctionParameter<T> = T extends (props: infer P) => unknown ? P : never;
type CanvasGlProps = FunctionParameter<NonNullable<CanvasProps["gl"]>>;

export interface RenderPipelineLayerOptions {
  /** Layers with lower order values are composited first. */
  order?: number;
}

export interface RenderPipelineContextValue {
  camera: Camera;
  registerLayer: (
    node: Node<"vec4">,
    options?: RenderPipelineLayerOptions,
  ) => () => void;
  renderer: WebGPURenderer;
}

interface RenderPipelineLayer {
  node: Node<"vec4">;
  order: number;
  sequence: number;
}

interface PipelineResources {
  pipeline: RenderPipeline;
  scene: ReturnType<typeof scenePass>;
}

const RenderPipelineContext = createContext<RenderPipelineContextValue | null>(null);

/** A WebGPU R3F Canvas whose frame output is owned by Three.js RenderPipeline. */
export function RenderPipelineCanvas({ children, ...props }: Omit<CanvasProps, "gl">) {
  return (
    <Canvas {...props} gl={createWebGpuRenderer}>
      <RenderPipelineProvider>{children}</RenderPipelineProvider>
    </Canvas>
  );
}

/** Owns the application pipeline, the regular scene pass, and R3F render-loop takeover. */
function RenderPipelineProvider({ children }: PropsWithChildren) {
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

  // A positive priority disables R3F's renderer.render(scene, camera) call.
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

async function createWebGpuRenderer({ canvas }: CanvasGlProps) {
  const renderer = new WebGPURenderer({
    antialias: false,
    canvas: canvas as HTMLCanvasElement,
  });
  await renderer.init();
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function compositePremultipliedOver(
  base: Node<"vec4">,
  overlay: Node<"vec4">,
): Node<"vec4"> {
  const baseColor = vec4(base);
  const overlayColor = vec4(overlay);
  const inverseOverlayAlpha = overlayColor.a.oneMinus();
  return vec4(
    overlayColor.rgb.add(baseColor.rgb.mul(inverseOverlayAlpha)),
    overlayColor.a.add(baseColor.a.mul(inverseOverlayAlpha)),
  );
}
