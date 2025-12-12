import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  newPipeline,
} from "@azure/storage-blob";
import type { ProxySettings } from "@azure/core-rest-pipeline";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { logger } from "@/lib/logger";
import {
  ObjectStorageRepository,
  UploadFileParams,
  UploadedFile,
} from "@/lib/repositories/storage-repository";

type AzureBlobRepositoryOptions = {
  containerName?: string;
  /**
   * Prefix to group blobs logically (e.g. "attachments/2025/01").
   */
  pathPrefix?: string;
  /**
   * Default expiration (seconds) for temporary download URLs.
   */
  urlExpirationSeconds?: number;
};

export class AzureBlobAttachmentRepository implements ObjectStorageRepository {
  private readonly containerClient: ContainerClient;
  private readonly credential: StorageSharedKeyCredential;
  private readonly defaultUrlExpiration: number;
  private containerReady?: Promise<void>;

  constructor(options: AzureBlobRepositoryOptions = {}) {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    if (!accountName || !accountKey) {
      throw new Error(
        "AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCOUNT_KEY must be set",
      );
    }

    this.credential = new StorageSharedKeyCredential(accountName, accountKey);
    const pipeline = newPipeline(this.credential, {
      proxyOptions: this.getProxySettings(),
    });

    const endpoint =
      process.env.AZURE_STORAGE_BLOB_ENDPOINT ||
      `https://${accountName}.blob.core.windows.net`;

    const blobServiceClient = new BlobServiceClient(endpoint, pipeline);
    const containerName =
      options.containerName ||
      process.env.AZURE_STORAGE_CONTAINER ||
      "attachments";

    this.containerClient = blobServiceClient.getContainerClient(containerName);
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

  private getProxySettings(): ProxySettings | undefined {
    const proxyUrl = process.env.HTTPS_PROXY;
    if (!proxyUrl) return undefined;

    try {
      const parsed = new URL(proxyUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
      };
    } catch (error) {
      logger.warn("Failed to parse HTTPS_PROXY - ignoring proxy settings", {
        proxyUrl,
        error,
      });
      return undefined;
    }
  }

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
      metadata: {
        filename: params.filename,
      },
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
}
