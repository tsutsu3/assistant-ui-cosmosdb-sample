import { CosmosClient, Database, Container } from "@azure/cosmos";
import { CONTAINER_THREADS, CONTAINER_MESSAGES } from "@/lib/constants";
import { HttpsProxyAgent } from "https-proxy-agent";

let client: CosmosClient | null = null;
let database: Database | null = null;
let threadsContainer: Container | null = null;
let messagesContainer: Container | null = null;

export function getCosmosClient(): CosmosClient {
  if (client) return client;

  const agent = process.env.HTTPS_PROXY
    ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
    : undefined;

  client = new CosmosClient({
    endpoint: process.env.AZURE_COSMOS_DB_ENDPOINT,
    key: process.env.AZURE_COSMOS_DB_KEY,
    agent,
  });

  return client;
}

export function getCosmosDatabase(): Database {
  if (database) return database;

  const dbClient = getCosmosClient();

  database = dbClient.database(
    process.env.AZURE_COSMOS_DB_NAME || "assistant-ui-db",
  );
  return database;
}

export function getCosmosContainer(containerName: string): Container {
  return getCosmosDatabase().container(containerName);
}

export function getThreadsContainer(): Container {
  if (threadsContainer) return threadsContainer;
  threadsContainer = getCosmosDatabase().container(CONTAINER_THREADS);
  return threadsContainer;
}

export function getMessagesContainer(): Container {
  if (messagesContainer) return messagesContainer;
  messagesContainer = getCosmosDatabase().container(CONTAINER_MESSAGES);
  return messagesContainer;
}
