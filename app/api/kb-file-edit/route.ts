import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";

export const maxDuration = 120;

const EDITOR_SYSTEM = `You are a precise document editor using track changes mode. Only change what the user explicitly asks. Leave everything else exactly as written — do not rewrite, restructure, improve, or touch anything the user did not ask about.

Mark changes using ONLY these tokens:
- Text to delete: [[DEL]]text[[/DEL]]
- Text to add: [[ADD]]text[[/ADD]]

Return the complete document with change markers. No preamble. No explanation. No code fences. Just the document with markers.`;

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

    const userPrompt = `Current document (${fileName || "file"}):\n\n${currentContent || ""}\n\nUser's requested change: ${instruction}`;

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
