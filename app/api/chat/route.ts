import { azure } from "@ai-sdk/azure";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o"),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
