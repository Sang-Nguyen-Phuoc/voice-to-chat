# ⚠️ CRITICAL ISSUES FOUND

## 🚨 Vấn Đề Nghiêm Trọng Phát Hiện

### 1. **OpenAI Realtime API Authentication Issue**

**Vấn đề:**

- OpenAI Realtime API yêu cầu `Authorization: Bearer <token>` header
- Browser WebSocket API **KHÔNG hỗ trợ** custom headers
- Đây là giới hạn bảo mật của trình duyệt

**Giải pháp:**

#### Option A: Sử dụng Server Proxy (Khuyến nghị cho Production)

```
Browser → Node.js Server → OpenAI Realtime API
         (có thể set headers)
```

#### Option B: Sử dụng OpenAI SDK (Nếu có hỗ trợ browser)

Kiểm tra xem OpenAI có SDK browser-compatible không

#### Option C: WebSocket Headers Workaround

Một số implementation cho phép headers qua subprotocols:

```typescript
new WebSocket(url, [`Bearer.${apiKey}`]);
```

**Tình trạng hiện tại:**

- Code sẽ kết nối nhưng có thể bị từ chối do thiếu authentication
- Cần test thực tế để xác nhận

---

### 2. **Livekit Token Generation - Security Risk**

**Vấn đề:**

- API Secret được expose trong browser code
- Client-side token generation = **RỦI RO BẢO MẬT CAO**

**Đã sửa:**

- ✅ Thêm warning rõ ràng
- ✅ Sử dụng `livekit-server-sdk` để tạo JWT đúng cách
- ✅ Thêm TODO cho production implementation

**Cần làm cho Production:**

```typescript
// Backend API endpoint
POST /api/livekit/token
{
  "roomName": "test-room",
  "participantName": "user123"
}

// Frontend call
const token = await fetch('/api/livekit/token', {
  method: 'POST',
  body: JSON.stringify({ roomName, participantName })
}).then(r => r.json()).then(d => d.token);
```

---

### 3. **Missing TypeScript Types**

**Đã sửa:**

- ✅ Tạo `src/vite-env.d.ts` với type definitions cho env variables
- ✅ Thêm proper types cho `import.meta.env`

---

### 4. **Missing Dependency**

**Đã sửa:**

- ✅ Thêm `livekit-server-sdk` vào dependencies (cần cho token generation)

---

## 📝 Các File Đã Sửa

1. **src/openai-manager.ts**
   - Updated WebSocket connection logic
   - Added notes about authentication challenges

2. **src/livekit-manager.ts**
   - Fixed token generation using proper JWT library
   - Added security warnings
   - Improved error handling

3. **src/vite-env.d.ts** (NEW)
   - TypeScript types cho environment variables

4. **package.json**
   - Added `livekit-server-sdk` dependency

---

## 🔧 Actions Required

### Immediate (For Testing):

1. **Install new dependency:**

```bash
npm install
```

2. **Test OpenAI connection:**
   - Có thể sẽ gặp lỗi authentication
   - Nếu lỗi, cần implement server proxy

### For Production:

1. **Create Backend Server:**
   - Express.js hoặc Next.js API routes
   - Endpoint để generate Livekit tokens
   - Endpoint để proxy OpenAI WebSocket

2. **Environment Security:**
   - Move secrets to backend only
   - Frontend chỉ nhận tokens, không nhận secrets

---

## 🧪 Testing Recommendations

1. **Test hiện tại:**

```bash
npm run dev
```

2. **Kiểm tra Console:**
   - OpenAI connection có thành công?
   - Livekit token có được tạo?
   - Có lỗi CORS hoặc authentication?

3. **Expected Errors:**
   - OpenAI có thể từ chối kết nối (401 Unauthorized)
   - Nếu xảy ra → cần implement server proxy

---

## 💡 Recommended Next Steps

### Quick Fix (POC Only):

Nếu OpenAI connection fail, có thể:

1. Tạo simple Express server
2. Proxy WebSocket connection
3. Server thêm headers khi forward

### Production Solution:

1. Build proper backend (Node.js/Express/Next.js)
2. Backend xử lý:
   - Livekit token generation
   - OpenAI WebSocket proxy
   - Authentication & authorization
3. Frontend chỉ kết nối tới backend

---

## 📞 What to Do Now?

**Option 1: Test POC as-is**

```bash
npm install
npm run dev
```

Xem có lỗi gì, rồi quyết định tiếp theo

**Option 2: Add Backend Server**
Tôi có thể tạo simple Express server để:

- Proxy OpenAI WebSocket (với proper headers)
- Generate Livekit tokens securely

---

Bạn muốn:

1. Test code hiện tại trước? (có thể có lỗi auth)
2. Hay tôi tạo luôn backend server để fix authentication issue?
