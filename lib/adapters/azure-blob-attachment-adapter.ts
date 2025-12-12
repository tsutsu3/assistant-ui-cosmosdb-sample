'use client';

import type {
  Attachment,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from "@assistant-ui/react";
import type { AttachmentStorageMetadata } from "@/lib/types/attachments";

type UploadResponse = {
  id: string;
  downloadUrl: string;
  contentType?: string;
  size?: number;
};

type AdapterOptions = {
  /**
   * Override accepted MIME types for the file picker.
   * Defaults to common image, document, and text formats.
   */
  accept?: string;
  /**
   * API endpoint that accepts multipart uploads and returns blob metadata.
   * Defaults to `/api/attachments`.
   */
  uploadEndpoint?: string;
};

/**
 * Uploads composer attachments to Azure Blob Storage via the Next.js API routes.
 *
 * Files are uploaded lazily when the user sends a message so we only persist
 * attachments that are part of the conversation history.
 */
export class AzureBlobAttachmentAdapter implements AttachmentAdapter {
  public readonly accept: string;

  private readonly uploadEndpoint: string;
  private readonly uploads = new Map<string, UploadResponse>();

  constructor(options: AdapterOptions = {}) {
    this.accept =
      options.accept ??
      [
        "image/*",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/json",
      ].join(",");
    this.uploadEndpoint = options.uploadEndpoint ?? "/api/attachments";
  }

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: this.generateId(),
      type: this.getAttachmentType(file),
      name: file.name,
      contentType: file.type || "application/octet-stream",
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async remove(attachment: Attachment): Promise<void> {
    this.uploads.delete(attachment.id);
  }

  async send(
    attachment: PendingAttachment,
  ): Promise<CompleteAttachment & AttachmentStorageMetadata> {
    const upload = await this.ensureUpload(attachment);
    const content = this.buildContentParts(attachment, upload.downloadUrl);

    const completeAttachment: CompleteAttachment & AttachmentStorageMetadata = {
      id: attachment.id,
      type: attachment.type,
      name: attachment.name,
      contentType: attachment.contentType,
      status: { type: "complete" },
      content,
      storage: {
        provider: "azure-blob",
        objectId: upload.id,
      },
    };

    this.uploads.delete(attachment.id);
    return completeAttachment;
  }

  private async ensureUpload(
    attachment: PendingAttachment,
  ): Promise<UploadResponse> {
    const cached = this.uploads.get(attachment.id);
    if (cached) return cached;

    const uploaded = await this.uploadFile(attachment.file);
    this.uploads.set(attachment.id, uploaded);
    return uploaded;
  }

  private async uploadFile(file: File): Promise<UploadResponse> {
    const body = new FormData();
    body.append("file", file);

    const response = await fetch(this.uploadEndpoint, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => undefined);
      throw new Error(
        `Failed to upload attachment (${response.status}): ${
          message ?? "Unknown error"
        }`,
      );
    }

    const payload = (await response.json()) as UploadResponse;
    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.downloadUrl !== "string"
    ) {
      throw new Error("Unexpected attachment upload response");
    }

    return {
      id: payload.id,
      downloadUrl: payload.downloadUrl,
      contentType:
        payload.contentType || file.type || "application/octet-stream",
      size: payload.size ?? file.size,
    };
  }

  private buildContentParts(
    attachment: PendingAttachment,
    downloadUrl: string,
  ): CompleteAttachment["content"] {
    if (attachment.type === "image") {
      return [
        {
          type: "image",
          image: downloadUrl,
          filename: attachment.name,
        },
      ];
    }

    return [
      {
        type: "file",
        data: downloadUrl,
        mimeType: attachment.contentType,
        filename: attachment.name,
      },
    ];
  }

  private generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private getAttachmentType(file: File): PendingAttachment["type"] {
    const mime = file.type;
    if (mime?.startsWith("image/")) return "image";
    if (mime === "application/pdf" || mime?.startsWith("text/")) {
      return "document";
    }
    return "file";
  }
}
