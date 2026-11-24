import type { TransportStatus } from "./api";

export type InferenceStatus = TransportStatus;
export type InferenceCommand = InferenceStatus["capabilities"][number];
