import type { DataContract, RuntimeSchema } from "./contract-types";
export function defineDataContract<const Id extends string, T>(
  id: Id,
  schema: RuntimeSchema<T>,
): DataContract<Id, T> {
  return Object.freeze({ kind: "data", id, schema });
}
