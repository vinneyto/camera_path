import {
  CanonicalGaussianPlyLoader,
  type GaussianCloud,
  GaussianLod,
  GaussianOctree,
  type GaussianPass,
  GaussianStore,
  gaussianPass,
  rasterScreenUV,
} from "3dgs-tile-webgpu";
import { PerspectiveCamera } from "three/webgpu";

import type { SceneRenderPipeline } from "@/shared/three";
import type { GaussianDprMode } from "../../model/gaussian-dpr-mode";

import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianHighlightVolumeInstance,
  GaussianHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "../../model/gaussian-rendering-backend";
import type { GaussianCloudSource } from "../../model/scene-surface-types";
import { createTileRasterDepthNodes } from "./create-tile-raster-depth-nodes";
import { getGaussianResolutionScale } from "./get-gaussian-resolution-scale";
import { TileGaussianCloudInstance } from "./tile-gaussian-cloud-instance";
import { TileGaussianHighlightVolume } from "./tile-gaussian-highlight-volume";

export class TileGaussianRenderingBackend implements GaussianRenderingBackend {
  readonly container = null;
  private readonly clouds = new Set<TileGaussianCloudInstance>();
  private disposed = false;
  private highlightVolume: TileGaussianHighlightVolume | null = null;
  private pass: GaussianPass | null = null;
  private readonly store = new GaussianStore();
  private unregisterPass: (() => void) | null = null;
  private dprMode: GaussianDprMode = "1x";

  constructor(private readonly pipeline: SceneRenderPipeline) {
    if (!(pipeline.camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed)
      throw new Error("TileGaussianRenderingBackend is disposed");

    let cloud: GaussianCloud;
    if (source.kind === "url") {
      cloud = await this.store.load(source.url, { name: options.name });
    } else {
      const data = new CanonicalGaussianPlyLoader().parse(source.buffer);
      const octree = GaussianOctree.build(data, { ownsData: true });
      const lod = GaussianLod.build(octree, { ownsOctree: true });
      cloud = this.store.addLod(lod, {
        name: options.name ?? source.name,
        ownsLod: true,
      });
    }

    if (this.disposed) {
      cloud.dispose();
      throw new Error(
        "TileGaussianRenderingBackend was disposed while loading a cloud",
      );
    }

    cloud.raycastMode = "full";
    try {
      this.ensurePass();
    } catch (reason) {
      cloud.dispose();
      throw reason;
    }
    const instance = new TileGaussianCloudInstance(
      cloud,
      options.raycastable ?? true,
      () => {
        this.clouds.delete(instance);
        if (this.clouds.size === 0) this.disposePass();
      },
    );
    this.clouds.add(instance);
    return instance;
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

  invalidate(): void {
    if (!this.disposed) this.pass?.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
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
    const { camera, getOpaqueViewDepth, registerLayer, renderer } =
      this.pipeline;
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
    const pass = gaussianPass(renderer, camera, this.store, {
      background: [0, 0, 0, 0],
      redrawStrategy: "auto",
    });
    const depthNodes = createTileRasterDepthNodes(
      getOpaqueViewDepth(rasterScreenUV),
      pass.depthSortMode,
    );
    pass.rasterPixelValueNode = depthNodes.rasterPixelValueNode;
    pass.rasterBreakNode = depthNodes.rasterBreakNode;
    pass.rasterDiscardNode = depthNodes.rasterDiscardNode;
    this.pass = pass;
    this.syncResolutionScale(this.dprMode);
    this.unregisterPass = registerLayer(pass, { order: -100 });
  }
}
