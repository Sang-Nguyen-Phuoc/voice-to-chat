/**
 * Livekit Manager - Browser Audio Integration
 * Handles Livekit room connection and audio streaming
 * Uses browser-native AudioContext for audio processing
 */

import { Room, RoomEvent, Track, RemoteTrack, RemoteAudioTrack, createLocalAudioTrack } from 'livekit-client';
import { config } from './config';

export type LivekitEventHandler = (event: any) => void;

export class LivekitManager {
  private room: Room;
  private audioContext: AudioContext | null = null;
  private eventHandlers: Map<string, LivekitEventHandler[]> = new Map();
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  constructor() {
    this.room = new Room();
  }

  /**
   * Connect to Livekit room
   */
  async connect(roomName: string): Promise<void> {
    try {
      console.log(`[Livekit] 🔌 Connecting to room: ${roomName}...`);

      // Validate Livekit URL before attempting connection
      if (!config.livekit.url || config.livekit.url === '') {
        throw new Error(
          'Livekit URL is not configured!\n\n' +
          'Please check:\n' +
          '1. .env.local file exists in project root\n' +
          '2. Contains: VITE_LIVEKIT_URL=wss://your-project.livekit.cloud\n' +
          '3. Restart dev server: npm run dev\n\n' +
          `Current value: "${config.livekit.url}"`
        );
      }

      console.log(`[Livekit] 📡 Using URL: ${config.livekit.url}`);

      // For POC: Use a simple connection approach
      // In production, get the token from your backend
      const token = await this.getTokenFromServer(roomName);

      await this.room.connect(config.livekit.url, token);

      console.log('[Livekit] ✅ Connected to room');

      // Setup event handlers
      this.setupEventHandlers();

      // Initialize AudioContext
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      this.emit('connected', {});
    } catch (error) {
      console.error('[Livekit] ❌ Connection error:', error);
      throw error;
    }
  }

  /**
   * Get JWT token from backend server
   * This is the SECURE way - backend holds the secrets
   */
  private async getTokenFromServer(roomName: string): Promise<string> {
    try {
      console.log(`[Livekit] 🔑 Requesting token from backend...`);
      
      const response = await fetch(config.livekit.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          participantName: config.room.participantName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Livekit] ✅ Token received from backend`);
      console.log(`[Livekit] 📊 Token length: ${data.token.length} chars`);
      console.log(`[Livekit] 🔗 Connecting to: ${config.livekit.url}`);
      console.log(`[Livekit] 🏠 Room: ${data.roomName}, User: ${data.participantName}`);
      
      return data.token;
    } catch (error) {
      console.error('[Livekit] ❌ Token request error:', error);
      throw new Error(
        'Failed to get Livekit token from backend.\n' +
        'Make sure the backend server is running:\n' +
        '  cd server && npm start'
      );
    }
  }

  /**
   * Setup Livekit room event handlers
   */
  private setupEventHandlers(): void {
    this.room.on(RoomEvent.TrackSubscribed, (
      track: RemoteTrack,
      publication,
      participant
    ) => {
      console.log(`[Livekit] 📥 Track subscribed from ${participant.identity}`);

      if (track.kind === Track.Kind.Audio) {
        console.log('[Livekit] 🔊 Audio track subscribed');
        this.handleAudioTrack(track as RemoteAudioTrack);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log(`[Livekit] 📤 Track unsubscribed from ${participant.identity}`);
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log(`[Livekit] 👤 Participant connected: ${participant.identity}`);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log(`[Livekit] 👋 Participant disconnected: ${participant.identity}`);
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[Livekit] 🔌 Disconnected from room');
      this.emit('disconnected', {});
    });
  }

  /**
   * Handle incoming audio track from remote participant
   */
  private async handleAudioTrack(track: RemoteAudioTrack): Promise<void> {
    const mediaStreamTrack = track.mediaStreamTrack;

    if (!mediaStreamTrack) {
      console.error('[Livekit] ❌ No media stream track available');
      return;
    }

    const mediaStream = new MediaStream([mediaStreamTrack]);

    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    const source = this.audioContext.createMediaStreamSource(mediaStream);

    // Create ScriptProcessor for audio capture (deprecated but widely supported)
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array to Int16Array (PCM16)
      const pcm16 = this.floatTo16BitPCM(inputData);

      // Emit audio data
      this.emit('userAudio', pcm16);
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    console.log('[Livekit] ✅ Audio processing setup complete');
  }

  /**
   * Publish local audio track (microphone)
   */
  async publishMicrophone(): Promise<void> {
    try {
      console.log('[Livekit] 🎤 Publishing microphone...');

      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      await this.room.localParticipant.publishTrack(audioTrack);

      console.log('[Livekit] ✅ Microphone published');
      this.emit('microphonePublished', {});
    } catch (error) {
      console.error('[Livekit] ❌ Failed to publish microphone:', error);
      throw error;
    }
  }

  /**
   * Play AI audio response
   * @param audioData - Base64 encoded PCM16 audio or Int16Array
   */
  async playAudio(audioData: string | Int16Array): Promise<void> {
    if (!this.audioContext) {
      console.error('[Livekit] ❌ AudioContext not initialized');
      return;
    }

    try {
      // Convert base64 to Int16Array if needed
      let int16Data: Int16Array;
      if (typeof audioData === 'string') {
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        int16Data = new Int16Array(bytes.buffer);
      } else {
        int16Data = audioData;
      }

      // Convert to Float32Array
      const float32Data = this.int16ToFloat32(int16Data);

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(
        1, // mono
        float32Data.length,
        24000 // sample rate
      );

      audioBuffer.copyToChannel(float32Data, 0);

      // Add to queue and play
      this.audioQueue.push(audioBuffer);
      if (!this.isPlaying) {
        this.playNextInQueue();
      }
    } catch (error) {
      console.error('[Livekit] ❌ Error playing audio:', error);
    }
  }

  /**
   * Play next audio buffer in queue
   */
  private playNextInQueue(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    const source = this.audioContext!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext!.destination);

    source.onended = () => {
      this.playNextInQueue();
    };

    source.start();
  }

  /**
   * Convert Float32Array to Int16Array (PCM16 format)
   */
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * Convert Int16Array to Float32Array
   */
  private int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }
    return float32Array;
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: LivekitEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit event to registered handlers
   */
  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Disconnect from room
   */
  disconnect(): void {
    this.room.disconnect();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
  }
}
