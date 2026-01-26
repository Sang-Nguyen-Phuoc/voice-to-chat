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

      // Helper function to setup data listener for a participant
      const setupParticipantDataListener = (participant: any) => {
        console.log('🔧 Setting up data listener for:', participant.identity);
        participant.on('dataReceived', (payload: Uint8Array) => {
          try {
            const text = new TextDecoder().decode(payload);
            console.log('📨 [Participant] DataReceived from:', participant.identity);
            console.log('📨 [Participant] Raw payload:', text);
            
            const message = JSON.parse(text);
            console.log('📝 [Participant] Parsed message:', message);
            
            if (message.type === 'bot_message') {
              console.log('✅ [Participant] Adding bot message to transcript');
              setMessages(prev => [...prev, {
                text: message.text,
                timestamp: message.timestamp
              }]);
            }
          } catch (error) {
            console.error('❌ [Participant] Error parsing data message:', error);
          }
        });
      };

      newRoom.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to room');
        setStatus('connected');
        
        // Setup listeners for already-connected participants (e.g., agent)
        newRoom.remoteParticipants.forEach(participant => {
          console.log('🔍 Found existing participant:', participant.identity);
          setupParticipantDataListener(participant);
        });
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setStatus('disconnected');
        setAgentSpeaking(false);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participant joined:', participant.identity);
        setupParticipantDataListener(participant);
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

      // Listen for data from all participants including agent
      newRoom.on(RoomEvent.DataReceived, (
        payload: Uint8Array,
        participant?: any,
        _kind?: any,
        _topic?: string
      ) => {
        try {
          const text = new TextDecoder().decode(payload);
          console.log('📨 DataReceived from:', participant?.identity || 'unknown');
          console.log('📨 Raw payload:', text);
          
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
