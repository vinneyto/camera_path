import {
  CanonicalGaussianPlyLoader,
  type GaussianCloud,
  GaussianLod,
  GaussianOctree,
  type GaussianPass,
  GaussianStore,
  gaussianPass,
  rasterPixelCoordinate,
} from "3dgs-tile-webgpu";
import { PerspectiveCamera } from "three/webgpu";

import type { SceneRenderPipeline } from "@/shared/three";

import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianRenderingBackend,
} from "../../model/gaussian-rendering-backend";
import type { GaussianCloudSource } from "../../model/scene-surface-types";
import { createTileRasterDepthNodes } from "./create-tile-raster-depth-nodes";
import { TileGaussianCloudInstance } from "./tile-gaussian-cloud-instance";

export class TileGaussianRenderingBackend implements GaussianRenderingBackend {
  readonly container = null;
  private readonly clouds = new Set<TileGaussianCloudInstance>();
  private disposed = false;
  private pass: GaussianPass | null = null;
  private readonly store = new GaussianStore();
  private unregisterPass: (() => void) | null = null;

  constructor(private readonly pipeline: SceneRenderPipeline) {
    if (!(pipeline.camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed) throw new Error("TileGaussianRenderingBackend is disposed");

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
      throw new Error("TileGaussianRenderingBackend was disposed while loading a cloud");
    }

    cloud.raycastMode = options.raycastable === false ? "rendered" : "full";
    try {
      this.ensurePass();
    } catch (reason) {
      cloud.dispose();
      throw reason;
    }
    const instance = new TileGaussianCloudInstance(cloud, () => {
      this.clouds.delete(instance);
      if (this.clouds.size === 0) this.disposePass();
    });
    this.clouds.add(instance);
    return instance;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cloud of [...this.clouds]) cloud.dispose();
    this.disposePass();
    this.store.dispose();
  }

  private disposePass(): void {
    this.unregisterPass?.();
    this.unregisterPass = null;
    this.pass?.dispose();
    this.pass = null;
  }

  private ensurePass(): void {
    if (this.pass !== null) return;
    const { camera, getOpaqueViewDepth, registerLayer, renderer } = this.pipeline;
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }
    const pass = gaussianPass(renderer, camera, this.store, { background: [0, 0, 0, 0] });
    const depthNodes = createTileRasterDepthNodes(
      getOpaqueViewDepth(rasterPixelCoordinate),
      pass.depthSortMode,
    );
    pass.rasterPixelValueNode = depthNodes.rasterPixelValueNode;
    pass.rasterBreakNode = depthNodes.rasterBreakNode;
    pass.rasterDiscardNode = depthNodes.rasterDiscardNode;
    this.pass = pass;
    this.unregisterPass = registerLayer(pass, { order: -100 });
  }
}
