import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { CosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";

export async function GET(req: NextRequest) {
  try {
    const repository = new CosmosChatRepository();
    const response = await repository.listThreads();
    return NextResponse.json(response.threads);
  } catch (e) {
    logger.error("GET /threads error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    const repository = new CosmosChatRepository();
    const thread = await repository.createThread(id);
    return NextResponse.json(thread, { status: 201 });
  } catch (e) {
    logger.error("POST /threads error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
