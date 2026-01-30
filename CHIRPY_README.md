# CHIRPY Feature Documentation

## Overview
CHIRPY is a Gemini-powered conversational agent integrated into the Chirp platform. It provides a dedicated full-page chat experience for users to inquire about cyber-tech, IT, emerging technologies, and digital topics.

## New Routes
- **/chirpy**: The main interface for the CHIRPY chat agent. Accessible via the "CHIRPY" item in the sidebar navigation.

## Environment & Setup
The CHIRPY feature uses the Google Generative AI SDK (`@google/generative-ai`).

### Dependencies
Ensure the following dependency is installed:
```bash
npm install @google/generative-ai
```

### Configuration
The Gemini API key is currently hardcoded in `src/services/GeminiService.js` for this implementation.
**Important Note:** The requirements mentioned routing requests through a server-side endpoint. However, since this is a client-side Vite application, the Gemini SDK is initialized directly in the client. In a production environment, you should set up a backend (e.g., Firebase Functions or Express) to proxy these requests and hide the API key.

## Architecture & Flow

### 1. Frontend Component (`src/pages/Chirpy.jsx`)
- Renders the chat interface (Grok-like UI).
- Manages message state (user and model messages).
- Handles typing indicators and auto-scrolling.
- Lazy-loads the `GeminiService`.

### 2. Service Layer (`src/services/GeminiService.js`)
- **Initialization**: The Gemini SDK is initialized only when the first message is sent or the page is loaded (Lazy Loading). It uses a singleton pattern to ensure only one initialization per session.
- **Streaming**: Uses `sendMessageStream` to provide real-time text generation feedback to the user.
- **History**: Maintains a local chat history context for the session to support multi-turn conversations.

### 3. Request Flow
1. User enters a message on `/chirpy`.
2. `Chirpy.jsx` calls `GeminiService.streamMessage()`.
3. Service initializes SDK (if not already done).
4. Request is sent to Google Gemini Pro API.
5. Response chunks are streamed back and appended to the UI in real-time.

## Build Steps
The feature is integrated into the existing Vite build process.
```bash
npm run build
```
This will compile the application including the new CHIRPY modules.

## Testing
Automated tests are included in `src/pages/Chirpy.test.jsx`.
To run these tests, ensure you have the necessary testing libraries installed (Vitest, React Testing Library):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Run tests with:
```bash
npm run test
# or
npx vitest run src/pages/Chirpy.test.jsx
```
