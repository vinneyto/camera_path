import { SceneDepthLidar } from "../../depth/scene-depth-lidar";
import { getLidarFaceSize } from "../../depth/get-lidar-face-size";
import { WebGpuSceneDepthCapture } from "./webgpu-scene-depth-capture";
import type { TileDepthSource } from "./tile-depth-source";
import {
  type GaussianCloud,
  type GaussianPass,
  GaussianStore,
  WorkerWasmGaussianBackend,
  gaussianPass,
  rasterScreenUV,
} from "3dgs-tile-webgpu";
import { uniform } from "three/tsl";
import { GAUSSIAN_HOVER_GAIN, GAUSSIAN_SELECTED_GAIN } from "../../constants";
import {
  GAUSSIAN_DEPTH_ALPHA_THRESHOLD,
  GAUSSIAN_PROCESSING_PROGRESS,
  GAUSSIAN_RAYCAST_SNAPSHOT_MAX_LEAVES,
  GAUSSIAN_RENDER_ORDER,
} from "./constants";
import { PerspectiveCamera } from "three/webgpu";

import type { GaussianDprMode } from "@camera-path/scene-runtime/surface/model/gaussian-dpr-mode";
import type { SceneRenderPipeline } from "@camera-path/render-pipeline";

import { createTileRasterDepthNodes } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-tile-raster-depth-nodes";
import { downloadGaussianCloud } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/download-gaussian-cloud";
import { getGaussianResolutionScale } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/get-gaussian-resolution-scale";
import { installWebGpuDrawDiagnostics } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/install-webgpu-draw-diagnostics";
import { LoggingGaussianBackend } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/logging-gaussian-backend";
import { TileGaussianCloudInstance } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-cloud-instance";
import { createCloudInteractionColorNode } from "./create-cloud-interaction-color-node";
import { TileGaussianHighlightVolume } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-highlight-volume";
import { enableAdditionalObjectLayers } from "@camera-path/scene-runtime/surface/model/enable-additional-object-layers";
import type {
  GaussianLidarInstance,
  GaussianLidarSettings,
} from "@camera-path/scene-runtime/surface/model/gaussian-lidar";
import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianHighlightVolumeInstance,
  GaussianHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type { GaussianCloudSource } from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export class TileGaussianRenderingBackend implements GaussianRenderingBackend {
  readonly container = null;
  private readonly lidars = new Set<SceneDepthLidar>();
  private readonly depthSources = new Map<GaussianCloud, TileDepthSource>();
  private readonly loads = new Set<AbortController>();
  private readonly clouds = new Set<TileGaussianCloudInstance>();
  private depthEnabled = false;
  private disposed = false;
  private highlightVolume: TileGaussianHighlightVolume | null = null;
  private hoveredCloud: GaussianCloud | null = null;
  private readonly hoveredObjectId = uniform(0, "uint");
  private readonly hoverGain = uniform(1);
  private selectedCloud: GaussianCloud | null = null;
  private readonly selectedObjectId = uniform(0, "uint");
  private readonly selectedGain = uniform(1);
  private pass: GaussianPass | null = null;
  private readonly debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("gaussianBackendDebug");
  private readonly store = this.debugEnabled
    ? new GaussianStore(
        new LoggingGaussianBackend(new WorkerWasmGaussianBackend({})),
      )
    : new GaussianStore();
  private unregisterPass: (() => void) | null = null;
  private dprMode: GaussianDprMode = "1x";
  private readonly additionalCloudLayers: readonly number[];
  private readonly uninstallDrawDiagnostics: () => void;

  constructor(
    private readonly pipeline: SceneRenderPipeline,
    additionalCloudLayers: readonly number[] = [],
  ) {
    this.additionalCloudLayers = [...additionalCloudLayers];
    if (!(pipeline.camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
    this.uninstallDrawDiagnostics = this.debugEnabled
      ? installWebGpuDrawDiagnostics(pipeline.renderer)
      : () => undefined;
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");

    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    this.loads.add(controller);
    const signal = controller.signal;
    let cloud: GaussianCloud | null = null;
    try {
      signal.throwIfAborted();
      // Register the configured pass before model preparation. Explicit shader
      // warmup is temporarily disabled; readiness depends only on the model.
      this.ensurePass();
      const buffer =
        source.kind === "url"
          ? await downloadGaussianCloud(source.url, signal, options.onProgress)
          : source.buffer;
      signal.throwIfAborted();
      options.onProgress?.({
        fraction: GAUSSIAN_PROCESSING_PROGRESS,
        loadedBytes: buffer.byteLength,
        totalBytes: buffer.byteLength,
        phase: "processing",
      });
      cloud = await this.store.loadBuffer(
        buffer.slice(0),
        {
          name:
            options.name ??
            (source.kind === "buffer" ? source.name : undefined),
          fileName: source.kind === "url" ? source.url : source.name,
          format: source.kind === "url" ? source.format : undefined,
          worldMatrix: options.worldMatrix,
          mipmaps: {
            type: "standard",
            snapshot: { maxLeaves: GAUSSIAN_RAYCAST_SNAPSHOT_MAX_LEAVES },
          },
        },
        signal,
      );
      const loadedCloud = cloud;
      const abortReady = () => loadedCloud.dispose();
      signal.addEventListener("abort", abortReady, { once: true });
      try {
        signal.throwIfAborted();
        await this.store.whenRenderReady(cloud);
        signal.throwIfAborted();
      } finally {
        signal.removeEventListener("abort", abortReady);
      }
      // The initial world pose is only a loading hint; React owns the local pose.
      cloud.position.set(0, 0, 0);
      cloud.quaternion.identity();
      cloud.scale.set(1, 1, 1);
      cloud.updateWorldMatrix(false, false);
      enableAdditionalObjectLayers(cloud, this.additionalCloudLayers);
      const instance = new TileGaussianCloudInstance(
        cloud,
        this.store.getBounds(cloud),
        () => {
          this.clouds.delete(instance);
          this.depthSources.delete(loadedCloud);
          if (this.clouds.size === 0 && this.loads.size === 0)
            this.disposePass();
        },
        (hovered, selected) =>
          this.setCloudInteractionState(loadedCloud, hovered, selected),
      );
      this.clouds.add(instance);
      this.depthSources.set(cloud, {
        buffer,
        options: {
          name: cloud.name,
          fileName: source.kind === "url" ? source.url : source.name,
          format: source.kind === "url" ? source.format : undefined,
        },
      });
      options.onProgress?.({
        fraction: 1,
        loadedBytes: buffer.byteLength,
        totalBytes: buffer.byteLength,
        phase: "ready",
      });
      return instance;
    } catch (reason) {
      cloud?.dispose();
      throw reason;
    } finally {
      options.signal?.removeEventListener("abort", cancel);
      this.loads.delete(controller);
      if (this.clouds.size === 0 && this.loads.size === 0) this.disposePass();
    }
  }

  private setCloudInteractionState(
    cloud: GaussianCloud,
    hovered: boolean,
    selected: boolean,
  ): void {
    let changed = false;
    if (hovered) {
      changed = this.hoveredCloud !== cloud;
      this.hoveredCloud = cloud;
      this.hoveredObjectId.value = cloud.objectId;
      this.hoverGain.value = GAUSSIAN_HOVER_GAIN;
    } else if (this.hoveredCloud === cloud) {
      changed = true;
      this.hoveredCloud = null;
      this.hoverGain.value = 1;
    }
    if (selected) {
      changed = changed || this.selectedCloud !== cloud;
      this.selectedCloud = cloud;
      this.selectedObjectId.value = cloud.objectId;
      this.selectedGain.value = GAUSSIAN_SELECTED_GAIN;
    } else if (this.selectedCloud === cloud) {
      changed = true;
      this.selectedCloud = null;
      this.selectedGain.value = 1;
    }
    if (changed) this.pass?.invalidate();
  }

  createHighlightVolume(
    options: GaussianHighlightVolumeOptions,
  ): GaussianHighlightVolumeInstance {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");
    if (this.pass === null)
      throw new Error("A Gaussian cloud must be loaded before highlighting");
    if (this.highlightVolume !== null) {
      throw new Error(
        "TileGaussianRenderingBackend supports one highlight volume at a time",
      );
    }
    const volume = new TileGaussianHighlightVolume(this.pass, options, () => {
      if (this.highlightVolume === volume) this.highlightVolume = null;
    });
    this.highlightVolume = volume;
    return volume;
  }

  createDepthCapture(faceSize: number): WebGpuSceneDepthCapture {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");
    return new WebGpuSceneDepthCapture(
      this.pipeline.renderer,
      faceSize,
      this.depthSources,
    );
  }

  createLidar(settings: GaussianLidarSettings): GaussianLidarInstance {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");
    const sensor = new SceneDepthLidar(
      this.createDepthCapture(getLidarFaceSize(settings)),
      settings,
      () => this.lidars.delete(sensor),
    );
    this.lidars.add(sensor);
    return sensor;
  }

  invalidate(): void {
    if (!this.disposed) this.pass?.invalidate();
  }

  isDepthEnabled(): boolean {
    return this.depthEnabled;
  }

  setDepthEnabled(enabled: boolean): void {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");
    if (this.depthEnabled === enabled) return;
    this.depthEnabled = enabled;
    if (this.pass !== null) this.recreatePass();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.uninstallDrawDiagnostics();
    for (const controller of this.loads) controller.abort();
    for (const sensor of [...this.lidars]) sensor.dispose();
    this.highlightVolume?.dispose();
    for (const cloud of [...this.clouds]) cloud.dispose();
    this.disposePass();
    this.store.dispose();
  }

  syncResolutionScale(dprMode: GaussianDprMode): void {
    if (this.disposed) return;
    this.dprMode = dprMode;
    if (this.pass === null) return;
    const resolutionScale = getGaussianResolutionScale(
      dprMode,
      this.pipeline.renderer.getPixelRatio(),
    );
    if (this.pass.getResolutionScale() !== resolutionScale) {
      this.pass.setResolutionScale(resolutionScale);
    }
    this.highlightVolume?.prepareFrame();
  }

  private disposePass(): void {
    this.highlightVolume?.dispose();
    this.unregisterPass?.();
    this.unregisterPass = null;
    this.pass?.dispose();
    this.pass = null;
  }

  private ensurePass(): void {
    if (this.pass !== null) return;
    this.recreatePass();
  }

  private recreatePass(): void {
    const { camera, getOpaqueViewDepth, registerLayer, renderer } =
      this.pipeline;
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
    const pass = gaussianPass(renderer, camera, this.store, {
      background: [0, 0, 0, 0],
      depthAlphaThreshold: GAUSSIAN_DEPTH_ALPHA_THRESHOLD,
      outputDepth: this.depthEnabled,
      redrawStrategy: "auto",
    });
    // The identity predicate keeps overlapping clouds independent. Volume
    // highlights compose over this node and restore it when they are removed.
    pass.gaussianColorNode = createCloudInteractionColorNode(
      pass.gaussianColorNode,
      this.hoveredObjectId,
      this.hoverGain,
      this.selectedObjectId,
      this.selectedGain,
    );
    const depthNodes = createTileRasterDepthNodes(
      getOpaqueViewDepth(rasterScreenUV),
      pass.depthSortMode,
    );
    pass.rasterPixelValueNode = depthNodes.rasterPixelValueNode;
    pass.rasterBreakNode = depthNodes.rasterBreakNode;
    pass.rasterDiscardNode = depthNodes.rasterDiscardNode;
    const previousPass = this.pass;
    const unregisterPreviousPass = this.unregisterPass;
    this.pass = pass;
    this.syncResolutionScale(this.dprMode);
    this.unregisterPass = registerLayer(pass, {
      ...(this.depthEnabled ? { depth: pass.getTextureNode("depth").r } : {}),
      order: GAUSSIAN_RENDER_ORDER,
    });
    this.highlightVolume?.replacePass(pass);
    unregisterPreviousPass?.();
    previousPass?.dispose();
  }
}
