"use client";
import { useState } from "react";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useAnchors,
  useChatHistory,
  usePipelines,
} from "@camera-path/api/resources";
import { useProjectId } from "@camera-path/store";

import {
  useSendChatMessageMutation,
  useConfirmPipeline,
} from "@camera-path/actions";
import type { ChatAttachment } from "@camera-path/types/api";
import { useChatComposer } from "../model/use-chat-composer";
import { ResponsiveChatPanel } from "./responsive-chat-panel";
export function ChatSidebar() {
  const canEdit = useAuth().canEdit;
  const anchorQuery = useAnchors();
  const history = useChatHistory();
  const mutation = useSendChatMessageMutation(useProjectId());
  const pipelines = usePipelines();
  const confirmation = useConfirmPipeline();
  const [imageError, setImageError] = useState<string | null>(null);
  const composer = useChatComposer({
    pending: mutation.isPending,
    onSend: async (id, message, onAccepted, files) => {
      await mutation
        .mutateAsync({
          id,
          message,
          onAccepted,
          files,
        })
        .catch(() => undefined);
    },
  });
  const error =
    mutation.error ??
    confirmation.error ??
    pipelines.error ??
    history.error ??
    anchorQuery.error;
  function continueImage(image: ChatAttachment, anchorId?: string | null) {
    const anchor = anchorQuery.data?.data.find((a) => a.id === anchorId);
    if (anchorId && !anchor) {
      setImageError(
        "The target anchor no longer exists. Choose another anchor in chat.",
      );
      return;
    }
    setImageError(null);
    const message = anchor
      ? `Continue with this image: generate a 3D model and replace @${anchor.label}, fitting its size.`
      : "Continue with this image: generate a 3D model.";
    void mutation
      .mutateAsync({
        id: crypto.randomUUID(),
        message,
        attachmentIds: [image.id],
        onAccepted: () => undefined,
      })
      .catch(() => undefined);
  }
  if (!canEdit) return null;
  return (
    <ResponsiveChatPanel
      anchors={anchorQuery.data?.data ?? []}
      messages={history.data?.data ?? []}
      composer={composer}
      pending={mutation.isPending}
      pipelines={pipelines.data?.status === 200 ? pipelines.data.data : []}
      onConfirm={(id) => confirmation.mutate(id)}
      onContinue={continueImage}
      error={
        imageError ??
        (error instanceof Error
          ? error.message
          : error
            ? "Could not load pipelines"
            : null)
      }
    />
  );
}
