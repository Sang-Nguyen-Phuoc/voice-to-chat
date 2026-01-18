# 🎙️ AI Voice Chat Assistant POC

> Proof of Concept for voice-based chatbot using OpenAI Realtime API and Livekit

## 📋 Overview

This project demonstrates a **voice-based AI assistant** that:

- ✅ Accepts voice input from users via browser microphone
- ✅ Processes audio using OpenAI's Realtime API
- ✅ Responds with natural Vietnamese voice
- ✅ Supports function calling (weather, time, Wikipedia search)
- ✅ Uses Livekit for audio streaming infrastructure

---

## 🏗️ Architecture

### **Pure Browser Application** (Vite + TypeScript)

```
┌─────────────┐
│   Browser   │
│   (User)    │
└──────┬──────┘
       │ Microphone
       ▼
┌─────────────────┐
│ Livekit Manager │ ◄───┐
│  (Audio I/O)    │     │
└────────┬────────┘     │
         │              │ Audio Bridge
         │              │
    ┌────▼─────────────▼──┐
    │   Audio Bridge       │
    │ (Bidirectional Flow) │
    └────┬─────────────┬──┘
         │             │
         ▼             ▼
┌─────────────────┐ ┌──────────────────┐
│ OpenAI Manager  │ │ Function Registry│
│ (Realtime API)  │ │ (Tool Calling)   │
└─────────────────┘ └──────────────────┘
```

### **Component Responsibilities**

| Component             | Responsibility                                           |
| --------------------- | -------------------------------------------------------- |
| **Livekit Manager**   | Audio capture, playback, WebRTC connection               |
| **OpenAI Manager**    | WebSocket to OpenAI, audio streaming, session management |
| **Audio Bridge**      | Connects Livekit ↔ OpenAI, handles function calls        |
| **Function Registry** | Tool definitions & implementations (weather, time, wiki) |
| **Config**            | Environment variables, validation                        |
| **Main**              | UI logic, initialization, event handling                 |

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

- **Node.js** 18+ (for development server)
- **npm** or **yarn**
- **OpenAI API Key** (with Realtime API access)
- **Livekit Account** (free tier available)
- **Modern Browser** (Chrome, Edge, Firefox recommended)

### 2️⃣ Installation

```bash
# Clone or navigate to project directory
cd voice-chat-poc

# Install dependencies
npm install
```

### 3️⃣ Configuration

1. **Copy environment template:**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your credentials in `.env.local`:**

   ```env
   # Get from: https://platform.openai.com/api-keys
   VITE_OPENAI_API_KEY=sk-proj-...

   # Get from: https://cloud.livekit.io/
   VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
   VITE_LIVEKIT_API_KEY=APIxxxx...
   VITE_LIVEKIT_API_SECRET=xxx...
   ```

3. **Verify configuration:**
   - OpenAI API key starts with `sk-proj-` or `sk-`
   - Livekit URL starts with `wss://`
   - All fields are filled

### 4️⃣ Run Development Server

```bash
npm run dev
```

Browser will open automatically at `http://localhost:3000`

---

## 🎯 Usage

### **Step-by-Step Guide**

1. **Open the Application**
   - Navigate to `http://localhost:3000` in your browser

2. **Click "Connect & Start"**
   - The app will connect to OpenAI and Livekit
   - Allow microphone access when prompted

3. **Wait for Connection**
   - Status indicators will turn 🟢 green when ready
   - Chat log will show "Connection successful!"

4. **Start Speaking**
   - Speak in Vietnamese (or English)
   - AI will respond via your speakers/headphones

### **Example Questions**

```
🗣️ User: "Xin chào, bạn là ai?"
🤖 AI:   "Xin chào! Tôi là trợ lý AI..."

🗣️ User: "Thời tiết ở Hà Nội thế nào?"
🤖 AI:   "Thời tiết Hà Nội hiện tại 28 độ C, trời nắng có mây..."

🗣️ User: "Mấy giờ rồi?"
🤖 AI:   "Bây giờ là 14 giờ 30 phút..."

🗣️ User: "Tìm kiếm thông tin về Hồ Chí Minh"
🤖 AI:   "Hồ Chí Minh là vị lãnh tụ..."
```

---

## 🔧 Available Functions

The AI can call these functions during conversation:

### **1. getCurrentWeather**

```typescript
// Returns mock weather data for Vietnamese cities
Parameters:
  - city: string (Hà Nội, Hồ Chí Minh, Đà Nẵng)
  - country: string (default: "Việt Nam")
```

### **2. getCurrentTime**

```typescript
// Returns current time in Vietnamese format
Parameters:
  - timezone: string (default: "Asia/Ho_Chi_Minh")
```

### **3. searchWikipedia**

```typescript
// Searches Vietnamese Wikipedia
Parameters:
  - query: string (search term)
```

---

## 📁 Project Structure

```
voice-chat-poc/
├── .env.example           # Environment template
├── .env.local            # Your credentials (gitignored)
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript config
├── vite.config.ts        # Vite bundler config
├── index.html            # HTML entry point
├── README.md             # This file
└── src/
    ├── main.ts           # App initialization & UI logic
    ├── style.css         # Styles
    ├── config.ts         # Environment configuration
    ├── openai-manager.ts # OpenAI Realtime API integration
    ├── livekit-manager.ts # Livekit audio handling
    ├── audio-bridge.ts   # Connects OpenAI ↔ Livekit
    └── function-registry.ts # Tool definitions & implementations
```

---

## 🛠️ Build for Production

```bash
# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

Build output will be in `dist/` folder - can be deployed to any static hosting.

---

## ⚠️ Important Notes

### **Security**

- ✅ `.env.local` is gitignored - your credentials are safe
- ⚠️ **Never commit API keys to Git**
- 🔒 In production, generate Livekit tokens server-side

### **Livekit Token Generation**

Current implementation uses **client-side token generation** for POC simplicity.

**For production:**

1. Create a backend API endpoint
2. Generate JWT tokens server-side using `livekit-server-sdk`
3. Update `LivekitManager.getTokenFromServer()` to call your API

### **Browser Compatibility**

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari (requires HTTPS for microphone)
- ❌ IE11 (not supported)

### **Microphone Permissions**

- Browser will prompt for microphone access
- Must allow to use voice features
- HTTPS required in production

---

## 🐛 Troubleshooting

### **"Missing environment variables" error**

- Check `.env.local` exists and has all 4 variables
- Restart dev server after changing `.env.local`

### **OpenAI connection fails**

- Verify API key is valid
- Check you have Realtime API access
- Try in browser console: `fetch('https://api.openai.com/v1/models', {headers: {'Authorization': 'Bearer YOUR_KEY'}})`

### **Livekit connection fails**

- Verify URL starts with `wss://`
- Check API credentials in Livekit dashboard
- Ensure room name matches

### **No audio / microphone not working**

- Check browser microphone permissions
- Try different browser (Chrome recommended)
- Check console for WebRTC errors

---

## 📚 Resources

- **OpenAI Realtime API Docs:** https://platform.openai.com/docs/guides/realtime
- **Livekit Documentation:** https://docs.livekit.io/
- **Vite Guide:** https://vitejs.dev/guide/

---

## 🔮 Future Enhancements

- [ ] Server-side Livekit token generation
- [ ] Real weather API integration (OpenWeatherMap)
- [ ] Multi-language support toggle
- [ ] Audio recording/playback history
- [ ] Custom AI instructions via UI
- [ ] Mobile-responsive design improvements
- [ ] Deploy to Vercel/Netlify

---

## 📝 License

MIT License - feel free to use for your projects!

---

## 🙋 Support

For issues or questions:

1. Check the Troubleshooting section above
2. Review browser console for errors
3. Verify all environment variables are set correctly

---

**Built with ❤️ using OpenAI Realtime API + Livekit**
