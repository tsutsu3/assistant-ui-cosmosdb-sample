import {
  ChatRepository,
  ThreadRecord,
  MessageRecord,
} from "@/lib/repositories/chat-repository";
import { ThreadDoc, MessageDoc } from "./types";
import { getMessagesContainer, getThreadsContainer } from "./client";
import {
  toThreadRecord,
  toMessageRecord,
  toThreadDoc,
  toMessageDoc,
} from "./mappers";
import { logger } from "@/lib/logger";

export class CosmosChatRepository implements ChatRepository {
  private readonly threadsContainer = getThreadsContainer();
  private readonly messagesContainer = getMessagesContainer();

  async listThreads(
    limit = 25,
    cursor?: string,
  ): Promise<{
    threads: ThreadRecord[];
    cursor?: string;
  }> {
    const query = "SELECT * FROM c ORDER BY c.updatedAt DESC";

    try {
      const iterator = this.threadsContainer.items.query<ThreadDoc>(
        { query: query },
        { maxItemCount: limit, continuationToken: cursor },
      );

      const response = await iterator.fetchNext();

      const resources = response.resources ?? [];

      logger.debug("listThreads success", {
        limit,
        count: resources.length,
        requestCharge: response.requestCharge,
        hasNext: !!response.continuationToken,
      });

      return {
        threads: resources.map((item) => toThreadRecord(item)),
        cursor: response.continuationToken,
      };
    } catch (error) {
      logger.error("listThreads failed", { cursor, error });
      throw error;
    }
  }

  async createThread(id: string): Promise<ThreadRecord> {
    const now = new Date().toISOString();
    const doc: ThreadDoc = {
      id,
      title: "New chat",
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      const response = await this.threadsContainer.items.create(doc);

      logger.debug("Thread created", {
        id,
        requestCharge: response.requestCharge,
      });

      if (!response.resource) {
        throw new Error("Failed to create thread");
      }

      return toThreadRecord(response.resource);
    } catch (error) {
      logger.error("createThread failed", { id, error });
      throw error;
    }
  }

  async renameThread(id: string, title: string): Promise<ThreadRecord> {
    try {
      const { resource } = await this.threadsContainer
        .item(id, id)
        .read<ThreadDoc>();

      if (!resource) {
        logger.warn("renameThread: thread not found", { id });
        throw new Error("Thread not found");
      }

      const record = toThreadRecord(resource);
      record.title = title;
      record.updatedAt = new Date();

      const updateResponse = await this.threadsContainer.items.upsert(
        toThreadDoc(record),
      );

      logger.debug("renameThread success", {
        id,
        requestCharge: updateResponse.requestCharge,
      });

      return record;
    } catch (error) {
      logger.error("renameThread failed", { id, error });
      throw error;
    }
  }

  async archiveThread(id: string): Promise<ThreadRecord> {
    try {
      const { resource } = await this.threadsContainer
        .item(id, id)
        .read<ThreadDoc>();

      if (!resource) {
        logger.warn("archiveThread: thread not found", { id });
        throw new Error("Thread not found");
      }

      const record = toThreadRecord(resource);
      record.archived = true;
      record.updatedAt = new Date();

      const updateResponse = await this.threadsContainer.items.upsert(
        toThreadDoc(record),
      );

      logger.debug("archiveThread success", {
        id,
        requestCharge: updateResponse.requestCharge,
      });

      return record;
    } catch (error) {
      logger.error("archiveThread failed", { id, error });
      throw error;
    }
  }

  async unarchiveThread(id: string): Promise<ThreadRecord> {
    try {
      const { resource } = await this.threadsContainer
        .item(id, id)
        .read<ThreadDoc>();

      if (!resource) {
        logger.warn("unarchiveThread: thread not found", { id });
        throw new Error("Thread not found");
      }

      const record = toThreadRecord(resource);
      record.archived = false;
      record.updatedAt = new Date();

      const updateResponse = await this.threadsContainer.items.upsert(
        toThreadDoc(record),
      );

      logger.debug("unarchiveThread success", {
        id,
        requestCharge: updateResponse.requestCharge,
      });

      return record;
    } catch (error) {
      logger.error("unarchiveThread failed", { id, error });
      throw error;
    }
  }

  async deleteThread(id: string) {
    try {
      const readResponse = await this.threadsContainer
        .item(id, id)
        .read<ThreadDoc>();

      if (!readResponse.resource) {
        logger.warn("deleteThread: thread not found", { id });
        return;
      }

      logger.debug("deleteThread: read thread", {
        id,

        requestCharge: readResponse.requestCharge,
      });

      // Get all messages in the thread
      const queryResponse = await this.messagesContainer.items
        .query<MessageDoc>({
          query: "SELECT * FROM c WHERE c.threadId = @threadId",
          parameters: [{ name: "@threadId", value: id }],
        })
        .fetchAll();

      logger.debug("deleteThread: query messages", {
        id,

        messageCount: queryResponse.resources.length,
        requestCharge: queryResponse.requestCharge,
      });

      // Delete all messages in the thread (Not batch delete)
      const deleteMessageResponses = await Promise.all(
        queryResponse.resources.map((m) =>
          this.messagesContainer.item(m.id, m.id).delete(),
        ),
      );

      logger.debug("deleteThread: messages deleted", {
        id,
        messageCount: deleteMessageResponses.length,
        totalRequestCharge: deleteMessageResponses.reduce(
          (sum, res) => sum + (res.requestCharge ?? 0),
          0,
        ),
      });

      // Delete the thread
      const deleteThreadResponse = await this.threadsContainer
        .item(id, id)
        .delete();

      logger.debug("deleteThread: thread deleted", {
        id,
        requestCharge: deleteThreadResponse.requestCharge,
      });

      logger.debug("deleteThread success", { id });
    } catch (error) {
      logger.error("deleteThread failed", { id, error });
      throw error;
    }
  }

  async getThread(id: string): Promise<ThreadRecord | null> {
    throw new Error("Not implemented");
    // try {
    //   const response = await this.threadsContainer
    //     .item(id, id)
    //     .read<ThreadDoc>();

    //   if (!response.resource) {
    //     logger.warn("getThread: thread not found", { id });
    //     return null;
    //   }

    //   logger.debug("getThread success", {
    //     id,
    //     requestCharge: response.requestCharge,
    //   });

    //   return toThreadRecord(response.resource);
    // } catch (error) {
    //   logger.error("getThread failed", { id, error });
    //   throw error;
    // }
  }

  async getMessages(threadId: string): Promise<MessageRecord[]> {
    try {
      const response = await this.messagesContainer.items
        .query<MessageDoc>({
          query:
            "SELECT * FROM c WHERE c.threadId = @threadId ORDER BY c.createdAt ASC",
          parameters: [{ name: "@threadId", value: threadId }],
        })
        .fetchAll();

      logger.debug("getMessages success", {
        threadId,
        count: response.resources.length,
        requestCharge: response.requestCharge,
      });

      return response.resources.map(toMessageRecord);
    } catch (error) {
      logger.error("getMessages failed", { threadId, error });
      throw error;
    }
  }

  async appendMessage(msg: MessageRecord): Promise<MessageRecord> {
    try {
      const response = await this.messagesContainer.items.create(
        toMessageDoc(msg),
      );

      logger.debug("appendMessage success", {
        threadId: msg.threadId,
        messageId: msg.id,
        requestCharge: response.requestCharge,
      });

      return toMessageRecord(response.resource!);
    } catch (error) {
      logger.error("appendMessage failed", {
        threadId: msg.threadId,
        messageId: msg.id,
        error,
      });
      throw error;
    }
  }
}

let sharedCosmosChatRepository: CosmosChatRepository | null = null;

export function getCosmosChatRepository(): CosmosChatRepository {
  if (!sharedCosmosChatRepository) {
    sharedCosmosChatRepository = new CosmosChatRepository();
  }
  return sharedCosmosChatRepository;
}
