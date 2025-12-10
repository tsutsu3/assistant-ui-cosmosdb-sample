export type MessageStatus =
  | {
      readonly type: string;
    }
  | {
      readonly type: string;
      readonly reason: string;
    }
  | {
      readonly type: string;
      readonly reason: string;
      readonly error?: any;
    };

export type MessageRole = "user" | "assistant" | "system";

export interface ThreadRecord {
  id: string;
  title: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  parentId: string | null;
  role: MessageRole;
  status: any;
  content: any;
  attachments: any;
  metadata: any;
  runConfig: any;
  createdAt: Date;
}

export interface ChatRepository {
  listThreads(
    limit?: number,
    cursor?: string,
  ): Promise<{
    threads: ThreadRecord[];
    cursor?: string;
  }>;

  createThread(id: string): Promise<ThreadRecord>;

  renameThread(id: string, title: string): Promise<ThreadRecord>;

  archiveThread(id: string): Promise<ThreadRecord>;

  unarchiveThread(id: string): Promise<ThreadRecord>;

  deleteThread(id: string): Promise<void>;

  getThread(id: string): Promise<ThreadRecord | null>;

  getMessages(id: string): Promise<MessageRecord[]>;

  appendMessage(msg: MessageRecord): Promise<MessageRecord>;
}
