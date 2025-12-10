"use client";

import { useMemo } from "react";
import {
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
  useAssistantState,
  useLocalRuntime,
  RuntimeAdapterProvider,
  AssistantRuntimeProvider,
  type ThreadHistoryAdapter,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import type { MessageRecord } from "@/lib/repositories/chat-repository";
import { MyModelAdapter } from "./model-adapter";
import { MyDatabaseAdapter } from "./database-adapter";

export function MyRuntimeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => {
      return useLocalRuntime(MyModelAdapter, {
        adapters: {
          attachments: new CompositeAttachmentAdapter([
            new SimpleImageAttachmentAdapter(),
            new SimpleTextAttachmentAdapter(),
          ]),
        },
      });
    },

    adapter: {
      ...MyDatabaseAdapter,

      // The Provider component adds thread-specific adapters
      unstable_Provider: ({ children }) => {
        // This runs in the context of each thread
        // TODO: Prevent errors when deleting the main thread
        const threadListItem = useAssistantState(
          ({ threadListItem }) => threadListItem,
        );
        // const remoteId = threadListItem.remoteId;
        const remoteId = threadListItem.id;
        // Create thread-specific history adapter
        const history = useMemo<ThreadHistoryAdapter>(
          () => ({
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
          }),
          [remoteId],
        );
        const adapters = useMemo(() => ({ history }), [history]);

        return (
          <RuntimeAdapterProvider adapters={adapters}>
            {children}
          </RuntimeAdapterProvider>
        );
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
