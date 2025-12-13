import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { CosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";
import { AzureBlobAttachmentRepository } from "@/lib/storage/azure-blob-repository";
import { isAzureBlobAttachment } from "@/lib/types/attachments";

const attachmentRepository = new AzureBlobAttachmentRepository();
const chatRepository = new CosmosChatRepository();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { title, archived } = await req.json();

    if (
      (typeof title !== "string" || title.trim().length === 0) &&
      typeof archived !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid title and archived" },
        { status: 400 },
      );
    }

    if (typeof title === "string" && title.trim().length > 0) {
      const response = await chatRepository.renameThread(id, title);
      return NextResponse.json(response);
    }

    if (archived === true) {
      const response = await chatRepository.archiveThread(id);
      return NextResponse.json(response);
    } else {
      const response = await chatRepository.unarchiveThread(id);
      return NextResponse.json(response);
    }
  } catch (e) {
    logger.error("PATCH /threads/[id] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const messages = await chatRepository.getMessages(id);
    const objectIds = collectAzureBlobObjectIds(messages);

    await chatRepository.deleteThread(id);

    if (objectIds.length > 0) {
      const results = await Promise.allSettled(
        objectIds.map((objectId) => attachmentRepository.deleteFile(objectId)),
      );

      const failed = results.filter(
        (res): res is PromiseRejectedResult => res.status === "rejected",
      );

      if (failed.length > 0) {
        throw new Error(
          `Failed to delete ${failed.length} attachment(s) for thread ${id}`,
        );
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logger.error("DELETE /threads/[id] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

function collectAzureBlobObjectIds(messages: any[]): string[] {
  const ids = new Set<string>();

  for (const message of messages) {
    const attachments = Array.isArray(message.attachments)
      ? (message.attachments as any[])
      : [];

    for (const attachment of attachments) {
      if (!isAzureBlobAttachment(attachment)) continue;
      const objectId = attachment.storage.objectId;
      if (objectId) {
        ids.add(objectId);
      }
    }
  }

  return Array.from(ids);
}
