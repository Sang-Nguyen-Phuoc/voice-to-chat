// api/rooms/create.ts
import { AccessToken, RoomServiceClient, AgentDispatchClient } from 'livekit-server-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;
// Agent name - leave empty ("") to dispatch to any available agent
const AGENT_NAME = process.env.AGENT_NAME || '';  

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_name, user_id } = req.body;

    if (!user_name || typeof user_name !== 'string') {
      return res.status(400).json({ error: 'user_name is required' });
    }

    const roomName = `momo-room-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const userId = user_id || `user-${Math.random().toString(36).substring(7)}`;

    console.log('🏠 Creating room...', {
      roomName,
      userId,
      userName: user_name,
      livekitUrl: LIVEKIT_URL,
      agentName: AGENT_NAME,
    });

    const roomService = new RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const roomResult = await roomService.createRoom({
      name: roomName,
      emptyTimeout: 600,
      maxParticipants: 2,
    });
    
    console.log('✅ Room created successfully:', {
      roomName: roomResult.name,
      sid: roomResult.sid,
      numParticipants: roomResult.numParticipants,
    });

    // ✅ Dispatch agent to join the room
    const wsUrl = LIVEKIT_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const agentDispatch = new AgentDispatchClient(
      wsUrl,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    let dispatchStatus = { success: false, error: null as string | null, agentName: AGENT_NAME || '(any available)' };
    
    try {
      console.log('📤 Attempting to dispatch agent...', {
        roomName,
        agentName: AGENT_NAME || '(empty - will pick any available agent)',
        wsUrl,
      });
      const dispatchResult = await agentDispatch.createDispatch(roomName, AGENT_NAME);
      console.log(`✅ Agent dispatched to room: ${roomName}`, {
        dispatchResult: JSON.stringify(dispatchResult),
        dispatchId: dispatchResult?.id,
        dispatchAgentName: dispatchResult?.agentName,
      });
      dispatchStatus.success = true;
    } catch (dispatchError: any) {
      const errorMessage = dispatchError?.message || String(dispatchError);
      console.error('❌ Agent dispatch failed:', {
        error: errorMessage,
        code: dispatchError?.code,
        details: dispatchError?.details,
        stack: dispatchError?.stack,
        roomName,
        agentName: AGENT_NAME,
        wsUrl,
      });
      dispatchStatus.error = errorMessage;
      // Continue even if dispatch fails - agent might auto-join
    }

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
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    
    console.log('🎫 Token generated:', {
      roomName,
      userId,
      tokenLength: jwt.length,
      grants: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    });

    console.log('📤 Sending response to client...', { dispatchStatus });
    return res.status(200).json({
      room_name: roomName,
      token: jwt,
      livekit_url: LIVEKIT_URL,
      agent_dispatch: dispatchStatus,
    });

  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({
      error: 'Failed to create room',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
