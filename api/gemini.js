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

const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing Gemini API key' });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const { message, history = [], stream = false } = body || {};
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({ history });

    if (stream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Transfer-Encoding', 'chunked');
      const result = await chat.sendMessageStream(message);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          res.write(chunkText);
        }
      }
      res.end();
      return;
    }

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ text });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gemini request failed' });
      return;
    }
    res.end();
  }
}
