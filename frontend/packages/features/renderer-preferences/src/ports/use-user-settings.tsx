"use client";
import { preferencesState } from "@camera-path/contracts/host-data";
import {
  retryPreferences,
  savePreferences,
} from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useUserSettings() {
  const state = useData(manifest, preferencesState);
  const save = useRequestAction(manifest, savePreferences);
  const retry = useRequestAction(manifest, retryPreferences);
  return {
    ...state,
    error: state.errorMessage ? new Error(state.errorMessage) : null,
    save,
    retry: () => void retry(undefined),
  };
}
