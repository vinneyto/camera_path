import type { RequestErrorCode } from "./contract-types";
import { valueSchema } from "./value-schema";
export const stringSchema = valueSchema(
  (v): v is string => typeof v === "string",
  "string",
);
export const booleanSchema = valueSchema(
  (v): v is boolean => typeof v === "boolean",
  "boolean",
);
export const voidSchema = valueSchema(
  (v): v is void => v === undefined,
  "void",
);
export const numberSchema = valueSchema(
  (v): v is number => typeof v === "number" && Number.isFinite(v),
  "finite number",
);

export const errorCodeSchema = valueSchema(
  (value): value is RequestErrorCode =>
    typeof value === "string" &&
    [
      "forbidden",
      "conflict",
      "invalid-input",
      "unavailable",
      "cancelled",
      "failed",
    ].includes(value),
  "request error code",
);
