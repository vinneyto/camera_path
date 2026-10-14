import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const compiledTrajectory = defineDataContract(
  "host.compiledTrajectory@1",
  "Compiled trajectory geometry, motion, and camera tracks.",
  apiSchema<Api.CompiledTrajectory>("CompiledTrajectory"),
);
