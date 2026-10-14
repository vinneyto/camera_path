import type {
  DataContract,
  RequestDefinition,
} from "@camera-path/contracts/contract-types";
import type { GpuResourceDefinition } from "@camera-path/contracts/gpu-resources";
export type FramePhase = "update" | "before-render" | "after-render";
export interface FrameDeclaration {
  readonly id: string;
  readonly phase: FramePhase;
  readonly after?: readonly string[];
  readonly before?: readonly string[];
}
export interface ContributionDeclaration {
  readonly id: string;
  readonly kind:
    "ui" | "scene" | "command" | "timeline" | "gpu-pass" | "picking-provider";
  readonly slot?: string;
  readonly order?: number;
  readonly resourceType?: string;
  readonly inputs?: readonly GpuResourceDefinition[];
  readonly outputs?: readonly GpuResourceDefinition[];
  readonly after?: readonly string[];
  readonly before?: readonly string[];
}
export interface FeatureManifest<Id extends string = string> {
  readonly manifestVersion: 1;
  readonly id: Id;
  readonly scope: "application" | "project";
  /** Reading includes snapshots, readiness and subscriptions. */
  readonly reads: readonly DataContract[];
  readonly calls: readonly RequestDefinition<string, unknown, unknown>[];
  /** Services implemented by the feature; omitted when none are provided. */
  readonly handles?: readonly RequestDefinition<string, unknown, unknown>[];
  readonly frames: readonly FrameDeclaration[];
  readonly contributions: readonly ContributionDeclaration[];
  readonly capabilities: readonly string[];
}
