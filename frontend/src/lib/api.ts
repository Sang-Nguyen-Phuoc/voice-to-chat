// src/lib/api.ts
export interface AgentDispatchStatus {
  success: boolean;
  error: string | null;
  agentName: string;
}

export interface RoomCredentials {
  room_name: string;
  token: string;
  livekit_url: string;
  agent_dispatch?: AgentDispatchStatus;
}

export async function createRoom(
  userName: string,
  userId?: string
): Promise<RoomCredentials> {
  console.log('📡 Creating room...', { userName, userId });
  
  const response = await fetch('/api/rooms/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_name: userName,
      user_id: userId,
    }),
  });

  console.log('📡 Room creation response status:', response.status);

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Room creation failed:', error);
    throw new Error(error.error || 'Failed to create room');
  }

  const credentials = await response.json();
  console.log('✅ Room created:', {
    room_name: credentials.room_name,
    livekit_url: credentials.livekit_url,
    tokenLength: credentials.token?.length,
    agent_dispatch: credentials.agent_dispatch,
  });

  // Warn if agent dispatch failed
  if (credentials.agent_dispatch && !credentials.agent_dispatch.success) {
    console.warn('⚠️ Agent dispatch failed:', credentials.agent_dispatch.error);
    console.warn('⚠️ Agent name configured:', credentials.agent_dispatch.agentName);
  }

  return credentials;
}
