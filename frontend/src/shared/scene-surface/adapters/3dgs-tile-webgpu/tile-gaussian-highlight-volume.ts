import {
  gaussianPositionWorld,
  type GaussianPass,
} from "3dgs-tile-webgpu";
import { smoothstep, time, TWO_PI, uniform, vec3 } from "three/tsl";
import { Vector3, type Node } from "three/webgpu";

import type {
  GaussianHighlightVolumeInstance,
  GaussianHighlightVolumeOptions,
} from "../../model/gaussian-rendering-backend";

export class TileGaussianHighlightVolume implements GaussianHighlightVolumeInstance {
  private readonly amplitude = uniform(0);
  private readonly baseColorNode: Node<"vec3">;
  private readonly basePositionWorldNode: Node<"vec3">;
  private readonly bottom = uniform(0);
  private readonly color = uniform(new Vector3());
  private readonly colorNode: Node<"vec3"> | null;
  private disposed = false;
  private readonly height = uniform(0);
  private readonly position = uniform(new Vector3());
  private readonly positionWorldNode: Node<"vec3"> | null;
  private readonly radius = uniform(0);
  private readonly speed = uniform(0);
  private readonly strength = uniform(0);
  private readonly type: GaussianHighlightVolumeOptions["type"];
  private readonly verticalCoreRadius = uniform(0);
  private readonly verticalFalloffRadius = uniform(0);
  private readonly wavelength = uniform(1);

  constructor(
    private readonly pass: GaussianPass,
    options: GaussianHighlightVolumeOptions,
    private readonly onDispose: () => void,
  ) {
    this.baseColorNode = pass.gaussianColorNode as Node<"vec3">;
    this.basePositionWorldNode = pass.gaussianPositionWorldNode as Node<"vec3">;
    this.type = options.type;
    this.colorNode = options.type === "color"
      ? this.createColorNode()
      : this.createRippleTintNode();
    this.positionWorldNode = options.type === "ripple" ? this.createRippleNode() : null;
    this.update(options);
    if (this.colorNode !== null) this.pass.gaussianColorNode = this.colorNode;
    if (this.positionWorldNode !== null) {
      this.pass.gaussianPositionWorldNode = this.positionWorldNode;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.colorNode !== null && this.pass.gaussianColorNode === this.colorNode) {
      this.pass.gaussianColorNode = this.baseColorNode;
    }
    if (
      this.positionWorldNode !== null
      && this.pass.gaussianPositionWorldNode === this.positionWorldNode
    ) {
      this.pass.gaussianPositionWorldNode = this.basePositionWorldNode;
    }
    this.onDispose();
  }

  prepareFrame(): void {
    if (!this.disposed && this.type === "ripple") this.pass.invalidate();
  }

  update(options: GaussianHighlightVolumeOptions): void {
    if (this.disposed) throw new Error("Gaussian highlight volume is disposed");
    if (options.type !== this.type) {
      throw new TypeError("Gaussian highlight volume type cannot change after creation");
    }
    this.position.value.set(...options.position);
    this.radius.value = options.radius;
    if (options.type === "color") {
      this.bottom.value = options.position[1] - options.bottomOffset;
      this.color.value.set(...options.color);
      this.height.value = options.height + options.bottomOffset;
      this.strength.value = options.strength;
      this.pass.invalidate();
      return;
    }
    this.amplitude.value = options.amplitude;
    this.color.value.set(...options.tintColor);
    this.speed.value = options.speed;
    this.strength.value = options.tintStrength;
    this.verticalCoreRadius.value = options.verticalCoreRadius;
    this.verticalFalloffRadius.value = options.verticalFalloffRadius;
    this.wavelength.value = options.wavelength;
    this.pass.invalidate();
  }

  private createColorNode(): Node<"vec3"> {
    const delta = gaussianPositionWorld.xz.sub(this.position.xz);
    const normalizedRadius = delta.dot(delta).sqrt().div(this.radius);
    const insideRadius = normalizedRadius.lessThanEqual(1);
    const insideHeight = gaussianPositionWorld.y.greaterThanEqual(this.bottom)
      .and(gaussianPositionWorld.y.lessThanEqual(this.bottom.add(this.height)));
    const baseColor = vec3(this.baseColorNode);
    const spot = smoothstep(0, 1, normalizedRadius).oneMinus();
    const lightGain = vec3(1).add(this.color.mul(this.strength).mul(spot));
    const highlightedColor = baseColor.mul(lightGain);
    return insideRadius.and(insideHeight).select(highlightedColor, baseColor);
  }

  private createRippleNode(): Node<"vec3"> {
    const basePosition = vec3(this.basePositionWorldNode);
    const delta = basePosition.xz.sub(this.position.xz);
    const radialDistance = delta.dot(delta).sqrt();
    const verticalDistance = basePosition.y.sub(this.position.y).abs();
    const radialFalloff = smoothstep(0, this.radius, radialDistance).oneMinus();
    const verticalFalloff = smoothstep(
      this.verticalCoreRadius,
      this.verticalFalloffRadius,
      verticalDistance,
    ).oneMinus();
    const phase = radialDistance.div(this.wavelength)
      .sub(time.mul(this.speed))
      .mul(TWO_PI);
    const displacement = phase.sin()
      .mul(this.amplitude)
      .mul(radialFalloff)
      .mul(verticalFalloff);
    const displacedPosition = basePosition.add(vec3(0, displacement, 0));
    const insideVolume = radialDistance.lessThanEqual(this.radius)
      .and(verticalDistance.lessThanEqual(this.verticalFalloffRadius));
    return insideVolume.select(displacedPosition, basePosition);
  }

  private createRippleTintNode(): Node<"vec3"> {
    const delta = gaussianPositionWorld.xz.sub(this.position.xz);
    const radialDistance = delta.dot(delta).sqrt();
    const verticalDistance = gaussianPositionWorld.y.sub(this.position.y).abs();
    const radialFalloff = smoothstep(0, this.radius, radialDistance).oneMinus();
    const verticalFalloff = smoothstep(
      this.verticalCoreRadius,
      this.verticalFalloffRadius,
      verticalDistance,
    ).oneMinus();
    const tintStrength = radialFalloff.mul(verticalFalloff).mul(this.strength);
    const baseColor = vec3(this.baseColorNode);
    const tintedColor = baseColor.mul(vec3(1).add(this.color.mul(tintStrength)));
    const insideVolume = radialDistance.lessThanEqual(this.radius)
      .and(verticalDistance.lessThanEqual(this.verticalFalloffRadius));
    return insideVolume.select(tintedColor, baseColor);
  }
}
