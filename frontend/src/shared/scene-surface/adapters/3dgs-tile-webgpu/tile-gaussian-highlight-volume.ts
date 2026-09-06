import {
  gaussianPositionWorld,
  type GaussianPass,
} from "3dgs-tile-webgpu";
import { smoothstep, uniform, vec3 } from "three/tsl";
import { Vector3, type Node } from "three/webgpu";

import type {
  GaussianHighlightVolume,
  GaussianHighlightVolumeOptions,
} from "../../model/gaussian-rendering-backend";

export class TileGaussianHighlightVolume implements GaussianHighlightVolume {
  private readonly bottom = uniform(0);
  private readonly color = uniform(new Vector3());
  private disposed = false;
  private readonly height = uniform(0);
  private readonly node: Node;
  private readonly position = uniform(new Vector3());
  private readonly radius = uniform(0);
  private readonly strength = uniform(0);

  constructor(
    private readonly pass: GaussianPass,
    private readonly baseColorNode: Node<"vec3">,
    options: GaussianHighlightVolumeOptions,
    private readonly onDispose: () => void,
  ) {
    const delta = gaussianPositionWorld.xz.sub(this.position.xz);
    const normalizedRadius = delta.dot(delta).sqrt().div(this.radius);
    const insideRadius = normalizedRadius.lessThanEqual(1);
    const insideHeight = gaussianPositionWorld.y.greaterThanEqual(this.bottom)
      .and(gaussianPositionWorld.y.lessThanEqual(this.bottom.add(this.height)));
    const baseColor = vec3(this.baseColorNode);
    const spot = smoothstep(0, 1, normalizedRadius).oneMinus();
    const core = smoothstep(0, 0.28, normalizedRadius).oneMinus();
    const ring = smoothstep(0, 0.055, normalizedRadius.sub(0.82).abs()).oneMinus();
    const lightGain = vec3(1).add(this.color.mul(this.strength).mul(spot));
    const coreGlow = this.color.mul(this.strength).mul(core).mul(0.08);
    const ringGlow = vec3(1, 0.32, 0.02).mul(this.strength).mul(ring).mul(0.12);
    const highlightedColor = baseColor.mul(lightGain).add(coreGlow).add(ringGlow);
    this.node = insideRadius.and(insideHeight).select(highlightedColor, baseColor);
    this.update(options);
    this.pass.gaussianColorNode = this.node;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pass.gaussianColorNode === this.node) {
      this.pass.gaussianColorNode = this.baseColorNode;
    }
    this.onDispose();
  }

  update(options: GaussianHighlightVolumeOptions): void {
    if (this.disposed) throw new Error("Gaussian highlight volume is disposed");
    this.position.value.set(...options.position);
    this.bottom.value = options.position[1] - options.bottomOffset;
    this.height.value = options.height + options.bottomOffset;
    this.radius.value = options.radius;
    this.color.value.set(...options.color);
    this.strength.value = options.strength;
  }
}
