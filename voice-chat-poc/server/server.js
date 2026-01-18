/**
 * WebSocket Proxy Server for Voice Chat POC
 * 
 * This server solves two critical issues:
 * 1. Proxies WebSocket connections to OpenAI Realtime API (adds Authorization headers)
 * 2. Provides secure Livekit token generation endpoint
 */

import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const WS_PORT = 8080;
const HTTP_PORT = 3000;

// Validate environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars.join(', '));
  console.error('Please create a .env file in the server folder with:');
  console.error('  OPENAI_API_KEY=your_key_here');
  console.error('  LIVEKIT_API_KEY=your_key_here');
  console.error('  LIVEKIT_API_SECRET=your_secret_here');
  process.exit(1);
}

// =============================================================================
// WebSocket Proxy Server for OpenAI Realtime API
// =============================================================================

console.log('\n🚀 Starting WebSocket Proxy Server...\n');

const server = http.createServer();
const wss = new WebSocketServer({ server });

let connectionCount = 0;

wss.on('connection', (clientWs, request) => {
  const connectionId = ++connectionCount;
  console.log(`[WS-${connectionId}] 📱 Client connected`);
  
  // Extract model from query params
  const url = new URL(request.url, `http://${request.headers.host}`);
  const model = url.searchParams.get('model') || 'gpt-4o-realtime-preview-2024-12-17';
  
  console.log(`[WS-${connectionId}] 🤖 Connecting to OpenAI with model: ${model}`);
  
  // Connect to OpenAI Realtime API with proper authentication headers
  const openaiWs = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${model}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    }
  );
  
  // Buffer for messages sent before OpenAI connection is ready
  const messageBuffer = [];
  let sessionCreated = false;
  
  // Forward messages from Client to OpenAI
  clientWs.on('message', (data) => {
    if (openaiWs.readyState === WebSocket.OPEN && sessionCreated) {
      openaiWs.send(data);
      // console.log(`[WS-${connectionId}] 📤 Client → OpenAI`);
    } else {
      // Buffer messages until OpenAI is ready and session is created
      const msg = JSON.parse(data.toString());
      console.log(`[WS-${connectionId}] 📦 Buffering message type: ${msg.type}`);
      messageBuffer.push(data);
    }
  });
  
  // Forward messages from OpenAI to Client
  openaiWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
      
      // Check for session.created event and log all messages
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[WS-${connectionId}] 📥 OpenAI → Client: ${msg.type}`);
        
        // Log errors
        if (msg.type === 'error') {
          console.error(`[WS-${connectionId}] ❌ OpenAI Error:`, JSON.stringify(msg.error, null, 2));
        }
        
        if (msg.type === 'session.created') {
          console.log(`[WS-${connectionId}] 🎯 Session created, processing buffered messages...`);
          sessionCreated = true;
          
          // Send buffered messages
          if (messageBuffer.length > 0) {
            console.log(`[WS-${connectionId}] 📤 Sending ${messageBuffer.length} buffered message(s)`);
            messageBuffer.forEach(bufferedMsg => {
              const parsedMsg = JSON.parse(bufferedMsg.toString());
              console.log(`[WS-${connectionId}]    → ${parsedMsg.type}`);
              openaiWs.send(bufferedMsg);
            });
            messageBuffer.length = 0; // Clear buffer
          }
        }
        
        if (msg.type === 'session.updated') {
          console.log(`[WS-${connectionId}] ✅ Session updated successfully`);
        }
      } catch (e) {
        // Binary data
        console.log(`[WS-${connectionId}] 📦 OpenAI → Client: Binary data (${data.length} bytes)`);
      }
    }
  });
  
  // Handle OpenAI connection opened
  openaiWs.on('open', () => {
    console.log(`[WS-${connectionId}] ✅ Connected to OpenAI Realtime API`);
    console.log(`[WS-${connectionId}] ⏳ Waiting for session.created event...`);
  });
  
  // Handle errors
  openaiWs.on('error', (error) => {
    console.error(`[WS-${connectionId}] ❌ OpenAI WebSocket error:`, error.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'OpenAI connection error');
    }
  });
  
  clientWs.on('error', (error) => {
    console.error(`[WS-${connectionId}] ❌ Client WebSocket error:`, error.message);
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });
  
  // Handle closures
  openaiWs.on('close', (code, reason) => {
    console.log(`[WS-${connectionId}] 🔌 OpenAI connection closed (${code}): ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });
  
  clientWs.on('close', () => {
    console.log(`[WS-${connectionId}] 👋 Client disconnected`);
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });
});

server.listen(WS_PORT, () => {
  console.log(`✅ WebSocket Proxy Server running on ws://localhost:${WS_PORT}`);
  console.log(`   Proxying to: wss://api.openai.com/v1/realtime`);
  console.log('');
});

// =============================================================================
// HTTP Server for Livekit Token Generation
// =============================================================================

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Vite default ports
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      websocket: `ws://localhost:${WS_PORT}`,
      livekit: 'ready'
    },
    timestamp: new Date().toISOString()
  });
});

// Livekit token generation endpoint
app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    
    if (!roomName || !participantName) {
      return res.status(400).json({
        error: 'Missing required fields: roomName, participantName'
      });
    }
    
    console.log(`[HTTP] 🎫 Generating Livekit token for ${participantName} in room ${roomName}`);
    
    // Create access token
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantName,
        // Token expires in 1 hour
        ttl: 3600,
      }
    );
    
    // Add room permissions
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    
    const jwt = await token.toJwt();
    
    console.log(`[HTTP] ✅ Token generated successfully`);
    console.log(`[HTTP] 📊 Token info: identity=${participantName}, room=${roomName}, length=${jwt.length}`);
    
    res.json({
      token: jwt,
      roomName,
      participantName
    });
    
  } catch (error) {
    console.error('[HTTP] ❌ Token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`✅ HTTP Server running on http://localhost:${HTTP_PORT}`);
  console.log(`   Livekit token endpoint: POST /api/livekit/token`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Server ready!');
  console.log('');
  console.log('Frontend should connect to:');
  console.log(`   WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`   Livekit Token API: http://localhost:${HTTP_PORT}/api/livekit/token`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down servers...');
  server.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});
