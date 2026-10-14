import { errorCodeSchema } from "./basic-schemas";
import type { RequestDefinition, RuntimeSchema } from "./contract-types";
export function defineRequest<const Id extends string, I, O>(
  id: Id,
  inputSchema: RuntimeSchema<I>,
  outputSchema: RuntimeSchema<O>,
  requiresEdit = true,
): RequestDefinition<Id, I, O> {
  return Object.freeze({
    kind: "request",
    id,
    inputSchema,
    outputSchema,
    requiresEdit,
    errorSchema: errorCodeSchema,
  });
}
