export const CHAT_MAX_IMAGES = 8;
export const CHAT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const CHAT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const PIPELINE_PHASE_LABELS: Record<string, string> = {
  queued: "Queued for generation",
  generating: "Generating model",
  importing: "Importing into library",
  generation_and_import: "Waiting for generation and library import",
  image_request: "Generating image",
};
