import {
  BlobSASPermissions,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { logger } from "@/lib/logger";
import {
  ObjectStorageRepository,
  UploadFileParams,
  UploadedFile,
} from "@/lib/repositories/storage-repository";
import { getAzureBlobContainerClient, getAzureBlobCredential } from "./client";
import type { AzureBlobRepositoryOptions } from "./types";

export class AzureBlobAttachmentRepository implements ObjectStorageRepository {
  private readonly containerClient: ContainerClient;
  private readonly credential: StorageSharedKeyCredential;
  private readonly defaultUrlExpiration: number;
  private containerReady?: Promise<void>;

  constructor(options: AzureBlobRepositoryOptions = {}) {
    const containerName =
      options.containerName ||
      process.env.AZURE_STORAGE_CONTAINER ||
      "attachments";

    this.credential = getAzureBlobCredential();
    this.containerClient = getAzureBlobContainerClient(containerName);
    this.defaultUrlExpiration =
      options.urlExpirationSeconds ||
      Number(
        process.env.AZURE_STORAGE_DOWNLOAD_URL_TTL_SECONDS ||
          (15 * 60).toString(),
      );
    this.pathPrefix =
      options.pathPrefix ||
      process.env.AZURE_STORAGE_PATH_PREFIX ||
      "attachments";
  }

  private readonly pathPrefix: string;

  private async ensureContainerExists() {
    if (!this.containerReady) {
      this.containerReady = this.containerClient
        .createIfNotExists()
        .then((result) => {
          if (result.succeeded) {
            logger.info("Azure blob container created", {
              container: this.containerClient.containerName,
            });
          }
        })
        .catch((error) => {
          // HTTP 409 indicates the container already exists.
          if (error?.statusCode !== 409) {
            logger.error("Failed to ensure Azure blob container", {
              container: this.containerClient.containerName,
              error,
            });
            throw error;
          }
        });
    }
    return this.containerReady;
  }

  async uploadFile(params: UploadFileParams): Promise<UploadedFile> {
    await this.ensureContainerExists();
    const buffer = this.toBuffer(params.data);
    const blobName = this.buildBlobName(params.filename);
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    const response = await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: params.contentType,
      },
      metadata: this.buildMetadata(params.filename),
    });

    logger.debug("Uploaded attachment to Azure blob storage", {
      blobName,
      size: params.size,
      contentType: params.contentType,
    });

    return {
      id: blobName,
      contentType: params.contentType,
      size: params.size,
      metadata: {
        etag: response.etag,
        lastModified: response.lastModified,
      },
    };
  }

  async getTemporaryDownloadUrl(
    objectId: string,
    options?: { expiresInSeconds?: number },
  ): Promise<string> {
    const expiresOn = new Date(
      Date.now() +
        1000 * (options?.expiresInSeconds ?? this.defaultUrlExpiration),
    );

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerClient.containerName,
        blobName: objectId,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      this.credential,
    ).toString();

    const blockBlobClient = this.containerClient.getBlockBlobClient(objectId);

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async deleteFile(objectId: string): Promise<void> {
    await this.ensureContainerExists();
    const client = this.containerClient.getBlockBlobClient(objectId);

    try {
      const response = await client.deleteIfExists();
      if (response.succeeded) {
        logger.debug("Deleted blob object", { objectId });
      } else {
        logger.warn("Blob delete returned not succeeded", { objectId });
      }
    } catch (error) {
      logger.error("Failed to delete blob object", { objectId, error });
      throw error;
    }
  }

  private buildBlobName(filename: string) {
    const sanitizedPrefix = this.pathPrefix
      ? this.pathPrefix.replace(/(^\/+|\/+$)/g, "") + "/"
      : "";
    const timestamp = new Date();
    const folder = `${timestamp.getUTCFullYear()}/${String(
      timestamp.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    const extension = this.getExtension(filename);
    return `${sanitizedPrefix}${folder}/${randomUUID()}${extension}`;
  }

  private getExtension(filename: string) {
    const ext = extname(filename);
    return ext?.length ? ext : "";
  }

  private toBuffer(data: UploadFileParams["data"]): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }

    return Buffer.from(data);
  }

  private buildMetadata(filename: string) {
    const sanitized = this.sanitizeMetadataValue(filename);
    if (!sanitized) return undefined;
    return { filename: sanitized };
  }

  private sanitizeMetadataValue(value: string) {
    if (!value) return "";
    // Azure metadata headers must be ASCII without control chars.
    return value.replace(/[^\x20-\x7E]/g, "").slice(0, 256);
  }
}
