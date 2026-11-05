export function parseGenerationInput(source: string) {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return { input: null, error: "Enter valid JSON." };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("prompt" in value) ||
    typeof value.prompt !== "string" ||
    Object.keys(value).length !== 1
  ) {
    return {
      input: null,
      error: "Enter a JSON object with a single string field named prompt.",
    };
  }
  return { input: { prompt: value.prompt }, error: null };
}
