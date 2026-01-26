// src/components/VoiceChat.tsx
import { useEffect, useState, useRef } from 'react';
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
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

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
              
              // Create timestamp in Vietnam timezone (GMT+7)
              const now = new Date();
              const vnTimestamp = new Intl.DateTimeFormat('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Ho_Chi_Minh'
              }).format(now);
              
              setMessages(prev => [...prev, {
                text: message.text,
                timestamp: vnTimestamp
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

      await newRoom.connect(credentials.livekit_url, credentials.token);
      await newRoom.localParticipant.setMicrophoneEnabled(true);

      setRoom(newRoom);
      
      // Setup audio visualization
      setupAudioVisualization();
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Không thể kết nối');
      setStatus('disconnected');
    }
  };

  const setupAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;
      
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      updateAudioLevel();
    } catch (err) {
      console.error('Error setting up audio visualization:', err);
    }
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    setAudioLevel(average / 255);
    
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const togglePause = async () => {
    if (!room) return;
    
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    await room.localParticipant.setMicrophoneEnabled(!newPausedState);
  };

  const disconnect = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setStatus('disconnected');
      setAgentSpeaking(false);
      setMessages([]);
      setIsPaused(false);
      
      // Clean up audio visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [room]);

  return (
    <div className="voice-chat-container">
      {status === 'connected' ? (
        // Recording UI with wave animation
        <div className="recording-view">
          <div className="wave-container">
            <div className="wave-circle">
              <div className="wave-animation" style={{ transform: `scale(${1 + audioLevel * 0.3})` }}>
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="wave-ring"
                    style={{
                      animationDelay: `${i * 0.3}s`,
                      opacity: agentSpeaking ? 0.6 - i * 0.2 : 0.3 - i * 0.1
                    }}
                  />
                ))}
              </div>
            </div>
            
            <div className="audio-bars">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="audio-bar"
                  style={{
                    height: i === 0 ? '12px' : `${Math.max(8, audioLevel * 40 * (1 - i * 0.15))}px`,
                    opacity: i === 0 ? 0.5 : (audioLevel > 0.1 ? 1 : 0.3)
                  }}
                />
              ))}
            </div>
            
            <p className="recording-status">
              {agentSpeaking ? 'Agent đang suy nghĩ và trả lời...' : isPaused ? 'Đã dừng thu âm' : 'Bắt đầu nói'}
            </p>
          </div>
          
          <div className="recording-controls">
            <button onClick={togglePause} className="btn-pause" title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}>
              {isPaused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8 5v14l11-7z" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                  <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                </svg>
              )}
            </button>
            
            <button onClick={disconnect} className="btn-stop" title="Kết thúc">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
          {messages.length > 0 && (
            <div className="transcript-box-recording">
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
        </div>
      ) : (
        <div className="voice-chat-card">
          <h1 className="title">Trợ Lý Ảo MoMo</h1>
          <p className="subtitle">Hỗ trợ 24/7 bằng giọng nói</p>

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

          {error && (
            <div className="error-box">
              <p className="error-title">❌ Có lỗi xảy ra</p>
              <p className="error-message">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
