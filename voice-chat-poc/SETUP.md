# 🚀 Quick Setup Guide

## ⏱️ 5-Minute Setup

### Step 1: Install Dependencies ✅ (DONE)

```bash
npm install
```

### Step 2: Configure Credentials

Your `.env.local` file is already created with the credentials from the instruction.

**Verify it contains:**

```env
VITE_OPENAI_API_KEY=sk-proj-...
VITE_LIVEKIT_URL=wss://voice-chat-poc-rp1c8cec.livekit.cloud
VITE_LIVEKIT_API_KEY=APIkWwZkzqB2mHT
VITE_LIVEKIT_API_SECRET=dBWSfzAfsCx36rsIJe362Ay951sJglhEi3vBgKBzjDNA
```

### Step 3: Run the App

```bash
npm run dev
```

Browser will open at: `http://localhost:3000`

---

## 🎯 Testing the App

1. **Click "Connect & Start"** button
2. **Allow microphone** when browser asks
3. **Wait for green status** (🟢 Connected)
4. **Start speaking** in Vietnamese:
   - "Xin chào"
   - "Thời tiết Hà Nội thế nào?"
   - "Mấy giờ rồi?"
   - "Tìm kiếm Hồ Chí Minh"

---

## ✅ What Was Built

### Architecture: **Pure Browser App** (Vite + TypeScript)

- ✅ No Node.js server needed
- ✅ All browser-native APIs (AudioContext, WebSocket)
- ✅ Proper TypeScript types
- ✅ Clean module structure

### Features Implemented:

- ✅ Voice input via browser microphone
- ✅ OpenAI Realtime API integration
- ✅ Livekit audio streaming
- ✅ Function calling (3 functions)
- ✅ Vietnamese language support
- ✅ Modern UI with status indicators
- ✅ Conversation logging
- ✅ Error handling

### Security:

- ✅ `.gitignore` protects `.env` files
- ✅ Credentials in `.env.local` (not committed)
- ✅ `.env.example` for reference

---

## 📂 File Structure

```
voice-chat-poc/
├── .env.local              # Your credentials (gitignored)
├── .env.example            # Template
├── .gitignore              # Protects secrets
├── package.json            # Vite + TypeScript setup
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Build config
├── index.html              # HTML entry
├── README.md               # Full documentation
├── SETUP.md                # This file
└── src/
    ├── main.ts             # App entry + UI
    ├── config.ts           # Environment config
    ├── openai-manager.ts   # OpenAI Realtime API
    ├── livekit-manager.ts  # Audio I/O
    ├── audio-bridge.ts     # Connects OpenAI ↔ Livekit
    ├── function-registry.ts # Tools (weather, time, wiki)
    └── style.css           # UI styles
```

---

## 🔧 Available Commands

```bash
# Development (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## ⚠️ Known Limitations (POC)

1. **Livekit Token Generation**
   - Currently uses client-side approach
   - For production: implement server-side token generation

2. **Function Implementations**
   - Weather data is mocked
   - For production: integrate real APIs (OpenWeatherMap)

3. **Browser Support**
   - Requires modern browser with WebRTC
   - HTTPS needed for microphone in production

---

## 🐛 Common Issues

### "Missing environment variables"

→ Check `.env.local` exists and has all 4 variables
→ Restart dev server: `Ctrl+C` then `npm run dev`

### "OpenAI connection failed"

→ Verify API key is valid
→ Check you have Realtime API access

### "No audio"

→ Allow microphone permissions
→ Check browser console for errors

---

## 🎉 Next Steps

1. **Test the current implementation**
2. **Customize AI instructions** in `src/openai-manager.ts`
3. **Add more functions** in `src/function-registry.ts`
4. **Integrate real APIs** (weather, etc.)
5. **Deploy to production** (Vercel/Netlify)

---

## 📝 Key Differences from Original Instruction

| Original         | Implementation     | Reason                     |
| ---------------- | ------------------ | -------------------------- |
| Node.js backend  | Pure browser app   | AudioContext needs browser |
| `dotenv` package | Vite env variables | Browser compatibility      |
| `ws` package     | Native WebSocket   | Browser has built-in WS    |
| `ts-node`        | Vite dev server    | Better DX for frontend     |

---

**Ready to go! Run `npm run dev` and start testing! 🚀**
