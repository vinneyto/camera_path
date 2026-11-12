/** A failed readback must not release targets while sibling GPU copies still run. */
export async function settleDepthReadbacks<T>(
  pending: Promise<T>[],
): Promise<T[]> {
  const results = await Promise.allSettled(pending);
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
}
