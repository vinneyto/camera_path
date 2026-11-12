import {
  Color,
  FloatType,
  Matrix4,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  NearestFilter,
  NoBlending,
  NoColorSpace,
  QuadMesh,
  RedFormat,
  RenderTarget,
  Texture,
  Vector4,
  type WebGPURenderer,
} from "three/webgpu";
import {
  instanceIndex,
  uint,
  vec2,
  vec3,
  vec4,
  uniform,
  texture,
  textureLoad,
  positionLocal,
  screenCoordinate,
  cameraViewMatrix,
  cameraWorldMatrix,
  cameraProjectionMatrix,
  positionView,
  varying,
  max,
  Fn,
  If,
  Discard,
} from "three/tsl";
import type { GaussianLidarSettings } from "../../model/gaussian-lidar";
import type { SceneDepthGpuCube } from "../../depth/scene-depth-capture";
import type { GpuLidarView } from "../../depth/gpu-lidar-view";
import { createLidarHitMesh } from "../../depth/create-lidar-hit-mesh";
import {
  LIDAR_HIT_COLOR,
  LIDAR_HIT_OPACITY,
  LIDAR_HIT_RADIUS,
} from "../../depth/constants";
import { createLidarDirectionNode } from "./create-lidar-direction-node";
import { createLidarRangeNode } from "./create-lidar-range-node";
export class TileGpuLidarView implements GpuLidarView {
  readonly object;
  readonly ranges;
  private readonly target;
  private readonly pose = uniform(new Matrix4());
  private readonly size = uniform(1);
  private readonly hasValidity = uniform(0);
  private readonly placeholder = new Texture();
  private readonly faces = Array.from({ length: 6 }, () =>
    texture(this.placeholder),
  );
  private readonly quad;
  private readonly projectionMaterial;
  constructor(
    private readonly renderer: WebGPURenderer,
    settings: GaussianLidarSettings,
  ) {
    const width = settings.horizontalResolution,
      height = settings.verticalResolution;
    this.target = new RenderTarget(width, height, {
      type: FloatType,
      format: RedFormat,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: NoColorSpace,
    });
    this.ranges = {
      texture: this.target.texture,
      width,
      height,
      units: "meters" as const,
      format: "r32float" as const,
      invalidValue: 0,
    };
    const rangeMaterial = (this.projectionMaterial = new MeshBasicNodeMaterial({
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
      toneMapped: false,
    }));
    rangeMaterial.colorNode = createLidarRangeNode(
      createLidarDirectionNode(screenCoordinate.floor(), settings),
      this.faces,
      this.size,
      this.hasValidity,
    ).xxx;
    this.quad = new QuadMesh(rangeMaterial);
    const material = new MeshLambertNodeMaterial({
      color: LIDAR_HIT_COLOR,
      opacity: LIDAR_HIT_OPACITY,
      transparent: true,
      // The WebGPU compositor reads this pass's depth separately from opaque depth.
      // Publish the analytic sphere surface so visible hits survive that comparison.
      depthWrite: true,
    });
    const pixel = vec2(
      instanceIndex.mod(uint(width)),
      instanceIndex.div(uint(width)),
    );
    const range = textureLoad(this.target.texture, pixel).r;
    const center = this.pose.mul(
      vec4(createLidarDirectionNode(pixel, settings).mul(range), 1),
    ).xyz;
    const centerView = varying(
      cameraViewMatrix.mul(vec4(center, 1)).xyz,
      "lidarSphereCenter",
    );
    const extent = centerView.xy
      .abs()
      .div(max(centerView.z.negate(), 0.0001))
      .add(1)
      .mul(LIDAR_HIT_RADIUS)
      .mul(
        max(
          1,
          centerView.z
            .negate()
            .div(max(centerView.z.negate().sub(LIDAR_HIT_RADIUS), 0.0001)),
        ),
      );
    const cornerView = centerView.add(vec3(positionLocal.xy.mul(extent), 0));
    material.positionNode = range
      .greaterThan(0)
      .select(cameraWorldMatrix.mul(vec4(cornerView, 1)).xyz, vec3(1e10));
    const sphere = Fn(() => {
      const ray = positionView.normalize(),
        along = ray.dot(centerView),
        closest = ray.mul(along).sub(centerView);
      const discriminant = closest
        .dot(closest)
        .negate()
        .add(LIDAR_HIT_RADIUS ** 2);
      If(discriminant.lessThan(0), () => {
        Discard();
      });
      const root = max(discriminant, 0).sqrt();
      return vec4(
        closest.sub(ray.mul(root)).normalize(),
        ray.mul(along.sub(root)).z,
      );
    })().toVar("lidarSphereSurface");
    material.normalNode = sphere.xyz;
    const clip = cameraProjectionMatrix.mul(
      vec4(positionView.xy.div(positionView.z).mul(sphere.w), sphere.w, 1),
    );
    material.depthNode = clip.z.div(clip.w);
    this.object = createLidarHitMesh(material, settings);
  }
  draw(cube: SceneDepthGpuCube, pose: Matrix4) {
    if (cube.origin !== "top-left")
      throw new Error("WebGPU LiDAR requires native WebGPU depth textures");
    const renderer = this.renderer,
      target = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new Vector4()),
      scissor = renderer.getScissor(new Vector4()),
      scissorTest = renderer.getScissorTest(),
      autoClear = renderer.autoClear;
    const color = renderer.getClearColor(new Color()),
      alpha = renderer.getClearAlpha();
    try {
      renderer.autoClear = true;
      renderer.setScissorTest(false);
      this.faces.forEach((node, index) => {
        node.value = cube.faces[index];
      });
      this.size.value = cube.size;
      this.hasValidity.value = cube.readyInGreen ? 1 : 0;
      renderer.setRenderTarget(this.target);
      this.quad.render(renderer);
      this.pose.value.copy(pose);
    } finally {
      renderer.setRenderTarget(target, face, mip);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setClearColor(color, alpha);
      renderer.autoClear = autoClear;
    }
    // A queue fence provides backpressure without mapping depth/position buffers.
    const device = (
      renderer.backend as unknown as {
        device?: { queue: { onSubmittedWorkDone(): Promise<void> } };
      }
    ).device;
    if (!device) throw new Error("LiDAR requires an initialized WebGPU device");
    return device.queue.onSubmittedWorkDone();
  }
  /** Explicit diagnostics/export only; the live scheduler never invokes readback. */
  async readRanges(): Promise<Float32Array> {
    return (await this.renderer.readRenderTargetPixelsAsync(
      this.target,
      0,
      0,
      this.ranges.width,
      this.ranges.height,
    )) as Float32Array;
  }
  dispose() {
    this.target.dispose();
    this.projectionMaterial.dispose();
    this.placeholder.dispose();
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
