import type { ThreadHistoryAdapter } from "@assistant-ui/react";
import type { MessageRecord } from "@/lib/repositories/chat-repository";

export function createThreadHistoryAdapter(
  remoteId: string | undefined,
): ThreadHistoryAdapter {
  return {
    async load() {
      if (!remoteId) return { messages: [] };
      const response = await fetch(`/api/threads/${remoteId}/messages`);
      const data = await response.json();

      return {
        messages: data.messages.map((m: MessageRecord) => ({
          message: m,
          parentId: m.parentId,
          runConfig: m.runConfig,
        })),
      };
    },

    async append(message) {
      if (!remoteId) {
        console.warn("Cannot save message - thread not initialized");
        return;
      }

      await fetch(`/api/threads/${remoteId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    },
  };
}
