// src/components/VoiceChat.tsx
import { useEffect, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { createRoom } from '../lib/api';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export default function VoiceChat() {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const connect = async () => {
    if (!userName.trim()) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const credentials = await createRoom(userName);

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      newRoom.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to room');
        setStatus('connected');
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setStatus('disconnected');
        setAgentSpeaking(false);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participant joined:', participant.identity);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.play();
          console.log('🔊 Subscribed to audio track from', participant.identity);
        }
      });

      newRoom.on(RoomEvent.TrackMuted, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          setAgentSpeaking(false);
        }
      });

      newRoom.on(RoomEvent.TrackUnmuted, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          setAgentSpeaking(true);
        }
      });

      await newRoom.connect(credentials.livekit_url, credentials.token);
      await newRoom.localParticipant.setMicrophoneEnabled(true);

      setRoom(newRoom);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Không thể kết nối');
      setStatus('disconnected');
    }
  };

  const disconnect = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setStatus('disconnected');
      setAgentSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return (
    <div className="voice-chat-container">
      <div className="voice-chat-card">
        <h1 className="title">Trợ Lý Ảo MoMo</h1>
        <p className="subtitle">Hỗ trợ 24/7 bằng giọng nói</p>

        {status === 'connected' && (
          <div className={`status-indicator ${agentSpeaking ? 'speaking' : 'listening'}`}>
            <div className="status-dot"></div>
            <span>{agentSpeaking ? '🎙️ Agent đang nói...' : '✓ Đã kết nối - Hãy nói gì đó'}</span>
          </div>
        )}

        {status === 'disconnected' && (
          <div className="input-section">
            <label htmlFor="userName">Tên của bạn</label>
            <input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Nhập tên của bạn..."
              onKeyPress={(e) => e.key === 'Enter' && connect()}
            />
            <button onClick={connect} className="btn-primary">
              🎤 Bắt Đầu Trò Chuyện
            </button>
            <p className="hint">Bạn sẽ cần cho phép truy cập microphone</p>
          </div>
        )}

        {status === 'connecting' && (
          <div className="loading-section">
            <div className="spinner"></div>
            <p>Đang kết nối...</p>
          </div>
        )}

        {status === 'connected' && (
          <div className="connected-section">
            <div className="info-box">
              💡 Hãy hỏi về các sản phẩm của MoMo như Túi Thần Tài, nạp tiền, rút tiền...
            </div>
            <button onClick={disconnect} className="btn-danger">
              📞 Kết Thúc Cuộc Gọi
            </button>
          </div>
        )}

        {error && (
          <div className="error-box">
            <p className="error-title">❌ Có lỗi xảy ra</p>
            <p className="error-message">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
