"use client";

import { useMemo } from "react";

import type { Project } from "@/entities/project";
import { ChatPanel, useSendChatMessage } from "@/features/chat-agent";
import { useTrajectorySelection } from "@/features/project-editor";

interface ChatPanelContainerProps {
  project: Project;
  projectId: string;
  queryError: Error | null;
}

export function ChatPanelContainer({
  project,
  projectId,
  queryError,
}: ChatPanelContainerProps) {
  const chatMutation = useSendChatMessage(projectId);
  const { selectTrajectory } = useTrajectorySelection();
  const anchors = useMemo(() => Object.values(project.anchors), [project.anchors]);
  const requestError = queryError ?? chatMutation.error;
  const error = requestError instanceof Error ? requestError.message : null;

  async function sendMessage(id: string, message: string, onAccepted: () => void) {
    try {
      const result = await chatMutation.mutateAsync({ id, message, onAccepted });
      if (result.compiled.position_segments.length > 0) selectTrajectory();
    } catch {
      // The mutation exposes the error while the persisted user message stays in chat history.
    }
  }

  return (
    <ChatPanel
      anchors={anchors}
      error={error}
      messages={project.chat_history}
      onSend={sendMessage}
      pending={chatMutation.isPending}
    />
  );
}
