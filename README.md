# 🎙️ MoMo Voice Chat - LiveKit AI Agent Integration

Ứng dụng voice chat real-time kết nối với AI Agent qua LiveKit, cho phép người dùng trò chuyện bằng giọng nói với trợ lý ảo MoMo.

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────┐      HTTPS/WebSocket      ┌──────────────┐
│   Browser   │ ◄─────────────────────────► │    Vercel    │
│  (React UI) │                             │   Frontend   │
└─────────────┘                             └──────────────┘
       │                                            │
       │ WebRTC (Audio Stream)                     │ HTTP POST
       │                                            ▼
       ▼                                    ┌──────────────┐
┌─────────────┐                             │   Vercel     │
│   LiveKit   │ ◄───────────────────────────│  Serverless  │
│    Cloud    │        Create Room/Token    │     API      │
└─────────────┘                             └──────────────┘
       │
       │ WebRTC (AI Response)
       ▼
┌─────────────┐
│  AI Agent   │
│   Server    │
└─────────────┘
```

## 📁 Cấu Trúc Project

```
voice-to-chat/
├── api/                              # Vercel Serverless Functions
│   └── rooms/
│       └── create.ts                 # API tạo LiveKit room + access token
├── frontend/                         # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── VoiceChat.tsx        # Component chính - Voice chat UI & logic
│   │   ├── lib/
│   │   │   └── api.ts               # API client helper
│   │   ├── App.tsx                   # Root component
│   │   ├── main.tsx                  # Entry point
│   │   └── index.css                 # Dark theme styling
│   ├── index.html                    # HTML template
│   ├── package.json                  # Frontend dependencies
│   ├── vite.config.ts                # Vite configuration
│   └── vercel.json                   # Frontend-specific Vercel config
├── package.json                      # Root dependencies (API functions)
├── vercel.json                       # Vercel deployment configuration
└── README.md                         # Documentation

```

## 🔧 Chi Tiết Implementation

### 1. API Serverless Function (`api/rooms/create.ts`)

**Mục đích**: Tạo LiveKit room và generate access token cho client

**Flow hoạt động**:
```typescript
POST /api/rooms/create
Body: { user_name: string, user_id?: string }

1. Validate input (user_name required)
2. Generate unique room name: "momo-room-{timestamp}-{random}"
3. Create LiveKit room via RoomServiceClient
   - emptyTimeout: 600s
   - maxParticipants: 2
4. Generate AccessToken with grants:
   - roomJoin: true
   - canPublish: true (có thể gửi audio)
   - canSubscribe: true (có thể nhận audio)
5. Return: { room_name, token, livekit_url }
```

**Code highlights**:
```typescript
const roomService = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

await roomService.createRoom({
  name: roomName,
  emptyTimeout: 600,      // Room tự động đóng sau 10 phút không có người
  maxParticipants: 2,     // Chỉ user + agent
});

const token = new AccessToken(
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  {
    identity: userId,
    name: user_name,
  }
);

token.addGrant({
  room: roomName,
  roomJoin: true,
  canPublish: true,       // Cho phép gửi audio
  canSubscribe: true,     // Cho phép nhận audio từ agent
});

const jwt = await token.toJwt();
```

### 2. API Client (`frontend/src/lib/api.ts`)

**Mục đích**: Wrapper cho API call từ frontend

```typescript
export async function createRoom(
  userName: string,
  userId?: string
): Promise<RoomCredentials> {
  const response = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: userName, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create room');
  }

  return response.json();
}
```

### 3. Voice Chat Component (`frontend/src/components/VoiceChat.tsx`)

**Component chính** - Quản lý toàn bộ logic voice chat

#### State Management

```typescript
const [room, setRoom] = useState<Room | null>(null);           // LiveKit room instance
const [status, setStatus] = useState<ConnectionStatus>('disconnected');
const [error, setError] = useState<string | null>(null);
const [agentSpeaking, setAgentSpeaking] = useState(false);     // Agent đang nói
```

#### Connection Flow

```typescript
const connect = async () => {
  setStatus('connecting');
  
  // 1. Tạo room và lấy credentials
  const userName = `User-${Date.now()}`;
  const credentials = await createRoom(userName);
  
  // 2. Khởi tạo LiveKit Room
  const newRoom = new Room({
    adaptiveStream: true,   // Tự động điều chỉnh quality
    dynacast: true,         // Tối ưu bandwidth
  });
  
  // 3. Setup event listeners
  newRoom.on(RoomEvent.Connected, () => {
    setStatus('connected');
  });
  
  newRoom.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (track.kind === Track.Kind.Audio) {
      const audioElement = track.attach();  // Tạo <audio> element
      audioElement.play();                  // Play audio từ agent
    }
  });
  
  newRoom.on(RoomEvent.TrackUnmuted, (publication) => {
    if (publication.kind === Track.Kind.Audio) {
      setAgentSpeaking(true);  // Agent bắt đầu nói
    }
  });
  
  // 4. Connect và enable microphone
  await newRoom.connect(credentials.livekit_url, credentials.token);
  await newRoom.localParticipant.setMicrophoneEnabled(true);
  
  setRoom(newRoom);
};
```

#### LiveKit Events Handling

| Event | Mục đích | Handler |
|-------|----------|---------|
| `RoomEvent.Connected` | Kết nối thành công | Set status = 'connected' |
| `RoomEvent.Disconnected` | Mất kết nối | Set status = 'disconnected', reset state |
| `RoomEvent.ParticipantConnected` | Agent join room | Log participant info |
| `RoomEvent.TrackSubscribed` | Nhận audio track từ agent | Attach và play audio |
| `RoomEvent.TrackMuted` | Agent tắt mic | Set agentSpeaking = false |
| `RoomEvent.TrackUnmuted` | Agent bật mic | Set agentSpeaking = true |

#### UI States

```typescript
// State 1: Disconnected - Chờ user bấm nút
{status === 'disconnected' && (
  <button onClick={connect} className="btn-primary">
    📞 Bắt Đầu Cuộc Gọi
  </button>
)}

// State 2: Connecting - Đang kết nối
{status === 'connecting' && (
  <div className="spinner"></div>
)}

// State 3: Connected - Đang trong cuộc gọi
{status === 'connected' && (
  <div className={agentSpeaking ? 'speaking' : 'listening'}>
    {agentSpeaking ? '🎙️ Agent đang nói...' : '✓ Đã kết nối'}
  </div>
)}
```

### 4. Styling (`frontend/src/index.css`)

**Dark Theme Design**:
- Background: `#000000` (pure black)
- Card: `#1a1a1a` với border `#333`
- Text: White/Gray tones
- Status indicators: Green (listening) / Blue (speaking)
- Animations: Pulse effect cho speaking state

```css
body {
  background: #000000;
}

.voice-chat-card {
  background: #1a1a1a;
  border: 1px solid #333;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
}

.status-indicator.speaking .status-dot {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### 5. Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install && cd frontend && npm install",
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

**Key points**:
- Build frontend từ `frontend/` folder
- Install dependencies ở cả root (API) và frontend
- Serverless functions từ `api/` folder
- API routing: `/api/*` → serverless functions

## 🚀 Deployment

### Prerequisites

- Node.js 18+
- GitHub account
- Vercel account
- LiveKit Cloud account với credentials:
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `LIVEKIT_URL`

### Local Development

```bash
# Clone repository
git clone https://github.com/Sang-Nguyen-Phuoc/voice-to-chat.git
cd voice-to-chat

# Install root dependencies (API)
npm install

# Install frontend dependencies
cd frontend
npm install

# Run dev server (frontend only - API won't work)
npm run dev

# OR: Run with Vercel dev (API + Frontend)
cd ..
vercel dev
```

### Deploy to Vercel

#### Via GitHub (Recommended)

1. **Push code to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Import to Vercel**
   - Vào https://vercel.com/new
   - Import repository: `voice-to-chat`
   - Framework: Auto-detected (Vite)
   - Root Directory: **Leave empty** (vercel.json handles this)

3. **Add Environment Variables**
   - Settings → Environment Variables
   - Add:
     - `LIVEKIT_API_KEY` = `APIh9UeDxJ8pvGR`
     - `LIVEKIT_API_SECRET` = `8woHU0Zd23cXbMw4h9nA1JMo1tmD4tBKYm1Vj7OkHfE`
     - `LIVEKIT_URL` = `wss://voice-chat-poc-rp1c8cec.livekit.cloud`
   - Select: Production, Preview, Development

4. **Deploy**
   - Click "Deploy"
   - Wait ~2-3 minutes
   - Visit your deployment URL

#### Via Vercel CLI

```bash
# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add LIVEKIT_API_KEY
vercel env add LIVEKIT_API_SECRET
vercel env add LIVEKIT_URL

# Deploy to production
vercel --prod
```

## 🧪 Testing

### Test API Endpoint

```bash
curl -X POST https://your-app.vercel.app/api/rooms/create \
  -H "Content-Type: application/json" \
  -d '{"user_name":"Test User"}'
```

**Expected response**:
```json
{
  "room_name": "momo-room-1737859200000-abc123",
  "token": "eyJhbGc...",
  "livekit_url": "wss://voice-chat-poc-rp1c8cec.livekit.cloud"
}
```

### Test Voice Chat

1. Mở app: `https://your-app.vercel.app`
2. Click **"📞 Bắt Đầu Cuộc Gọi"**
3. Allow microphone access
4. Status: "✓ Đã kết nối - Hãy nói gì đó"
5. Nói: "Túi thần tài là gì?"
6. Observe: Status changes to "🎙️ Agent đang nói..."
7. Listen to agent response
8. Click **"📞 Kết Thúc Cuộc Gọi"** to disconnect

## 🔍 Troubleshooting

### Common Issues

**1. API returns 500 error**
- Check environment variables are set on Vercel
- Verify LiveKit credentials are correct

**2. "Unexpected token" JSON error**
- API endpoint không khả dụng
- Check Vercel functions logs: `vercel logs`

**3. No audio from agent**
- Check browser console for errors
- Verify microphone permission granted
- Check LiveKit agent server is running

**4. Build failed on Vercel**
- Check `vercel.json` configuration
- Verify all dependencies in `package.json`
- Check Vercel build logs

### Debug Commands

```bash
# View Vercel logs
vercel logs [deployment-url]

# Check environment variables
vercel env ls

# Test build locally
cd frontend && npm run build

# Run TypeScript check
cd frontend && npx tsc --noEmit
```

## 📚 Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool & dev server
- **LiveKit Client SDK 2.0** - WebRTC client

### Backend (Serverless)
- **Vercel Functions** - Serverless API
- **LiveKit Server SDK 2.0** - Room & token management
- **Node.js 18+** - Runtime

### Infrastructure
- **Vercel** - Hosting & deployment
- **LiveKit Cloud** - Real-time media server
- **GitHub** - Version control

## 🔐 Security Notes

- API keys và secrets chỉ lưu trong Vercel environment variables
- Access tokens có thời hạn (theo LiveKit config)
- Room tự động đóng sau 10 phút không hoạt động
- HTTPS/WSS cho tất cả connections

## 📝 License

MIT

## 🙋‍♂️ Support

- GitHub Issues: https://github.com/Sang-Nguyen-Phuoc/voice-to-chat/issues
- LiveKit Docs: https://docs.livekit.io
- Vercel Docs: https://vercel.com/docs

---

**Built with ❤️ using LiveKit + React + Vercel**
