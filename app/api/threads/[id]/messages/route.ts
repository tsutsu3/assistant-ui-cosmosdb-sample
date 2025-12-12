import { NextRequest, NextResponse } from "next/server";
import { MessageRecord } from "@/lib/repositories/chat-repository";
import { logger } from "@/lib/logger";
import { CosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";
import { AzureBlobAttachmentRepository } from "@/lib/storage/azure-blob-repository";
import {
  isAzureBlobAttachment,
  type StoredAttachment,
} from "@/lib/types/attachments";

const attachmentRepository = new AzureBlobAttachmentRepository();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repository = new CosmosChatRepository();

  try {
    const messages = await repository.getMessages(id);
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
  const { id } = await params;
  const repository = new CosmosChatRepository();
  const body = await req.json();
  const message = body.message;
  const parentId = body.parentId;
  const runConfig = body.runConfig;

  const stripedMessage = {
    ...message,
    attachments: message.attachments?.map((attachment: StoredAttachment) => {
      const updatedContent = attachment.content?.map((part: any) => {
        if (part.type === "image" && part.image) {
          return { ...part, image: stripSasToken(part.image) };
        }
        if (part.type === "file" && part.data) {
          return { ...part, data: stripSasToken(part.data) };
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

function stripSasToken(url: string): string {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.search = "";
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

async function refreshAttachmentUrls(messages: MessageRecord[]) {
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
