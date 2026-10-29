import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { Color, SRGBColorSpace, WebGLRenderer } from "three";

import { SparkGaussianCloudInstance } from "@camera-path/scene-runtime/surface/adapters/spark/spark-gaussian-cloud-instance";
import { enableAdditionalObjectLayers } from "@camera-path/scene-runtime/surface/model/enable-additional-object-layers";
import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianHighlightVolumeInstance,
  GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type {
  GaussianCloudSource,
  SceneSurfaceBackground,
} from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export interface SparkGaussianRenderingBackendOptions {
  additionalCloudLayers?: readonly number[];
  renderer: WebGLRenderer;
}

export class SparkGaussianRenderingBackend implements GaussianRenderingBackend {
  readonly container: SparkRenderer;
  private readonly clouds = new Set<SparkGaussianCloudInstance>();
  private disposed = false;
  private readonly previousAlpha: number;
  private readonly previousColor: Color;
  private readonly renderer: WebGLRenderer;
  private readonly additionalCloudLayers: readonly number[];

  constructor({
    additionalCloudLayers = [],
    renderer,
  }: SparkGaussianRenderingBackendOptions) {
    this.additionalCloudLayers = [...additionalCloudLayers];
    this.renderer = renderer;
    this.previousColor = renderer.getClearColor(new Color()).clone();
    this.previousAlpha = renderer.getClearAlpha();
    this.container = new SparkRenderer({
      renderer,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    // Stay after the grid (-3/-2), before ordinary transparent helpers (0+).
    // Keep opaque geometry in Three's normal depth-writing queue before splats.
    this.container.renderOrder = -1;
  }

  setBackground(background: SceneSurfaceBackground): void {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    this.renderer.setClearColor(
      new Color().setRGB(
        background[0],
        background[1],
        background[2],
        SRGBColorSpace,
      ),
      background[3],
    );
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    const mesh = new SplatMesh({
      ...(source.kind === "url"
        ? { url: source.url }
        : { fileBytes: source.buffer, fileName: source.name }),
      raycastable: true,
    });
    mesh.name =
      options.name ??
      (source.kind === "buffer" ? source.name : undefined) ??
      "Scene surface";
    enableAdditionalObjectLayers(mesh, this.additionalCloudLayers);

    try {
      await mesh.initialized;
    } catch (reason) {
      mesh.dispose();
      throw reason;
    }
    if (this.disposed) {
      mesh.dispose();
      throw new Error(
        "SparkGaussianRenderingBackend was disposed while loading a cloud",
      );
    }

    const instance = new SparkGaussianCloudInstance(mesh, () =>
      this.clouds.delete(instance),
    );
    this.clouds.add(instance);
    return instance;
  }

  createHighlightVolume(): GaussianHighlightVolumeInstance {
    throw new Error(
      "Gaussian highlight volumes are not implemented by the Spark example backend",
    );
  }

  invalidate(): void {}

  isDepthEnabled(): boolean {
    return false;
  }

  setDepthEnabled(enabled: boolean): void {
    if (enabled) {
      throw new Error(
        "Depth output is unavailable in the Spark example backend",
      );
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cloud of [...this.clouds]) cloud.dispose();
    this.container.dispose();
    this.renderer.setClearColor(this.previousColor, this.previousAlpha);
  }
}
