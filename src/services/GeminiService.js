class GeminiService {
  constructor() {
    this.history = [];
  }

  initialize() {
    return;
  }

  async sendMessage(message) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: this.history,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Gemini request failed (${response.status})`);
      }

      const data = await response.json();
      const text = data?.text || '';

      this.history.push({ role: "user", parts: [{ text: message }] });
      this.history.push({ role: "model", parts: [{ text: text }] });

      return text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  /**
   * Stream a message from Gemini
   * @param {string} message 
   * @param {function} onChunk - Callback for each chunk of text
   */
  async streamMessage(message, onChunk) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: this.history,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Gemini request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        if (chunkText) {
          fullText += chunkText;
          onChunk(chunkText);
        }
      }

      this.history.push({ role: "user", parts: [{ text: message }] });
      this.history.push({ role: "model", parts: [{ text: fullText }] });

      return fullText;
    } catch (error) {
      console.error("Gemini Stream Error:", error);
      throw error;
    }
  }

  setHistory(history) {
    this.history = history;
  }

  clearHistory() {
    this.history = [];
  }
}

export default GeminiService;
