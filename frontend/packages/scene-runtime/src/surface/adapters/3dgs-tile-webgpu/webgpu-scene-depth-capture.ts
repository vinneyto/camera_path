import { settleDepthReadbacks } from "../../depth/settle-depth-readbacks";
import { RENDER_PIPELINE_SCENE_LAYER } from "@camera-path/render-pipeline";
import { gaussianPass, GaussianStore } from "3dgs-tile-webgpu";
import {
  Color,
  FloatType,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RGFormat,
  RenderTarget,
  PerspectiveCamera,
  QuadMesh,
  Vector4,
  Scene,
  type Matrix4,
  type WebGPURenderer,
} from "three/webgpu";
import { createDepthCameras } from "../../depth/create-depth-cameras";
import {
  DEPTH_FAR,
  DEPTH_NEAR,
  DEPTH_OPAQUE_TRANSMITTANCE_THRESHOLD,
} from "../../depth/constants";
import { SceneDepthMaterials } from "../../depth/scene-depth-materials";
import type { SceneDepthCapture } from "../../depth/scene-depth-capture";
import { createWebGpuDepthMaterial } from "./create-webgpu-depth-material";
import { configureTileDepthPass } from "./configure-tile-depth-pass";
import { createTileDepthMergeMaterial } from "./create-tile-depth-merge-material";
import type { TileDepthSources } from "./tile-depth-source";
import type { GaussianCloud } from "3dgs-tile-webgpu";

export class WebGpuSceneDepthCapture implements SceneDepthCapture {
  // A camera-independent full source store: never reuse the editor's visible LOD cut.
  private readonly store = new GaussianStore();
  private readonly sourceScene = new Scene();
  private readonly copies = new Map<GaussianCloud, GaussianCloud>();
  private readonly camera = new PerspectiveCamera(90, 1, DEPTH_NEAR, DEPTH_FAR);
  private readonly pass;
  private readonly materials = new SceneDepthMaterials(
    createWebGpuDepthMaterial,
  );
  private readonly target;
  private readonly faces;
  private readonly merge;
  private readonly quad;
  private disposed = false;
  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly size: number,
    private readonly sources: TileDepthSources,
  ) {
    this.pass = gaussianPass(renderer, this.camera, this.store, {
      fixedSize: { width: size, height: size },
      depthRange: [DEPTH_NEAR, DEPTH_FAR],
      outputDepth: true,
      invalidDepthValue: 0,
      rasterTransmittanceThreshold: DEPTH_OPAQUE_TRANSMITTANCE_THRESHOLD,
      depthAlphaThreshold: 0,
      depthSortMode: "float32",
      filterVariance: 0,
      antialiasMode: "classic",
      background: [0, 0, 0, 0],
      redrawStrategy: "always",
    });
    configureTileDepthPass(this.pass);
    this.target = new RenderTarget(size, size, {
      type: FloatType,
      format: RedFormat,
      colorSpace: NoColorSpace,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });
    this.faces = Array.from({ length: 6 }, () => {
      const face = this.target.clone();
      face.texture.format = RGFormat;
      return face;
    });
    this.merge = createTileDepthMergeMaterial(this.pass, this.target.texture);
    this.quad = new QuadMesh(this.merge.material);
  }
  async render(scene: Scene, matrix: Matrix4) {
    if (this.disposed) return null;
    // Establish device capabilities before asking the worker to pack full sources.
    this.pass.render();
    for (const [source, copy] of this.copies)
      if (!this.sources.has(source)) {
        copy.dispose();
        this.copies.delete(source);
      }
    await Promise.all(
      [...this.sources].map(async ([source, record]) => {
        if (this.copies.has(source)) return;
        const copy = await this.store.loadBuffer(record.buffer.slice(0), {
          ...record.options,
          mipmaps: { type: "none" },
        });
        if (this.disposed || !this.sources.has(source)) {
          copy.dispose();
          return;
        }
        this.copies.set(source, copy);
        this.sourceScene.add(copy);
        await this.store.whenRenderReady(copy);
      }),
    );
    if (this.disposed) return null;
    scene.updateMatrixWorld(true);
    for (const [source, copy] of this.copies) {
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(source.matrixWorld);
      copy.updateMatrixWorld(true);
      let visible = source.layers.isEnabled(RENDER_PIPELINE_SCENE_LAYER);
      let root: typeof source.parent = source;
      for (let node: typeof source.parent = source; node; node = node.parent) {
        visible = visible && node.visible;
        root = node;
      }
      copy.visible = visible && root === scene;
    }
    for (const copy of this.copies.values()) {
      if (copy.gaussianCount < this.store.getSourceCount(copy)) {
        throw new Error(
          "LiDAR full-scene source exceeds the device's Gaussian budget",
        );
      }
    }
    this.merge.hasSplats.value = this.store.count > 0 ? 1 : 0;
    // Each merged face is encoded on the GPU before the shared pass advances.
    this.draw(() => {
      for (const [face, camera] of createDepthCameras(matrix).entries()) {
        this.camera.copy(camera);
        this.camera.updateMatrixWorld(true);
        this.renderer.setRenderTarget(this.target);
        this.materials.draw(scene, () =>
          this.renderer.render(scene, this.camera),
        );
        this.pass.render();
        this.renderer.setRenderTarget(this.faces[face]);
        this.quad.render(this.renderer);
      }
    });
    const status = this.pass.getOutputStatus();
    if (status.error) throw new Error(status.error);
    return {
      faces: this.faces.map((target) => target.texture),
      size: this.size,
      origin: "top-left" as const,
      readyInGreen: true,
    };
  }
  async capture(scene: Scene, matrix: Matrix4) {
    if (!(await this.render(scene, matrix))) return null;
    const faces = await settleDepthReadbacks(
      this.faces.map(
        async (target) =>
          (await this.renderer.readRenderTargetPixelsAsync(
            target,
            0,
            0,
            this.size,
            this.size,
          )) as Float32Array,
      ),
    );
    if (faces.some((face) => face[1] !== 1)) return null;
    return {
      faces: faces.map((face) =>
        Float32Array.from(
          { length: this.size * this.size },
          (_, i) => face[i * 2],
        ),
      ),
      size: this.size,
    };
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
    const autoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
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
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pass.dispose();
    this.store.dispose();
    this.target.dispose();
    this.merge.material.dispose();
    for (const target of this.faces) target.dispose();
    this.materials.dispose();
  }
}
