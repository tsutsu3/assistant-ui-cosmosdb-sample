import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { CosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const repository = new CosmosChatRepository();
    const { id } = await params;
    const { title, archived } = await req.json();

    if (
      (typeof title !== "string" || title.trim().length === 0) &&
      typeof archived !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid title and archived" },
        { status: 400 },
      );
    }

    if (typeof title === "string" && title.trim().length > 0) {
      const response = await repository.renameThread(id, title);
      return NextResponse.json(response);
    }

    if (archived === true) {
      const response = await repository.archiveThread(id);
      return NextResponse.json(response);
    } else {
      const response = await repository.unarchiveThread(id);
      return NextResponse.json(response);
    }
  } catch (e) {
    logger.error("PATCH /threads/[id] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const repository = new CosmosChatRepository();
  const { id } = await params;

  try {
    await repository.deleteThread(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logger.error("DELETE /threads/[id] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
