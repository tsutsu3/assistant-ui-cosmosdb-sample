import { ChatModelAdapter } from "@assistant-ui/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { readUIMessageStream, type UIMessage } from "ai";

export const MyModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, context }) {
    const transport = new AssistantChatTransport({
      api: "/api/chat",
    });

    const uiMessages: UIMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.content.map((c) => ({
        type: "text",
        text: c.type === "text" ? c.text : "",
      })),
    }));

    const chunkStream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "default",
      messageId: "undefined",
      messages: uiMessages,
      abortSignal,
      body: {
        tools: context.tools,
      },
    });

    for await (const uiMessage of readUIMessageStream({
      stream: chunkStream,
    })) {
      for (const p of uiMessage.parts) {
        if (p.type === "text") {
          yield {
            status: { type: "running" },
            content: [{ type: "text", text: p.text }] as const,
          };
        } else if (
          typeof p.type === "string" &&
          p.type.startsWith("tool-") &&
          "toolCallId" in p &&
          "input" in p &&
          "output" in p
        ) {
          const toolNameWithoutPrefix = p.type.replace(/^tool-/, "");
          if (p.state === "input-available") {
            yield {
              status: { type: "requires-action", reason: "tool-calls" },
              content: [
                {
                  type: "tool-call",
                  toolCallId: p.toolCallId,
                  toolName: toolNameWithoutPrefix,
                  args: p.input as any,
                  argsText: "",
                  result: "",
                },
              ] as const,
            };
          }
          if (p.state === "output-available") {
            const safeArgs =
              p.input && typeof p.input === "object" ? p.input : {};
            yield {
              status: { type: "complete", reason: "stop" },
              content: [
                {
                  type: "tool-call",
                  toolCallId: p.toolCallId,
                  toolName: toolNameWithoutPrefix,
                  args: safeArgs as any,
                  argsText: JSON.stringify(safeArgs),
                  result: p.output,
                },
              ] as const,
            };
          }
        }
      }
    }
  },
};
