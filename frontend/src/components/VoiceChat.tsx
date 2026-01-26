// src/components/VoiceChat.tsx
import { useEffect, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { createRoom } from '../lib/api';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface BotMessage {
  text: string;
  timestamp: string;
}

export default function VoiceChat() {
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);

  const connect = async () => {
    setStatus('connecting');
    setError(null);

    try {
      const userName = `User-${Date.now()}`;
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

      newRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          console.log('📨 DataReceived:', text);
          
          const message = JSON.parse(text);
          console.log('📝 Parsed message:', message);
          
          if (message.type === 'bot_message') {
            console.log('✅ Adding bot message to transcript');
            setMessages(prev => [...prev, {
              text: message.text,
              timestamp: message.timestamp
            }]);
          }
        } catch (error) {
          console.error('❌ Error parsing data message:', error);
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
      setMessages([]);
    }
  };

  // Test function - thêm mock message để test UI
  const addTestMessage = () => {
    const testMsg: BotMessage = {
      text: 'Dạ, em hiểu rồi ạ. Túi Thần Tài là sản phẩm tiết kiệm của MoMo giúp bạn tích lũy tiền với lãi suất hấp dẫn hơn gửi tiết kiệm ngân hàng truyền thống.',
      timestamp: `[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]`
    };
    setMessages(prev => [...prev, testMsg]);
    console.log('🧪 Added test message');
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
            <button onClick={connect} className="btn-primary">
              📞 Bắt Đầu Cuộc Gọi
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
            
            {/* Debug: Show message count */}
            <div style={{ color: '#666', fontSize: '0.8rem', textAlign: 'center', margin: '8px 0' }}>
              Messages: {messages.length}
            </div>
            
            {messages.length > 0 && (
              <div className="transcript-box">
                <div className="transcript-header">
                  <span>📝 Transcript</span>
                </div>
                <div className="transcript-messages">
                  {messages.map((msg, index) => (
                    <div key={index} className="transcript-message">
                      <div className="transcript-timestamp">{msg.timestamp}</div>
                      <div className="transcript-text">{msg.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Test button */}
            <button onClick={addTestMessage} className="btn-test" style={{
              padding: '8px 16px',
              background: '#333',
              color: '#60a5fa',
              border: '1px solid #444',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginBottom: '8px'
            }}>
              🧪 Test Transcript UI
            </button>
            
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
