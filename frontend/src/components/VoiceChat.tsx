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
  // Track the primary agent to avoid duplicate audio from multiple agents
  const primaryAgentRef = useRef<string | null>(null);

  const connect = async () => {
    setStatus('connecting');
    setError(null);
    // Reset primary agent on new connection
    primaryAgentRef.current = null;

    try {
      const userName = `User-${Date.now()}`;
      const credentials = await createRoom(userName);

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Helper function to setup data listener for a participant (only for primary agent)
      const setupParticipantDataListener = (participant: any) => {
        // Only process data from the primary agent to avoid duplicates
        if (primaryAgentRef.current && participant.identity !== primaryAgentRef.current) {
          console.log('⏭️ Skipping data listener for non-primary agent:', participant.identity);
          return;
        }
        
        // Set this as primary agent if not already set
        if (!primaryAgentRef.current && participant.identity.startsWith('agent-')) {
          primaryAgentRef.current = participant.identity;
          console.log('🎯 Set primary agent:', participant.identity);
        }
        
        console.log('🔧 Setting up data listener for:', participant.identity);
        participant.on('dataReceived', (payload: Uint8Array) => {
          // Double-check this is still the primary agent
          if (primaryAgentRef.current && participant.identity !== primaryAgentRef.current) {
            console.log('⏭️ Ignoring data from non-primary agent:', participant.identity);
            return;
          }
          
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
        console.log('📊 Room state:', {
          name: newRoom.name,
          state: newRoom.state,
          numParticipants: newRoom.numParticipants,
          localParticipant: newRoom.localParticipant?.identity,
        });
        setStatus('connected');
        
        // Setup listeners for already-connected participants (e.g., agent)
        console.log('🔍 Remote participants count:', newRoom.remoteParticipants.size);
        
        // First, find and set the primary agent (first agent found)
        const agents = Array.from(newRoom.remoteParticipants.values())
          .filter(p => p.identity.startsWith('agent-'));
        
        if (agents.length > 0 && !primaryAgentRef.current) {
          primaryAgentRef.current = agents[0].identity;
          console.log('🎯 Set primary agent on connect:', primaryAgentRef.current);
          if (agents.length > 1) {
            console.warn(`⚠️ Multiple agents found (${agents.length}), only using: ${primaryAgentRef.current}`);
          }
        }
        
        newRoom.remoteParticipants.forEach(participant => {
          console.log('🔍 Found existing participant:', {
            identity: participant.identity,
            isPrimaryAgent: participant.identity === primaryAgentRef.current,
            audioTracks: participant.audioTrackPublications.size,
            videoTracks: participant.videoTrackPublications.size,
            trackPublications: Array.from(participant.trackPublications.values()).map(t => ({
              kind: t.kind,
              trackSid: t.trackSid,
              isSubscribed: t.isSubscribed,
              isMuted: t.isMuted,
            })),
          });
          setupParticipantDataListener(participant);
        });
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('❌ Disconnected from room');
        setStatus('disconnected');
        setAgentSpeaking(false);
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participant joined:', {
          identity: participant.identity,
          sid: participant.sid,
          audioTracks: participant.audioTrackPublications.size,
          metadata: participant.metadata,
        });
        setupParticipantDataListener(participant);
      });

      // Add more detailed event listeners for debugging
      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('📢 Track Published:', {
          participantIdentity: participant.identity,
          trackKind: publication.kind,
          trackSid: publication.trackSid,
          trackName: publication.trackName,
          isSubscribed: publication.isSubscribed,
          isMuted: publication.isMuted,
        });
      });

      newRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        console.log('🎙️ Active speakers changed:', speakers.map(s => ({
          identity: s.identity,
          isSpeaking: s.isSpeaking,
          audioLevel: s.audioLevel,
        })));
        // Only consider primary agent as speaking
        const agentIsSpeaking = speakers.some(s => 
          s.identity !== newRoom.localParticipant.identity && 
          s.identity === primaryAgentRef.current
        );
        setAgentSpeaking(agentIsSpeaking);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('🎧 Track Subscribed:', {
          participantIdentity: participant.identity,
          trackKind: track.kind,
          trackSid: track.sid,
          trackSource: track.source,
          isPrimaryAgent: participant.identity === primaryAgentRef.current,
          mediaStreamTrack: track.mediaStreamTrack ? {
            enabled: track.mediaStreamTrack.enabled,
            muted: track.mediaStreamTrack.muted,
            readyState: track.mediaStreamTrack.readyState,
          } : null,
          publicationState: {
            isSubscribed: publication.isSubscribed,
            isMuted: publication.isMuted,
            isEnabled: publication.isEnabled,
            trackName: publication.trackName,
          },
        });

        if (track.kind === Track.Kind.Audio) {
          // Set primary agent if not set yet
          if (!primaryAgentRef.current && participant.identity.startsWith('agent-')) {
            primaryAgentRef.current = participant.identity;
            console.log('🎯 Set primary agent from audio track:', participant.identity);
          }
          
          // Only setup audio for primary agent to avoid duplicate voices
          if (primaryAgentRef.current && participant.identity !== primaryAgentRef.current) {
            console.log('⏭️ Skipping audio setup for non-primary agent:', participant.identity);
            return;
          }
          
          console.log('🔊 Setting up audio for PRIMARY agent:', participant.identity);
          const audioElement = track.attach();
          
          // Log audio element state
          console.log('🔊 Audio element created:', {
            paused: audioElement.paused,
            muted: audioElement.muted,
            volume: audioElement.volume,
            readyState: audioElement.readyState,
            srcObject: audioElement.srcObject ? 'MediaStream exists' : 'No MediaStream',
          });
          
          // ✅ FIX: Attach to DOM for better browser compatibility
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          // Add event listeners to audio element for debugging
          audioElement.addEventListener('playing', () => {
            console.log('🎵 Audio element is playing from:', participant.identity);
          });
          audioElement.addEventListener('pause', () => {
            console.log('⏸️ Audio element paused for:', participant.identity);
          });
          audioElement.addEventListener('ended', () => {
            console.log('🔚 Audio element ended for:', participant.identity);
          });
          audioElement.addEventListener('error', (e) => {
            console.error('❌ Audio element error:', e);
          });
          audioElement.addEventListener('volumechange', () => {
            console.log('🔉 Volume changed:', audioElement.volume, 'muted:', audioElement.muted);
          });
          
          // ✅ FIX: Handle autoplay with error handling
          audioElement.play()
            .then(() => {
              console.log('🔊 Audio playing successfully from', participant.identity);
              console.log('🔊 Audio playback state:', {
                paused: audioElement.paused,
                currentTime: audioElement.currentTime,
                volume: audioElement.volume,
              });
            })
            .catch((err) => {
              console.warn('⚠️ Autoplay blocked, will retry on user interaction:', err);
              // Retry play on next user interaction
              const resumeAudio = () => {
                audioElement.play()
                  .then(() => console.log('🔊 Audio resumed after user interaction'))
                  .catch(e => console.error('❌ Still cannot play audio:', e));
                document.removeEventListener('click', resumeAudio);
              };
              document.addEventListener('click', resumeAudio);
            });
          
          console.log('🔊 Subscribed to audio track from', participant.identity);
        }
      });

      // ✅ Cleanup audio elements when track unsubscribed
      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const elements = track.detach();
          elements.forEach((el) => {
            el.remove();
          });
          console.log('🔇 Audio track detached and removed');
        }
      });

      newRoom.on(RoomEvent.TrackMuted, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          setAgentSpeaking(false);
        }
      });

      newRoom.on(RoomEvent.TrackUnmuted, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          console.log('🔊 Track unmuted:', publication.trackSid, 'kind:', publication.kind);
          setAgentSpeaking(true);
        }
      });

      // Add Data Received at Room level
      newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
        console.log('📥 [Room] DataReceived:', {
          from: participant?.identity || 'unknown',
          payloadSize: payload.byteLength,
        });
      });

      // Track subscription failed
      newRoom.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant, reason) => {
        console.error('❌ Track subscription failed:', {
          trackSid,
          participantIdentity: participant?.identity,
          reason,
        });
      });

      console.log('🔗 Connecting to LiveKit...', {
        url: credentials.livekit_url,
        roomName: credentials.room_name,
        tokenPreview: credentials.token.substring(0, 50) + '...',
      });

      await newRoom.connect(credentials.livekit_url, credentials.token);
      
      console.log('✅ Room connected, enabling microphone...');
      await newRoom.localParticipant.setMicrophoneEnabled(true);
      
      console.log('🎤 Microphone enabled, local participant:', {
        identity: newRoom.localParticipant.identity,
        audioTracks: newRoom.localParticipant.audioTrackPublications.size,
      });

      setRoom(newRoom);
      
      // Log remote participants after connection
      console.log('👥 Remote participants after connect:', newRoom.remoteParticipants.size);
      newRoom.remoteParticipants.forEach((p, sid) => {
        console.log('👤 Remote participant:', {
          identity: p.identity,
          sid: sid,
          audioTracks: p.audioTrackPublications.size,
          tracks: Array.from(p.trackPublications.values()).map(t => ({
            kind: t.kind,
            isSubscribed: t.isSubscribed,
            isMuted: t.isMuted,
          })),
        });
      });
      
      // Setup audio visualization
      setupAudioVisualization();
    } catch (err) {
      console.error('❌ Connection error:', err);
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
      
      // ✅ Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      
      // ✅ FIX: Check state before closing AudioContext
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        
        if (ctx.state !== 'closed') {
          try {
            await ctx.close();
            console.log('✅ AudioContext closed successfully');
          } catch (err) {
            console.warn('⚠️ AudioContext close error:', err);
          }
        }
        
        audioContextRef.current = null;
      }
      
      analyserRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      // ✅ Cleanup: Only cancel animation and disconnect room
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // ✅ Only disconnect room if still connected
      if (room && room.state === 'connected') {
        room.disconnect();
      }
      
      // ✅ FIX: Do NOT close AudioContext here - disconnect() handles it
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
                <span>📝 Realtime Bot's transcript</span>
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
          <h1 className="title">Trợ Lý Mogenie</h1>
          <p className="subtitle">Sẵn sàng hỗ trợ 24/7</p>

          {status === 'disconnected' && (
            <div className="input-section">
              <button onClick={connect} className="btn-primary">Bắt Đầu Cuộc Trò chuyện</button>
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
