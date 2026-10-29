import {
  type GaussianCloud,
  type GaussianPass,
  GaussianStore,
  WorkerWasmGaussianBackend,
  gaussianPass,
  rasterScreenUV,
} from "3dgs-tile-webgpu";
import { WorkerSparkGaussianBackend } from "3dgs-tile-webgpu/spark";
import { PerspectiveCamera } from "three/webgpu";

import type { GaussianDprMode } from "@camera-path/scene-runtime/surface/model/gaussian-dpr-mode";
import type { SceneRenderPipeline } from "@camera-path/render-pipeline";

import { createTileRasterDepthNodes } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-tile-raster-depth-nodes";
import { downloadGaussianCloud } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/download-gaussian-cloud";
import { getGaussianResolutionScale } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/get-gaussian-resolution-scale";
import { installWebGpuDrawDiagnostics } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/install-webgpu-draw-diagnostics";
import { LoggingGaussianBackend } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/logging-gaussian-backend";
import { TileGaussianCloudInstance } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-cloud-instance";
import { TileGaussianHighlightVolume } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-highlight-volume";
import { TileGaussianLidar } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-lidar";
import { TileLidarFrameNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-lidar-frame-node";
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
  private readonly lidars = new Set<TileGaussianLidar>();
  private unregisterLidarFrame: (() => void) | null = null;
  private readonly loads = new Set<AbortController>();
  private readonly clouds = new Set<TileGaussianCloudInstance>();
  private depthEnabled = false;
  private disposed = false;
  private highlightVolume: TileGaussianHighlightVolume | null = null;
  private pass: GaussianPass | null = null;
  private readonly debugEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("gaussianBackendDebug");
  private readonly upstreamSpark =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("gaussianBackend") ===
      "spark";
  private readonly backend = this.upstreamSpark
    ? new WorkerSparkGaussianBackend({})
    : this.debugEnabled
      ? new WorkerWasmGaussianBackend({})
      : undefined;
  private readonly store = this.backend
    ? new GaussianStore(
        this.debugEnabled
          ? new LoggingGaussianBackend(this.backend)
          : this.backend,
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
        fraction: 0.9,
        loadedBytes: buffer.byteLength,
        totalBytes: buffer.byteLength,
        phase: "processing",
      });
      cloud = await this.store.loadBuffer(
        buffer,
        {
          name:
            options.name ??
            (source.kind === "buffer" ? source.name : undefined),
          fileName: source.kind === "url" ? source.url : source.name,
          format: source.kind === "url" ? source.format : undefined,
          worldMatrix: options.worldMatrix,
          mipmaps: { type: "standard", snapshot: { maxLeaves: 25000 } },
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
          if (this.clouds.size === 0 && this.loads.size === 0)
            this.disposePass();
        },
      );
      this.clouds.add(instance);
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

  createLidar(settings: GaussianLidarSettings): GaussianLidarInstance {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");
    const sensor = new TileGaussianLidar(
      this.pipeline.renderer,
      this.store,
      settings,
      () => {
        this.lidars.delete(sensor);
        this.syncLidarFrame();
      },
    );
    this.lidars.add(sensor);
    this.syncLidarFrame();
    return sensor;
  }

  private syncLidarFrame(): void {
    this.unregisterLidarFrame?.();
    this.unregisterLidarFrame = null;
    if (this.pass !== null && this.lidars.size > 0 && !this.disposed) {
      this.unregisterLidarFrame = this.pipeline.registerLayer(
        new TileLidarFrameNode(this.pass, this.lidars),
        { order: -99 },
      );
    }
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
    this.unregisterLidarFrame?.();
    this.unregisterLidarFrame = null;
    for (const sensor of this.lidars) sensor.hide();
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
      depthAlphaThreshold: 0.95,
      outputDepth: this.depthEnabled,
      redrawStrategy: "auto",
    });
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
      order: -100,
    });
    this.syncLidarFrame();
    this.highlightVolume?.replacePass(pass);
    unregisterPreviousPass?.();
    previousPass?.dispose();
  }
}
