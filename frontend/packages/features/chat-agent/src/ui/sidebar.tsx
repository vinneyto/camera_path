"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useAnchors, useChatHistory } from "@camera-path/api/resources";
import { useProjectId } from "@camera-path/store";

import { useSendChatMessageMutation } from "@camera-path/actions";
import { useChatComposer } from "../model/use-chat-composer";
import { useChatSelection } from "../ports/use-chat-selection";
import { ResponsiveChatPanel } from "./responsive-chat-panel";
export function ChatSidebar() {
  const canEdit = useAuth().canEdit;
  const selection = useChatSelection();
  const anchorQuery = useAnchors();
  const history = useChatHistory();
  const mutation = useSendChatMessageMutation(useProjectId());
  const composer = useChatComposer({
    pending: mutation.isPending,
    selectedObjectId: selection?.id ?? null,
    onSend: async (id, message, onAccepted, files) => {
      await mutation
        .mutateAsync({
          id,
          message,
          onAccepted,
          files,
          selectedObjectId: selection?.id ?? null,
        })
        .catch(() => undefined);
    },
  });
  const error = mutation.error ?? history.error ?? anchorQuery.error;
  if (!canEdit) return null;
  return (
    <ResponsiveChatPanel
      selection={selection}
      anchors={anchorQuery.data?.data ?? []}
      messages={history.data?.data ?? []}
      composer={composer}
      pending={mutation.isPending}
      error={error?.message ?? null}
    />
  );
}
