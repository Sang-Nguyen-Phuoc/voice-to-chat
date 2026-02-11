// src/lib/api.ts
export interface RoomCredentials {
  room_name: string;
  token: string;
  livekit_url: string;
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
  });

  return credentials;
}
