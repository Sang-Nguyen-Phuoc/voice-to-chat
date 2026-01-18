# 📚 Technical Documentation

## 1. Code Analysis

### Overview

The application is a **browser-based voice chat assistant** that integrates:

- **OpenAI Realtime API** for natural language understanding and voice synthesis
- **Livekit** for WebRTC audio streaming infrastructure
- **Function calling** for dynamic tool execution (weather, time, Wikipedia)

### Architecture Pattern

**Event-Driven Architecture** with a bidirectional audio bridge pattern.

---

## 2. Module Breakdown

### 2.1 Config Module (`src/config.ts`)

**Purpose:** Centralized configuration and validation

```typescript
export const config = {
  openai: {
    apiKey: string, // From VITE_OPENAI_API_KEY
    model: string, // gpt-4o-realtime-preview-2024-12-17
    voice: string, // 'alloy' (Vietnamese support)
  },
  livekit: {
    url: string, // WebSocket URL
    apiKey: string, // API credentials
    apiSecret: string,
  },
  room: {
    name: string, // 'test-room'
    participantName: string,
  },
};
```

**Key Function:**

- `validateConfig()` - Ensures all required env vars are set before connection

---

### 2.2 OpenAI Manager (`src/openai-manager.ts`)

**Responsibilities:**

- Establish WebSocket connection to OpenAI Realtime API
- Send/receive audio streams (PCM16 format)
- Handle function call requests
- Manage conversation state

**Key Methods:**

```typescript
class OpenAIManager {
  async connect(): Promise<void>;
  // Connects to wss://api.openai.com/v1/realtime

  async configureSession(): Promise<void>;
  // Sets up Vietnamese instructions, VAD, tools

  sendAudio(audioData: Int16Array): void;
  // Sends PCM16 audio to OpenAI

  sendFunctionResult(callId: string, result: any): void;
  // Returns function execution result to AI

  on(eventType: string, handler: Function): void;
  // Event emitter pattern for async events
}
```

**Events Emitted:**

- `sessionCreated` - Session initialized
- `speechStarted` - User began speaking
- `speechStopped` - User stopped speaking
- `audioResponse` - AI audio chunk received
- `functionCall` - AI requested function execution
- `transcript` - Speech-to-text result
- `error` - Error occurred

**Audio Flow:**

1. Receives PCM16 audio from browser
2. Converts to base64
3. Sends via WebSocket as `input_audio_buffer.append`
4. OpenAI processes with VAD (Voice Activity Detection)
5. Returns audio response as `response.audio.delta` events

---

### 2.3 Livekit Manager (`src/livekit-manager.ts`)

**Responsibilities:**

- Manage Livekit room connection
- Publish local microphone audio
- Handle WebRTC audio streaming
- Audio format conversions (Float32 ↔ Int16)

**Key Methods:**

```typescript
class LivekitManager {
  async connect(roomName: string): Promise<void>;
  // Connects to Livekit room with JWT token

  async publishMicrophone(): Promise<void>;
  // Publishes local audio track

  async playAudio(audioData: string | Int16Array): Promise<void>;
  // Plays AI response through speakers

  on(eventType: string, handler: Function): void;
  // Event emitter for audio events
}
```

**Audio Processing:**

```typescript
// Capture user audio
ScriptProcessor.onaudioprocess → Float32Array → Int16Array → emit('userAudio')

// Play AI audio
base64 → Int16Array → Float32Array → AudioBuffer → play()
```

**Events Emitted:**

- `userAudio` - Audio captured from microphone
- `connected` - Connected to room
- `disconnected` - Disconnected from room
- `microphonePublished` - Mic track published

---

### 2.4 Audio Bridge (`src/audio-bridge.ts`)

**Purpose:** Connect OpenAI and Livekit in a bidirectional flow

**Architecture:**

```
User Speaks → Livekit captures → Bridge → OpenAI processes
AI Responds ← Livekit plays ← Bridge ← OpenAI sends audio
Function Call → Bridge → Execute → Return result → OpenAI
```

**Implementation:**

```typescript
class AudioBridge {
  setupBridge(): void {
    // 1. User audio: Livekit → OpenAI
    livekitManager.on("userAudio", (audio) => {
      openaiManager.sendAudio(audio);
    });

    // 2. AI audio: OpenAI → Livekit
    openaiManager.on("audioResponse", (audio) => {
      livekitManager.playAudio(audio);
    });

    // 3. Function calls: OpenAI → Execute → OpenAI
    openaiManager.on("functionCall", async ({ callId, name, arguments }) => {
      const result = await executeFunctionCall(name, arguments);
      openaiManager.sendFunctionResult(callId, result);
    });
  }
}
```

---

### 2.5 Function Registry (`src/function-registry.ts`)

**Purpose:** Define and execute AI function calls

**Function Definitions:**

```typescript
[
  {
    type: "function",
    name: "getCurrentWeather",
    description: "Lấy thông tin thời tiết...",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "..." },
        country: { type: "string", default: "Việt Nam" },
      },
      required: ["city"],
    },
  },
  // getCurrentTime, searchWikipedia...
];
```

**Execution Flow:**

```typescript
executeFunctionCall(name, argsJson) →
  Parse JSON args →
  Switch on function name →
  Execute implementation →
  Return result
```

**Implementations:**

1. **getCurrentWeather(city, country)**
   - Returns mock weather data
   - TODO: Integrate OpenWeatherMap API

2. **getCurrentTime(timezone)**
   - Uses `Date.toLocaleString()` with timezone
   - Returns formatted Vietnamese datetime

3. **searchWikipedia(query)**
   - Fetches from `vi.wikipedia.org/api/rest_v1/page/summary`
   - Returns title, summary, URL

---

### 2.6 Main Application (`src/main.ts`)

**Purpose:** UI orchestration and lifecycle management

**Initialization Flow:**

```typescript
initApp() →
  validateConfig() →
  setupUIListeners() →
  Wait for user click "Connect & Start" →
  handleConnect()
```

**Connection Flow:**

```typescript
handleConnect() →
  1. Create managers (Livekit, OpenAI, Bridge)
  2. Connect to OpenAI + configure session
  3. Connect to Livekit room
  4. Publish microphone
  5. Setup audio bridge
  6. Update UI (enable disconnect, show status)
```

**UI Updates:**

- Status indicators (OpenAI, Livekit, Audio)
- Chat log with conversation history
- Error messages and system notifications

---

## 3. Data Flow Diagrams

### 3.1 User Speech → AI Response

```
┌──────────┐
│  User    │ Speaks
│  (Mic)   │
└────┬─────┘
     │
     ▼
┌──────────────────┐
│ Browser MediaAPI │ getUserMedia()
│ (AudioContext)   │
└────┬─────────────┘
     │ Float32Array
     ▼
┌──────────────────┐
│ LivekitManager   │ floatTo16BitPCM()
│ ScriptProcessor  │
└────┬─────────────┘
     │ Int16Array
     ▼
┌──────────────────┐
│  Audio Bridge    │ Forward audio
└────┬─────────────┘
     │ Int16Array
     ▼
┌──────────────────┐
│ OpenAIManager    │ Convert to base64
│ WebSocket        │ Send via WS
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ OpenAI Realtime  │ Process with GPT-4
│     API          │ + Whisper transcription
│                  │ + Voice synthesis
└────┬─────────────┘
     │ base64 audio chunks
     ▼
┌──────────────────┐
│ OpenAIManager    │ Emit 'audioResponse'
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│  Audio Bridge    │ Forward to Livekit
└────┬─────────────┘
     │ base64
     ▼
┌──────────────────┐
│ LivekitManager   │ base64 → Int16 → Float32
│ AudioContext     │ Create AudioBuffer
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│   Speakers       │ Play audio
└──────────────────┘
```

### 3.2 Function Call Flow

```
User: "Thời tiết Hà Nội thế nào?"
  │
  ▼
OpenAI processes (GPT-4)
  │
  ▼
Determines: Need to call getCurrentWeather("Hà Nội")
  │
  ▼
Sends: response.function_call_arguments.done
  │
  ▼
OpenAIManager emits 'functionCall' event
  │
  ▼
AudioBridge catches event
  │
  ▼
executeFunctionCall("getCurrentWeather", '{"city":"Hà Nội"}')
  │
  ▼
FunctionRegistry executes
  │
  ▼
Returns: { temperature: 28, description: "Trời nắng", ... }
  │
  ▼
AudioBridge sends result back via:
openaiManager.sendFunctionResult(callId, result)
  │
  ▼
OpenAI receives result
  │
  ▼
Generates natural language response:
"Thời tiết Hà Nội hiện tại 28 độ C, trời nắng có mây..."
  │
  ▼
Sends audio response
  │
  ▼
User hears response through speakers
```

---

## 4. Key Design Decisions

### 4.1 Why Browser-Only Architecture?

**Decision:** Pure browser app (no Node.js backend)

**Rationale:**

- `AudioContext` API only available in browsers
- Simpler deployment (static hosting)
- Better for POC - no server management
- WebRTC works natively in browsers

**Trade-off:**

- Security: Livekit token generation client-side (not recommended for production)
- Solution: Add backend API for token generation in production

---

### 4.2 Why Event Emitter Pattern?

**Decision:** Use event emitters instead of callbacks

**Rationale:**

- Decouples components (OpenAI ↔ Livekit don't know about each other)
- Easy to add new event listeners
- Better for async operations
- Cleaner than callback hell

**Implementation:**

```typescript
class Manager {
  private eventHandlers = new Map<string, Function[]>();

  on(event: string, handler: Function) {
    this.eventHandlers.get(event)?.push(handler);
  }

  private emit(event: string, data: any) {
    this.eventHandlers.get(event)?.forEach((h) => h(data));
  }
}
```

---

### 4.3 Why PCM16 Audio Format?

**Decision:** Use PCM16 (16-bit linear PCM) for all audio

**Rationale:**

- OpenAI Realtime API accepts PCM16
- Easy conversion between Float32 (browser) and Int16 (OpenAI)
- Lossless audio quality
- Sample rate: 24kHz (good balance of quality/bandwidth)

**Conversion:**

```typescript
// Browser → OpenAI
Float32Array → Int16Array → base64 → WebSocket

// OpenAI → Browser
base64 → Int16Array → Float32Array → AudioBuffer
```

---

### 4.4 Why Vite Instead of Webpack?

**Decision:** Use Vite for build tooling

**Rationale:**

- Faster dev server (ESBuild)
- Native ES modules support
- Better TypeScript integration
- Simpler configuration
- Hot Module Replacement (HMR)

---

## 5. Error Handling Strategy

### 5.1 Configuration Errors

```typescript
validateConfig() {
  // Throws descriptive error with setup instructions
  // Caught in initApp() → shown to user
}
```

### 5.2 Connection Errors

```typescript
try {
  await openaiManager.connect();
} catch (error) {
  logToChat("system", `❌ OpenAI connection failed: ${error.message}`);
  // Reset UI state
  // Clean up partial connections
}
```

### 5.3 Function Execution Errors

```typescript
try {
  const result = await executeFunctionCall(name, args);
  return result;
} catch (error) {
  console.error("Function error:", error);
  return { error: "Function execution failed" };
  // OpenAI will inform user naturally
}
```

---

## 6. Security Considerations

### 6.1 Current (POC)

- ✅ API keys in `.env.local` (gitignored)
- ⚠️ Client-side Livekit token generation
- ✅ No hardcoded secrets in code

### 6.2 Production Recommendations

1. **Server-side token generation:**

   ```typescript
   // Backend API endpoint
   POST /api/livekit/token
   {
     "room": "test-room",
     "identity": "user123"
   }
   →
   {
     "token": "eyJhbGc..."
   }
   ```

2. **Environment variable validation:**
   - Use schema validation (Zod, Yup)
   - Fail fast on missing vars

3. **Rate limiting:**
   - Limit API calls per user
   - Prevent abuse

4. **Content moderation:**
   - Filter inappropriate content
   - Log conversations for compliance

---

## 7. Performance Considerations

### 7.1 Audio Buffering

- Queue audio chunks to prevent choppy playback
- Current: Simple queue in `LivekitManager.playAudio()`

### 7.2 Memory Management

- Audio buffers are automatically garbage collected
- WebSocket connections cleaned up on disconnect

### 7.3 Network Optimization

- PCM16 at 24kHz = ~48KB/sec
- WebSocket compression enabled
- Consider Opus codec for production

---

## 8. Testing Strategy

### 8.1 Manual Testing Checklist

- [ ] Configuration validation works
- [ ] OpenAI connection succeeds
- [ ] Livekit connection succeeds
- [ ] Microphone permission requested
- [ ] Audio captured from microphone
- [ ] AI responds with voice
- [ ] Function calls execute correctly
- [ ] UI updates reflect status
- [ ] Disconnect cleans up properly

### 8.2 Test Scenarios

1. **Happy Path:** User asks weather → AI calls function → responds
2. **Error Path:** Invalid API key → Shows error message
3. **Network Issue:** Connection drops → Reconnect logic
4. **Permission Denied:** User denies mic → Show helpful message

---

## 9. Future Enhancements

### 9.1 Priority 1

- [ ] Server-side Livekit token generation
- [ ] Real weather API integration
- [ ] Error recovery and auto-reconnect

### 9.2 Priority 2

- [ ] Audio recording/playback history
- [ ] Multi-user rooms
- [ ] Custom AI personality configuration

### 9.3 Priority 3

- [ ] Mobile app (React Native)
- [ ] Voice activity visualization
- [ ] Analytics and usage tracking

---

## 10. Deployment Guide

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
# Output: dist/
```

### Deploy to Vercel

```bash
vercel deploy
```

### Deploy to Netlify

```bash
netlify deploy --prod --dir=dist
```

### Environment Variables (Production)

Set in hosting platform:

- `VITE_OPENAI_API_KEY`
- `VITE_LIVEKIT_URL`
- `VITE_LIVEKIT_API_KEY`
- `VITE_LIVEKIT_API_SECRET`

---

**End of Technical Documentation**
