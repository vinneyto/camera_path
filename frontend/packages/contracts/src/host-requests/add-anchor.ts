import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const addAnchor = defineRequest(
  "host.addAnchor@1",
  "Add an anchor to the current project.",
  apiSchema<Api.AnchorCreate>("AnchorCreate"),
  voidSchema,
  true,
);
