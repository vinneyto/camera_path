import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const startCloudPlacement = defineRequest(
  "host.startCloudPlacement@1",
  "Start placing the selected library cloud in the scene.",
  apiSchema<Api.LibraryAsset>("LibraryAsset"),
  voidSchema,
  true,
);
