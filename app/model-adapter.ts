import { ChatModelAdapter } from "@assistant-ui/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  readUIMessageStream,
  type UIMessage,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";

export const MyModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, context }) {
    const transport = new AssistantChatTransport({
      api: "/api/chat",
    });

    const inputParts = messages.flatMap((message) => [
      ...message.content.filter((c) => c.type !== "file"),
      ...(message.attachments?.flatMap((a) =>
        a.content.map((c) => ({
          ...c,
          filename: a.name,
        })),
      ) ?? []),
    ]);

    const parts = inputParts.map(
      (part): UIMessagePart<UIDataTypes, UITools> => {
        switch (part.type) {
          case "text":
            return {
              type: "text",
              text: part.text,
            };
          case "image":
            return {
              type: "file",
              url: part.image,
              ...(part.filename && { filename: part.filename }),
              mediaType: "image/png",
            };
          case "file":
            return {
              type: "file",
              url: part.data,
              mediaType: part.mimeType,
              ...(part.filename && { filename: part.filename }),
            };
          default:
            throw new Error(`Unsupported part type: ${part.type}`);
        }
      },
    );

    const uiMessages: UIMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: parts,
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
