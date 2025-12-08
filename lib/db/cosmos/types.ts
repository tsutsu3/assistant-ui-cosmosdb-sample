export type ThreadDoc = {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageDoc = {
  id: string;
  threadId: string;
  parentId: string | null;
  role: string;
  status: string | null;
  content: string;
  metadata: string | null;
  runConfig: string | null;
  createdAt: string;
};

type cosmosMeta = {
  _rid: string;
  _self: string;
  _etag: string;
  _attachments: string;
  _ts: number;
};

export type ResponseThreadDoc = ThreadDoc & cosmosMeta;

export type ResponseMessageDoc = MessageDoc & cosmosMeta;
