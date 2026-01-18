# Backend Server cho Voice Chat POC

## Tại sao cần Backend?

Browser WebSocket **không thể** gửi custom headers như `Authorization: Bearer <token>`.
OpenAI Realtime API yêu cầu header này → Cần backend proxy.

## Giải pháp: WebSocket Proxy Server

### Option 1: Simple Node.js Proxy (Khuyến nghị)

Tạo file `server.js`:

```javascript
import WebSocket from "ws";
import { WebSocketServer } from "ws";
import http from "http";

const PORT = 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs, request) => {
  console.log("Client connected");

  // Extract model from query params
  const url = new URL(request.url, `http://${request.headers.host}`);
  const model =
    url.searchParams.get("model") || "gpt-4o-realtime-preview-2024-12-17";

  // Connect to OpenAI with proper headers
  const openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${model}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    },
  );

  // Forward messages: Client → OpenAI
  clientWs.on("message", (data) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(data);
    }
  });

  // Forward messages: OpenAI → Client
  openaiWs.on("message", (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  // Handle errors
  openaiWs.on("error", (error) => {
    console.error("OpenAI WebSocket error:", error);
    clientWs.close();
  });

  clientWs.on("error", (error) => {
    console.error("Client WebSocket error:", error);
    openaiWs.close();
  });

  // Handle closures
  openaiWs.on("close", () => {
    console.log("OpenAI connection closed");
    clientWs.close();
  });

  clientWs.on("close", () => {
    console.log("Client connection closed");
    openaiWs.close();
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket Proxy Server running on ws://localhost:${PORT}`);
});
```

### Setup:

1. **Create server folder:**

```bash
mkdir server
cd server
npm init -y
npm install ws dotenv
```

2. **Create .env in server folder:**

```env
OPENAI_API_KEY=your_key_here
```

3. **Update server/package.json:**

```json
{
  "type": "module",
  "scripts": {
    "start": "node server.js"
  }
}
```

4. **Run server:**

```bash
npm start
```

### Update Frontend:

In `src/config.ts`, add:

```typescript
export const config = {
  openai: {
    apiKey: "", // No longer needed in frontend!
    model: "gpt-4o-realtime-preview-2024-12-17",
    voice: "alloy",
    wsUrl: "ws://localhost:8080", // Use proxy server
  },
  // ...
};
```

In `src/openai-manager.ts`:

```typescript
async connect(): Promise<void> {
  const url = `${config.openai.wsUrl}?model=${config.openai.model}`;
  this.ws = new WebSocket(url);
  // No auth needed - proxy handles it!
}
```

---

### Option 2: Next.js API Route (If using Next.js)

Create `pages/api/realtime.ts`:

```typescript
import { Server } from "ws";
import WebSocket from "ws";

export default function handler(req, res) {
  if (req.method === "GET") {
    const wss = new Server({ noServer: true });

    res.socket.server.on("upgrade", (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Connect to OpenAI
        const openaiWs = new WebSocket(
          "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "OpenAI-Beta": "realtime=v1",
            },
          },
        );

        // Proxy messages
        ws.on("message", (msg) => openaiWs.send(msg));
        openaiWs.on("message", (msg) => ws.send(msg));

        // Handle closures
        ws.on("close", () => openaiWs.close());
        openaiWs.on("close", () => ws.close());
      });
    });

    res.status(200).json({ message: "WebSocket ready" });
  }
}
```

---

## Livekit Token Server

### Option 1: Simple Express Endpoint

```javascript
import express from "express";
import { AccessToken } from "livekit-server-sdk";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/livekit/token", (req, res) => {
  const { roomName, participantName } = req.body;

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: participantName,
    },
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  res.json({ token: token.toJwt() });
});

app.listen(3001, () => {
  console.log("Livekit token server on http://localhost:3001");
});
```

---

## Recommended Architecture

```
┌─────────────┐
│   Browser   │
│   Frontend  │
└──────┬──────┘
       │
       ├─────────────► ws://localhost:8080 (Proxy Server)
       │                     │
       │                     ▼
       │               OpenAI Realtime API
       │               (with proper headers)
       │
       └─────────────► http://localhost:3001/api/livekit/token
                            │
                            ▼
                      Generate JWT securely
```

---

Bạn muốn tôi tạo backend proxy server không?
