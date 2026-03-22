import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";

export const maxDuration = 120;

const EDITOR_SYSTEM = `You are a precise document editor. The user will give you a file and a requested change. Rewrite the entire file incorporating the change. Return ONLY the complete rewritten file content with no preamble, no explanation, no markdown code fences. Just the raw file content ready to save.`;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("wyle_auth");
  if (auth?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { fileName, currentContent, instruction } = await req.json();

    if (!instruction?.trim()) {
      return Response.json({ error: "instruction is required" }, { status: 400 });
    }

    const userPrompt = `Here is the current content of ${fileName || "the file"}:\n\n${currentContent || ""}\n\nUser's requested change: ${instruction}\n\nRewrite the entire file incorporating this change. Return ONLY the complete rewritten file content.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      system: EDITOR_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
