import { generatedSchema } from "../generated-schema";
import type * as Api from "../api";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const updateLibraryDefaults = defineRequest(
  "host.updateLibraryDefaults@1",
  "Update the placement defaults of a library cloud.",
  generatedSchema("updateLibraryDefaults"),
  voidSchema,
  true,
);

export interface UpdateLibraryDefaultsInput {
  assetId: string;
  changes: Api.LibraryAssetDefaultsUpdate;
}
