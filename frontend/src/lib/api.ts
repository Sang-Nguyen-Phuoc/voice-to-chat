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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create room');
  }

  return response.json();
}
