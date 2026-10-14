"use client";
import {
  anchors,
  chatHistory,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  useData,
  useDataQuery,
  useFeatureHost,
} from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { useSendChatMessage } from "../api/use-send-chat-message";
import { useChatComposer } from "../model/use-chat-composer";
import { ResponsiveChatPanel } from "./responsive-chat-panel";
export function SidebarExtension() {
  const host = useFeatureHost(manifest);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const anchorQuery = useDataQuery(manifest, anchors);
  const history = useDataQuery(manifest, chatHistory);
  const mutation = useSendChatMessage(host.scopeId);
  const composer = useChatComposer({
    pending: mutation.isPending,
    onSend: async (id, message, onAccepted) => {
      await mutation
        .mutateAsync({ id, message, onAccepted })
        .catch(() => undefined);
    },
  });
  const error = mutation.error ?? history.error ?? anchorQuery.error;
  if (!canEdit) return null;
  return (
    <ResponsiveChatPanel
      anchors={anchorQuery.data?.data ?? []}
      messages={history.data?.data ?? []}
      composer={composer}
      pending={mutation.isPending}
      error={error?.message ?? null}
    />
  );
}
