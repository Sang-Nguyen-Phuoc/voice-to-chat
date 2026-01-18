# 🚀 Quick Start Guide - Voice Chat POC

## Bước 1: Cài Đặt Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

## Bước 2: Chạy Ứng Dụng

### Option A: Chạy Riêng Lẻ (2 Terminal)

**Terminal 1 - Backend Server:**

```bash
cd server
npm start
```

**Terminal 2 - Frontend App:**

```bash
npm run dev
```

### Option B: Chạy Cùng Lúc (Windows)

**PowerShell/CMD:**

```powershell
# Terminal 1: Backend
start cmd /k "cd server && npm start"

# Terminal 2: Frontend (sau 2-3 giây)
npm run dev
```

**Git Bash:**

```bash
# Terminal 1: Backend
cd server && npm start &

# Terminal 2: Frontend
npm run dev
```

## Bước 3: Test Ứng Dụng

1. **Mở browser tại:** `http://localhost:3000`
2. **Click:** "Connect & Start"
3. **Cho phép:** Microphone access
4. **Nói:** "Xin chào", "Thời tiết Hà Nội", "Mấy giờ rồi?"

## ✅ Kiểm Tra Backend Running

```bash
curl http://localhost:3001/health
```

Kết quả mong đợi:

```json
{
  "status": "ok",
  "services": {
    "websocket": "ws://localhost:8080",
    "livekit": "ready"
  }
}
```

## 🐛 Common Issues

### Backend không chạy được:

```bash
# Check port đã sử dụng chưa
netstat -ano | findstr :8080
netstat -ano | findstr :3001

# Kill process nếu cần
taskkill /PID <PID_NUMBER> /F
```

### Frontend không kết nối:

- ✅ Check backend đã chạy
- ✅ Check console có lỗi
- ✅ Check file `.env.local` có đúng URLs

### OpenAI connection failed:

- ✅ Check `server/.env` có `OPENAI_API_KEY`
- ✅ Check API key còn valid
- ✅ Check backend logs

## 📋 Checklist

- [ ] Đã install dependencies (`npm install` ở cả root và `server/`)
- [ ] Đã tạo `server/.env` với API keys
- [ ] Backend chạy thành công (port 8080 + 3001)
- [ ] Frontend chạy thành công (port 3000)
- [ ] Browser mở và allow microphone

## 🎯 Architecture

```
┌─────────────────┐
│  Browser :3000  │
└────────┬────────┘
         │
         ├──► ws://localhost:8080 (OpenAI Proxy)
         │         │
         │         └──► wss://api.openai.com/v1/realtime
         │
         ├──► http://localhost:3001 (Token API)
         │         │
         │         └──► Generate Livekit JWT
         │
         └──► wss://voice-chat-poc...livekit.cloud (Livekit)
```

## 🔐 Security Notes

- ✅ API keys chỉ trong `server/.env` (gitignored)
- ✅ Frontend không có secrets
- ✅ Token generation ở backend
- ✅ Proxy server handle authentication

## 📚 More Info

- [README.md](../README.md) - Full documentation
- [FIXED.md](../FIXED.md) - What was fixed
- [DOCUMENTATION.md](../DOCUMENTATION.md) - Technical details

---

**Ready to go! Start backend, then frontend, and start chatting! 🎤**
