import type { PathPosition } from "../path-position";
import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const setPlaybackFrame = defineRequest(
  "host.setPlaybackFrame@1",
  "Set the current trajectory playback position and elapsed time.",
  generatedSchema("setPlaybackFrame"),
  voidSchema,
  false,
);

export interface PlaybackFrameInput {
  /**
   * @minimum 0
   * @maximum 1
   */
  pathPosition: PathPosition;
  /** @minimum 0 */
  elapsed: number;
}
