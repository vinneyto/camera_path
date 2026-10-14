import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";

export const editorTool = defineDataContract(
  "host.tools.state@1",
  "Active editor tool, hovered object, and pending cloud placement.",
  generatedSchema("editorTool"),
);
