import { NextRequest, NextResponse } from "next/server";
import { MessageRecord } from "@/lib/repositories/chat-repository";
import { logger } from "@/lib/logger";
import { getCosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";
import { getAzureBlobAttachmentRepository } from "@/lib/storage/azure-blob-repository";
import {
  isAzureBlobAttachment,
  type StoredAttachment,
} from "@/lib/types/attachments";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const repository = getCosmosChatRepository();
  const { id } = await params;

  try {
    const messages = await repository.getMessages(id);
    // Set temporary URLs for attachments
    const enrichedMessages = await refreshAttachmentUrls(messages);
    return NextResponse.json({ messages: enrichedMessages });
  } catch (e) {
    logger.error("GET /threads/[id]/messages error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const repository = getCosmosChatRepository();
  const { id } = await params;
  const body = await req.json();
  const message = body.message;
  const parentId = body.parentId;
  const runConfig = body.runConfig;

  const stripedMessage = {
    ...message,
    attachments: message.attachments?.map((attachment: StoredAttachment) => {
      // Remove base64 image data from attachments before storing
      const updatedContent = attachment.content?.map((part: any) => {
        if (part.type === "image" && part.image) {
          return { ...part, image: replaceB64ImageUrl(part.image) };
        }
        if (part.type === "file" && part.data) {
          return { ...part, data: replaceB64ImageUrl(part.data) };
        }
        return part;
      });
      return {
        ...attachment,
        content: updatedContent,
      };
    }),
  };

  const record: MessageRecord = {
    ...stripedMessage,
    threadId: id,
    parentId: parentId || null,
    runConfig: runConfig || null,
    createdAt: stripedMessage.createdAt
      ? new Date(stripedMessage.createdAt)
      : new Date(),
  };

  try {
    await repository.appendMessage(record);
    return NextResponse.json(record);
  } catch (e) {
    console.error("POST /threads/[id]/messages error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

function replaceB64ImageUrl(url: string): string {
  return "[data removed]";
}

async function refreshAttachmentUrls(messages: MessageRecord[]) {
  const attachmentRepository = getAzureBlobAttachmentRepository();

  return Promise.all(
    messages.map(async (message) => {
      if (!Array.isArray(message.attachments)) {
        return message;
      }

      const updatedAttachments = await Promise.all(
        (message.attachments as StoredAttachment[]).map(async (attachment) => {
          if (!isAzureBlobAttachment(attachment)) {
            return attachment;
          }

          try {
            const downloadUrl =
              await attachmentRepository.getTemporaryDownloadUrl(
                attachment.storage.objectId,
              );

            const updatedContent =
              attachment.content?.map((part) => {
                if (part.type === "image") {
                  return { ...part, image: downloadUrl };
                }
                if (part.type === "file") {
                  return { ...part, data: downloadUrl };
                }
                return part;
              }) ?? attachment.content;

            return {
              ...attachment,
              content: updatedContent,
            };
          } catch (error) {
            logger.error("Failed to refresh attachment URL", {
              attachmentId: attachment.id,
              error,
            });
            return attachment;
          }
        }),
      );

      return {
        ...message,
        attachments: updatedAttachments,
      };
    }),
  );
}
