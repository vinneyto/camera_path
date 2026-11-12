"use client";
import type { ChatAttachment, Pipeline } from "@camera-path/types/api";
import type { ChatHistoryMessage } from "@camera-path/types/project";
import { ChatMessage } from "./chat-message";
import { PipelineCard } from "./pipeline-card";

export function ChatMessageGroup({
  message,
  pipelines,
  onConfirm,
  onContinue,
  disabled,
}: {
  message: ChatHistoryMessage;
  pipelines: Pipeline[];
  onConfirm?: (id: string) => void;
  onContinue?: (image: ChatAttachment, anchorId?: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <ChatMessage {...message} onContinue={onContinue} disabled={disabled} />
      {pipelines.map((pipeline) => (
        <PipelineCard
          key={pipeline.id}
          pipeline={pipeline}
          onConfirm={onConfirm}
          onContinue={onContinue}
          disabled={disabled}
        />
      ))}
    </>
  );
}
