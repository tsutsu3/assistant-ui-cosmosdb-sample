import type { CompleteAttachment } from "@assistant-ui/react";

export type AttachmentStorageMetadata = {
  storage?: {
    provider: "azure-blob";
    objectId: string;
  };
};

export type StoredAttachment = CompleteAttachment & AttachmentStorageMetadata;

export const isAzureBlobAttachment = (
  attachment: StoredAttachment,
): attachment is StoredAttachment & {
  storage: { provider: "azure-blob"; objectId: string };
} => {
  return (
    !!attachment.storage &&
    attachment.storage.provider === "azure-blob" &&
    typeof attachment.storage.objectId === "string"
  );
};
