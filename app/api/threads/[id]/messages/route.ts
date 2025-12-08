import { NextRequest, NextResponse } from "next/server";
import { MessageRecord } from "@/lib/repositories/chat-repository";
import { logger } from "@/lib/logger";
import { CosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repository = new CosmosChatRepository();

  try {
    const messages = await repository.getMessages(id);
    return NextResponse.json({ messages });
  } catch (e) {
    logger.error("GET /threads/[id]/messages error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repository = new CosmosChatRepository();
  const body = await req.json();
  const message = body.message;
  const parentId = body.parentId;
  const runConfig = body.runConfig;

  const record: MessageRecord = {
    ...message,
    threadId: id,
    parentId: parentId || null,
    runConfig: runConfig || null,
    createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
  };

  try {
    await repository.appendMessage(record);
    return NextResponse.json(record);
  } catch (e) {
    console.error("POST /threads/[id]/messages error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
