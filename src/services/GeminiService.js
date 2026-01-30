import { GoogleGenerativeAI } from "@google/generative-ai";

// NOTE: In a production environment, this key should be stored in an environment variable
// and accessed via a backend proxy to prevent exposure.
// For this implementation, we are initializing it here as requested.
const API_KEY = "AIzaSyCrBTtjmiKnT4dd6hKSOdQi2zrlyaqrvTw";

let genAI = null;
let model = null;

class GeminiService {
  constructor() {
    this.history = [];
  }

  /**
   * Initializes the Gemini SDK if not already initialized.
   * This ensures single initialization per session (lazy loading).
   */
  initialize() {
    if (!genAI) {
      genAI = new GoogleGenerativeAI(API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      console.log("Gemini SDK Initialized");
    }
  }

  /**
   * Sends a message to the Gemini model and returns the response.
   * @param {string} message - The user's message.
   * @returns {Promise<string>} - The model's response.
   */
  async sendMessage(message) {
    this.initialize();

    try {
      // Simulate server-side safety checks or logging here
      console.log("Sending message to Gemini endpoint...");

      const chat = model.startChat({
        history: this.history,
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      const text = response.text();

      // Update history
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
    this.initialize();

    try {
        const chat = model.startChat({
            history: this.history,
        });

        const result = await chat.sendMessageStream(message);
        
        let fullText = "";
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            onChunk(chunkText);
        }

        // Update history after full stream
        this.history.push({ role: "user", parts: [{ text: message }] });
        this.history.push({ role: "model", parts: [{ text: fullText }] });
        
        return fullText;
    } catch (error) {
        console.error("Gemini Stream Error:", error);
        throw error;
    }
  }

  /**
   * Clears the chat history.
   */
  clearHistory() {
    this.history = [];
  }
}

export default GeminiService;
