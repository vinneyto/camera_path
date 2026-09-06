import type { SceneSurfaceHit } from "@/shared/scene-surface";

interface AnchorPlacementCandidate {
  cameraMoved: boolean;
  hit: SceneSurfaceHit;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
}

export interface AnchorPlacementResult {
  hit: SceneSurfaceHit | null;
  pointerType: string;
}

export class AnchorPlacementGesture {
  private candidate: AnchorPlacementCandidate | null = null;

  constructor(private readonly clickThreshold: number) {}

  begin(
    hit: SceneSurfaceHit,
    pointerId: number,
    pointerType: string,
    clientX: number,
    clientY: number,
  ): void {
    this.candidate = {
      cameraMoved: false,
      hit,
      pointerId,
      pointerType,
      startX: clientX,
      startY: clientY,
    };
  }

  cancel(): void {
    this.candidate = null;
  }

  markCameraMoved(): void {
    if (this.candidate !== null) this.candidate.cameraMoved = true;
  }

  move(hit: SceneSurfaceHit, pointerId: number, clientX: number, clientY: number): boolean {
    if (this.candidate === null || this.candidate.pointerId !== pointerId) return false;
    this.candidate.hit = hit;
    const distance = Math.hypot(
      clientX - this.candidate.startX,
      clientY - this.candidate.startY,
    );
    if (distance > this.clickThreshold) this.candidate.cameraMoved = true;
    return this.candidate.cameraMoved;
  }

  finish(pointerId: number): AnchorPlacementResult | null {
    if (this.candidate === null || this.candidate.pointerId !== pointerId) return null;
    const candidate = this.candidate;
    this.candidate = null;
    return {
      hit: candidate.cameraMoved ? null : candidate.hit,
      pointerType: candidate.pointerType,
    };
  }
}
