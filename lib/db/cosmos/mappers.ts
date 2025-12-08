import {
  ThreadDoc,
  MessageDoc,
  ResponseThreadDoc,
  ResponseMessageDoc,
} from "./types";
import {
  ThreadRecord,
  MessageRecord,
} from "@/lib/repositories/chat-repository";

export function toThreadRecord(
  doc: ThreadDoc | ResponseThreadDoc,
): ThreadRecord {
  return {
    id: doc.id,
    title: doc.title,
    archived: doc.archived,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

export function toThreadDoc(rec: ThreadRecord): ThreadDoc {
  return {
    ...rec,
    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
  };
}

export function toMessageRecord(
  doc: MessageDoc | ResponseMessageDoc,
): MessageRecord {
  return {
    id: doc.id,
    threadId: doc.threadId,
    parentId: doc.parentId,
    role: doc.role as MessageRecord["role"],
    status: doc.status,
    content: doc.content,
    metadata: doc.metadata,
    runConfig: doc.runConfig,
    createdAt: new Date(doc.createdAt),
  };
}

export function toMessageDoc(rec: MessageRecord): MessageDoc {
  return {
    ...rec,
    createdAt: rec.createdAt.toISOString(),
  };
}
