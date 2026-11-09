import { settleDepthReadbacks } from "../../depth/settle-depth-readbacks";
import { RENDER_PIPELINE_SCENE_LAYER } from "@camera-path/render-pipeline";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import {
  Color,
  FloatType,
  NoBlending,
  NoColorSpace,
  NearestFilter,
  RedFormat,
  Scene,
  Vector4,
  WebGLRenderTarget,
  type Matrix4,
  type WebGLRenderer,
} from "three";
import { DEPTH_CLIP_XY, DEPTH_SPLAT_SIGMA } from "../../depth/constants";
import { createDepthCameras } from "../../depth/create-depth-cameras";
import { SceneDepthMaterials } from "../../depth/scene-depth-materials";
import type { SceneDepthCapture } from "../../depth/scene-depth-capture";
import { borrowSparkSource } from "./borrow-spark-source";
import { createSparkDepthFilter } from "./create-spark-depth-filter";
import { createWebGlDepthMaterial } from "./create-webgl-depth-material";
import { SPARK_DEPTH_FRAGMENT } from "./spark-depth-fragment";

export class SparkSceneDepthCapture implements SceneDepthCapture {
  private readonly scene = new Scene();
  private readonly spark;
  private readonly targets;
  private readonly materials = new SceneDepthMaterials(
    createWebGlDepthMaterial,
  );
  private readonly proxies = new Map<SplatMesh, SplatMesh>();
  private disposed = false;
  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly size: number,
  ) {
    if (!renderer.extensions.has("EXT_color_buffer_float"))
      throw new Error("LiDAR needs WebGL2 EXT_color_buffer_float support");
    this.spark = new SparkRenderer({
      renderer,
      autoUpdate: false,
      enableLod: false,
      accumExtSplats: true,
      covSplats: true,
      fragmentShader: SPARK_DEPTH_FRAGMENT,
      falloff: 0,
      clipXY: DEPTH_CLIP_XY,
      blurAmount: 0,
      preBlurAmount: 0,
      maxStdDev: DEPTH_SPLAT_SIGMA,
      transparent: true,
      depthTest: true,
      // Opaque footprints write hardware depth: the closest face view-Z wins,
      // independent of Spark's radial sort order across the six views.
      depthWrite: true,
      premultipliedAlpha: false,
    });
    this.spark.material.blending = NoBlending;
    this.spark.material.toneMapped = false;
    this.scene.add(this.spark);
    this.targets = Array.from(
      { length: 6 },
      () =>
        new WebGLRenderTarget(size, size, {
          type: FloatType,
          format: RedFormat,
          internalFormat: "R32F",
          colorSpace: NoColorSpace,
          minFilter: NearestFilter,
          magFilter: NearestFilter,
          generateMipmaps: false,
          depthBuffer: true,
        }),
    );
  }
  async capture(scene: Scene, matrix: Matrix4) {
    if (this.disposed) return null;
    scene.updateMatrixWorld(true);
    const sources = new Set<SplatMesh>();
    scene.traverseVisible((object) => {
      if (
        !(object instanceof SplatMesh) ||
        !object.splats ||
        !object.layers.isEnabled(RENDER_PIPELINE_SCENE_LAYER)
      )
        return;
      sources.add(object);
      let proxy = this.proxies.get(object);
      if (
        !proxy ||
        proxy.splats?.getNumSplats() !== object.splats.getNumSplats()
      ) {
        proxy?.removeFromParent();
        proxy?.dispose();
        proxy = new SplatMesh({
          splats: borrowSparkSource(object.splats),
          enableLod: false,
          objectModifiers: [createSparkDepthFilter()],
        });
        // The borrowed source already contains float ExtSplats. The proxy owns
        // only its generator, so enable covariance without taking source ownership.
        proxy.covSplats = true;
        proxy.updateGenerator();
        proxy.matrixAutoUpdate = false;
        this.proxies.set(object, proxy);
        this.scene.add(proxy);
      }
      proxy.matrix.copy(object.matrixWorld);
      proxy.opacity = object.opacity;
      proxy.updateMatrixWorld(true);
    });
    for (const [source, proxy] of this.proxies)
      if (!sources.has(source)) {
        proxy.removeFromParent();
        proxy.dispose();
        this.proxies.delete(source);
      }
    const cameras = createDepthCameras(matrix);
    // Draw original mesh geometry before awaiting sorting; both snapshots use
    // the same scene pose. Only this synchronous section changes materials.
    this.draw(() => {
      this.materials.draw(scene, () =>
        cameras.forEach((camera, face) => {
          this.renderer.setRenderTarget(this.targets[face]);
          this.renderer.clear();
          this.renderer.render(scene, camera);
        }),
      );
    });
    // Dedicated proxies and compositor never change the editor's generators,
    // material, visibility or LOD. One radial sort covers all six directions.
    await Promise.all(
      [...this.proxies.values()].map((proxy) => proxy.initialized),
    );
    await this.spark.update({ scene: this.scene, camera: cameras[0] });
    if (this.disposed) return null;
    this.draw(() =>
      cameras.forEach((camera, face) => {
        this.renderer.setRenderTarget(this.targets[face]);
        this.spark.render(this.scene, camera);
      }),
    );
    const faces = await settleDepthReadbacks(
      this.targets.map(async (target) => {
        const pixels = new Float32Array(this.size * this.size);
        await this.renderer.readRenderTargetPixelsAsync(
          target,
          0,
          0,
          this.size,
          this.size,
          pixels,
        );
        const topDown = new Float32Array(pixels.length);
        for (let y = 0; y < this.size; y++)
          topDown.set(
            pixels.subarray(y * this.size, (y + 1) * this.size),
            (this.size - y - 1) * this.size,
          );
        return topDown;
      }),
    );
    return { faces, size: this.size };
  }
  private draw(draw: () => void) {
    const renderer = this.renderer;
    const target = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const color = renderer.getClearColor(new Color()),
      alpha = renderer.getClearAlpha();
    const viewport = renderer.getViewport(new Vector4()),
      scissor = renderer.getScissor(new Vector4()),
      scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear,
      xr = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = false;
      renderer.setClearColor(0, 0);
      renderer.setScissorTest(false);
      draw();
    } finally {
      renderer.setRenderTarget(target, face, mip);
      renderer.setClearColor(color, alpha);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.autoClear = autoClear;
      renderer.xr.enabled = xr;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const proxy of this.proxies.values()) proxy.dispose();
    this.proxies.clear();
    this.spark.dispose();
    this.materials.dispose();
    for (const target of this.targets) target.dispose();
  }
}
