import type { RuntimeSchema } from "./contract-types";
export function valueSchema<T>(
  guard: (value: unknown) => value is T,
  label: string,
): RuntimeSchema<T> {
  return {
    parse(value) {
      if (!guard(value)) throw new TypeError(`Invalid ${label}`);
      return value;
    },
  };
}
