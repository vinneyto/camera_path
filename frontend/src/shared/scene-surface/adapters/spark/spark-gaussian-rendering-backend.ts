import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { Color, WebGLRenderer } from "three";

import type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianHighlightVolumeInstance,
  GaussianRenderingBackend,
} from "../../model/gaussian-rendering-backend";
import type {
  GaussianCloudSource,
  SceneSurfaceBackground,
} from "../../model/scene-surface-types";
import { SparkGaussianCloudInstance } from "./spark-gaussian-cloud-instance";

export interface SparkGaussianRenderingBackendOptions {
  renderer: WebGLRenderer;
}

export class SparkGaussianRenderingBackend implements GaussianRenderingBackend {
  readonly container: SparkRenderer;
  private readonly clouds = new Set<SparkGaussianCloudInstance>();
  private disposed = false;
  private readonly previousAlpha: number;
  private readonly previousColor: Color;
  private readonly renderer: WebGLRenderer;

  constructor({ renderer }: SparkGaussianRenderingBackendOptions) {
    this.renderer = renderer;
    this.previousColor = renderer.getClearColor(new Color()).clone();
    this.previousAlpha = renderer.getClearAlpha();
    this.container = new SparkRenderer({ renderer });
  }

  setBackground(background: SceneSurfaceBackground): void {
    if (this.disposed) throw new Error("SparkGaussianRenderingBackend is disposed");
    this.renderer.setClearColor(
      new Color().setRGB(background[0], background[1], background[2]),
      background[3],
    );
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed) throw new Error("SparkGaussianRenderingBackend is disposed");
    const mesh = new SplatMesh({
      ...(source.kind === "url"
        ? { url: source.url }
        : { fileBytes: source.buffer, fileName: source.name }),
      raycastable: options.raycastable ?? true,
    });
    mesh.name = options.name
      ?? (source.kind === "buffer" ? source.name : undefined)
      ?? "Scene surface";

    try {
      await mesh.initialized;
    } catch (reason) {
      mesh.dispose();
      throw reason;
    }
    if (this.disposed) {
      mesh.dispose();
      throw new Error("SparkGaussianRenderingBackend was disposed while loading a cloud");
    }

    const instance = new SparkGaussianCloudInstance(mesh, () => this.clouds.delete(instance));
    this.clouds.add(instance);
    return instance;
  }

  createHighlightVolume(): GaussianHighlightVolumeInstance {
    throw new Error("Gaussian highlight volumes are not implemented by the Spark example backend");
  }

  invalidate(): void {}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cloud of [...this.clouds]) cloud.dispose();
    this.container.dispose();
    this.renderer.setClearColor(this.previousColor, this.previousAlpha);
  }
}
