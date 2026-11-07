export function parseImageGenerationInput(source: string) {
  try {
    const value: unknown = JSON.parse(source);
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "image_asset_id" in value &&
      typeof value.image_asset_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        value.image_asset_id,
      )
    ) {
      return { input: { image_asset_id: value.image_asset_id }, error: null };
    }
  } catch {
    /* Show the same validation message for invalid JSON. */
  }
  return {
    input: null,
    error:
      "Enter a JSON object with a single image_asset_id containing a valid image UUID.",
  };
}
