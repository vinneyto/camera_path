"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useAnchors, useChatHistory } from "@camera-path/api/resources";
import { useProjectId } from "@camera-path/store";

import { useSendChatMessage } from "../api/use-send-chat-message";
import { useChatComposer } from "../model/use-chat-composer";
import { ResponsiveChatPanel } from "./responsive-chat-panel";
export function ChatSidebar() {
  const canEdit = useAuth().canEdit;
  const anchorQuery = useAnchors();
  const history = useChatHistory();
  const mutation = useSendChatMessage(useProjectId());
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
