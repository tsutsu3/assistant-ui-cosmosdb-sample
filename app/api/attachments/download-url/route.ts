import { NextRequest, NextResponse } from "next/server";
import { getAzureBlobAttachmentRepository } from "@/lib/storage/azure-blob-repository";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const repository = getAzureBlobAttachmentRepository();
    const { objectId, expiresInSeconds } = await req.json();

    if (typeof objectId !== "string" || !objectId.length) {
      return NextResponse.json(
        { error: "objectId must be provided" },
        { status: 400 },
      );
    }

    const url = await repository.getTemporaryDownloadUrl(objectId, {
      expiresInSeconds:
        typeof expiresInSeconds === "number" ? expiresInSeconds : undefined,
    });

    return NextResponse.json({ url });
  } catch (error) {
    logger.error("POST /api/attachments/download-url failed", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 },
    );
  }
}
