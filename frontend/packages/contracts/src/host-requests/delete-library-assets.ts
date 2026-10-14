import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteLibraryAssets = defineRequest(
  "host.deleteLibraryAssets@1",
  "Delete library clouds by their IDs.",
  generatedSchema("deleteLibraryAssets"),
  voidSchema,
  true,
);
