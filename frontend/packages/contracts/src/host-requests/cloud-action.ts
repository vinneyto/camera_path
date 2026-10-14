import type * as Api from "../api";
export type CloudAction =
  | { type: "add"; assetId: string; translation?: [number, number, number] }
  | { type: "remove"; cloudId: string }
  | { type: "update"; cloudId: string; changes: Api.ProjectCloudUpdate };
