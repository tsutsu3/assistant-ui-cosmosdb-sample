import { type unstable_RemoteThreadListAdapter as RemoteThreadListAdapter } from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";

export const MyDatabaseAdapter: RemoteThreadListAdapter = {
  async list() {
    const res = await fetch("/api/threads");
    const data = await res.json();
    return {
      threads: data.map((t: any) => ({
        status: t.archived ? "archived" : "regular",
        remoteId: t.id,
        title: t.title,
      })),
    };
  },

  async initialize(threadId) {
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: threadId }),
    });
    const data = await res.json();
    return {
      remoteId: data.id,
      externalId: undefined,
    };
  },

  async rename(remoteId, newTitle) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newTitle }),
    });
  },

  async archive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "Content-Type": "application/json" },
    });
  },

  async unarchive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
  },

  async delete(remoteId) {
    await fetch(`/api/threads/${remoteId}`, { method: "DELETE" });
  },

  async generateTitle(remoteId, unstable_messages) {
    return createAssistantStream(async (controller) => {
      const firstUserMessage = unstable_messages.find((m) => m.role === "user");
      if (firstUserMessage) {
        const res = await fetch(`/api/threads/${remoteId}/title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: unstable_messages }),
        });
        const { title } = await res.json();
        controller.appendText(title);
      } else {
        controller.appendText("New Chat");
      }
    });
  },

  async fetch(threadId) {
    throw new Error("Not implemented");
    // const res = await fetch(`/api/threads/${threadId}`);
    // const data = await res.json();
    // return {
    //   status: data.archived ? "archived" : "regular",
    //   remoteId: data.id,
    //   externalId: data.externalId,
    //   title: data.title,
    // };
  },
};
