import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_INSTRUCTION = `You are CHIRPY, a helpful cyber-tech / IT / emerging-tech assistant inside a website chat UI.

OUTPUT RULES (VERY IMPORTANT):
- Write in clean, readable plain text OR simple Markdown that will render nicely in chat.
- Do NOT show raw Markdown tokens like ###, ****, __, or $...$.
- Do NOT use LaTeX. Use plain text like: O(n), O(n log n), O(1).
- Keep answers short by default: max 8 bullet points OR max 160 words.
- Use this structure:
  1) 1-sentence direct answer
  2) bullets for key points
  3) a tiny example (only if helpful)
- Only include code blocks if the user explicitly asks for code.
- If the user asks something broad, ask 1 quick follow-up question at the end.

STYLE:
- Friendly, clear, student-level explanation.
- No long essays, no multiple headings.`;

export const onRequest = async (context) => {
  const { request, env } = context;

  // Handle CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing Gemini API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, history = [], stream = false } = body;
  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({ history });

    if (stream) {
      const result = await chat.sendMessageStream(message);
      
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // Start streaming response without blocking
      (async () => {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              await writer.write(new TextEncoder().encode(text));
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
          await writer.write(new TextEncoder().encode(`\n[Error: ${err.message}]`));
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return new Response(JSON.stringify({ error: "Gemini request failed: " + error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
