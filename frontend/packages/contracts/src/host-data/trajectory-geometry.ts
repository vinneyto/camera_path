import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const trajectoryGeometry = defineDataContract(
  "host.trajectoryGeometry@1",
  "Editable trajectory segments of the current project.",
  apiSchema<Api.Trajectory>("Trajectory"),
);
