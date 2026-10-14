export function immutableValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return Object.freeze(value.map(immutableValue)) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new TypeError("Data ports require plain immutable DTOs");
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableValue(item)]),
    ),
  ) as T;
}
