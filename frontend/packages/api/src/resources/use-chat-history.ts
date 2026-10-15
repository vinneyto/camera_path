"use client";
import { useProjectId } from "@camera-path/store";
import type { ChatHistoryMessage } from "@camera-path/types/project";
import { useListChatMessages } from "../client/generated/client";
export function useChatHistory(id?: string) {
  const query = useListChatMessages(useProjectId(id));
  return {
    ...query,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
    data:
      query.data?.status === 200
        ? { ...query.data, data: query.data.data as ChatHistoryMessage[] }
        : undefined,
  };
}
