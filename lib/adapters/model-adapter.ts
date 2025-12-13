import { ChatModelAdapter } from "@assistant-ui/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  readUIMessageStream,
  type UIMessage,
  type UIMessagePart,
  type UIDataTypes,
  type UITools,
} from "ai";

const signedUrlCache = new Map<string, Promise<string>>();

export const MyModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, context }) {
    const transport = new AssistantChatTransport({
      api: "/api/chat",
    });

    const uiMessages: UIMessage[] = await Promise.all(
      messages.map(async (message) => {
        const inlineParts = message.content.filter((c) => c.type !== "file");
        const attachmentParts =
          message.attachments?.flatMap((attachment) =>
            attachment.content.map((part) =>
              resolveAttachmentPart(attachment, part),
            ),
          ) ?? [];

        const resolvedParts = await Promise.all([
          ...inlineParts.map((part) => Promise.resolve(part)),
          ...attachmentParts,
        ]);

        const parts = resolvedParts.map(toUiPart);

        return {
          id: message.id,
          role: message.role,
          parts,
        };
      }),
    );

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

function toUiPart(part: any): UIMessagePart<UIDataTypes, UITools> {
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
}

async function resolveAttachmentPart(
  attachment: any,
  part: any,
): Promise<any> {
  if (part.type === "image") {
    const url = await resolveAttachmentUrl(attachment, part.image);
    return {
      ...part,
      image: url,
      filename: part.filename ?? attachment.name,
    };
  }

  if (part.type === "file") {
    const url = await resolveAttachmentUrl(attachment, part.data);
    return {
      ...part,
      data: url,
      filename: part.filename ?? attachment.name,
    };
  }

  return part;
}

async function resolveAttachmentUrl(
  attachment: any,
  fallback: string,
): Promise<string> {
  const storage = attachment?.storage;
  if (
    storage?.provider === "azure-blob" &&
    typeof storage.objectId === "string" &&
    storage.objectId
  ) {
    try {
      return await getSignedUrl(storage.objectId);
    } catch (error) {
      console.warn("Failed to resolve attachment URL, fallback to inline", {
        attachmentId: attachment?.id,
        error,
      });
    }
  }

  return fallback;
}

function getSignedUrl(objectId: string): Promise<string> {
  if (!signedUrlCache.has(objectId)) {
    const promise = fetch("/api/attachments/download-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            `Failed to sign attachment (status ${res.status})`,
          );
        }
        const payload = await res.json();
        if (typeof payload.url !== "string") {
          throw new Error("Unexpected download-url response");
        }
        return payload.url;
      })
      .catch((error) => {
        signedUrlCache.delete(objectId);
        throw error;
      });

    signedUrlCache.set(objectId, promise);
  }

  return signedUrlCache.get(objectId)!;
}
