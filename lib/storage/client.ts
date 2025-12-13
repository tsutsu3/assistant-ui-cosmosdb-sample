import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
  newPipeline,
} from "@azure/storage-blob";
import { logger } from "@/lib/logger";
import type { ProxySettings } from "./types";

let credential: StorageSharedKeyCredential | null = null;
let serviceClient: BlobServiceClient | null = null;
const containerClients = new Map<string, ContainerClient>();

export function getAzureBlobCredential(): StorageSharedKeyCredential {
  if (credential) return credential;

  const accountName = process.env.AZURE_STORAGE_ACCOUNT;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

  if (!accountName || !accountKey) {
    throw new Error(
      "AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCOUNT_KEY must be set",
    );
  }

  credential = new StorageSharedKeyCredential(accountName, accountKey);
  return credential;
}

export function getAzureBlobServiceClient(): BlobServiceClient {
  if (serviceClient) return serviceClient;

  const accountName = process.env.AZURE_STORAGE_ACCOUNT;
  if (!accountName) {
    throw new Error("AZURE_STORAGE_ACCOUNT must be set");
  }

  const endpoint =
    process.env.AZURE_STORAGE_BLOB_ENDPOINT ||
    `https://${accountName}.blob.core.windows.net`;

  const pipeline = newPipeline(getAzureBlobCredential(), {
    proxyOptions: getProxySettings(),
  });

  serviceClient = new BlobServiceClient(endpoint, pipeline);
  return serviceClient;
}

export function getAzureBlobContainerClient(
  containerName = process.env.AZURE_STORAGE_CONTAINER || "attachments",
): ContainerClient {
  const name = containerName.trim() || "attachments";
  const cached = containerClients.get(name);
  if (cached) return cached;

  const client = getAzureBlobServiceClient().getContainerClient(name);
  containerClients.set(name, client);
  return client;
}

function getProxySettings(): ProxySettings | undefined {
  const proxyUrl = process.env.HTTPS_PROXY;
  if (!proxyUrl) return undefined;

  try {
    const parsed = new URL(proxyUrl);
    return {
      host: parsed.protocol + "//" + parsed.hostname,
      port: Number(parsed.port),
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
