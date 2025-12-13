import { NextResponse, NextRequest } from "next/server";
import { azure } from "@ai-sdk/azure";
import { generateText } from "ai";
import { logger } from "@/lib/logger";
import { getCosmosChatRepository } from "@/lib/db/cosmos/cosmos-chat-repository";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const repository = getCosmosChatRepository();
  const { id } = await params;
  const body = await req.json();
  const messages: { content: any }[] = body.messages ?? [];

  const textForTitle = messages
    .map((m) =>
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    )
    .join(" ")
    .slice(0, 500); // Prevent too long input

  try {
    const result = await generateText({
      model: azure.responses(
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      ),
      prompt: `Generate a concise title from the following conversation:\n\n${textForTitle}`,
    });

    // "My Title" -> My Title
    const title = result.text.trim().replaceAll('"', "");

    const response = await repository.renameThread(id, title);

    return NextResponse.json(response);
  } catch (e) {
    logger.error("POST /threads/[id]/title error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
