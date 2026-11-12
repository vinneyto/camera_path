import { SparkGpuLidarView } from "./spark-gpu-lidar-view";
import type { GaussianLidarSettings } from "../../model/gaussian-lidar";
import { SceneDepthLidar } from "../../depth/scene-depth-lidar";
import { getLidarFaceSize } from "../../depth/get-lidar-face-size";
import { SparkSceneDepthCapture } from "./spark-scene-depth-capture";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { Color, SRGBColorSpace, WebGLRenderer } from "three";
import { SPARK_RENDER_ORDER } from "./constants";

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
  private readonly lidars = new Set<SceneDepthLidar>();
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
      // Covariance transforms preserve nonuniform scale and hierarchy-induced shear.
      accumExtSplats: true,
      covSplats: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    // Stay after the grid (-3/-2), before ordinary transparent helpers (0+).
    // Keep opaque geometry in Three's normal depth-writing queue before splats.
    this.container.renderOrder = SPARK_RENDER_ORDER;
    // Spark's shader-driven quad is a compositor, not scene geometry. Picking
    // belongs to its SplatMesh children, not Mesh.raycast's dummy quad.
    this.container.raycast = () => undefined;
  }

  setBackground(background: SceneSurfaceBackground): void {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    const [red, green, blue, alpha] = background;
    this.renderer.setClearColor(
      new Color().setRGB(red, green, blue, SRGBColorSpace),
      alpha,
    );
  }

  async createCloud(
    source: GaussianCloudSource,
    options: GaussianCloudOptions = {},
  ): Promise<GaussianCloudInstance> {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    const mesh = new SplatMesh({
      extSplats: true,
      covSplats: true,
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

  createDepthCapture(faceSize: number): SparkSceneDepthCapture {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    return new SparkSceneDepthCapture(this.renderer, faceSize);
  }

  createLidar(settings: GaussianLidarSettings): SceneDepthLidar {
    if (this.disposed)
      throw new Error("SparkGaussianRenderingBackend is disposed");
    const sensor = new SceneDepthLidar(
      this.createDepthCapture(getLidarFaceSize(settings)),
      new SparkGpuLidarView(this.renderer, settings),
      () => this.lidars.delete(sensor),
    );
    this.lidars.add(sensor);
    return sensor;
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
    for (const sensor of [...this.lidars]) sensor.dispose();
    for (const cloud of [...this.clouds]) cloud.dispose();
    this.container.dispose();
    this.renderer.setClearColor(this.previousColor, this.previousAlpha);
  }
}
