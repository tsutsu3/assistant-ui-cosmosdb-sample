import { NextRequest, NextResponse } from "next/server";
import { getAzureBlobAttachmentRepository } from "@/lib/storage/azure-blob-repository";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const repository = getAzureBlobAttachmentRepository();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File field is required" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await repository.uploadFile({
      data: buffer,
      contentType: file.type || "application/octet-stream",
      filename: file.name,
      size: file.size,
    });

    return NextResponse.json({
      id: uploaded.id,
      contentType: uploaded.contentType,
      size: uploaded.size,
    });
  } catch (error) {
    logger.error("POST /api/attachments failed", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 },
    );
  }
}
