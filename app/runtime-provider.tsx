"use client";

import { useMemo } from "react";
import {
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
  useAssistantState,
  useLocalRuntime,
  RuntimeAdapterProvider,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";
import { AzureBlobAttachmentAdapter } from "@/lib/adapters/azure-blob-attachment-adapter";
import { MyDatabaseAdapter } from "@/lib/adapters/database-adapter";
import { createThreadHistoryAdapter } from "@/lib/adapters/thread-history-adapter";
import { MyModelAdapter } from "@/lib/adapters/model-adapter";

export function MyRuntimeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => {
      return useLocalRuntime(MyModelAdapter, {
        adapters: {
          attachments: new AzureBlobAttachmentAdapter(),
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
        const history = useMemo(
          () => createThreadHistoryAdapter(remoteId),
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
