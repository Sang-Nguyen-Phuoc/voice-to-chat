/**
 * OpenAI Realtime API Manager
 * Handles WebSocket connection to OpenAI's Realtime API
 * Manages audio streaming and function calling
 */

import { config } from './config';

export type OpenAIEventHandler = (event: any) => void;

export class OpenAIManager {
  private ws: WebSocket | null = null;
  private functionDefinitions: any[];
  private eventHandlers: Map<string, OpenAIEventHandler[]> = new Map();
  private sessionReady: boolean = false;

  constructor(functionDefinitions: any[]) {
    this.functionDefinitions = functionDefinitions;
  }

  /**
   * Connect to OpenAI Realtime API via WebSocket Proxy
   * 
   * Using backend proxy server to handle authentication headers
   * which browser WebSocket cannot send directly.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Connect to local proxy server instead of OpenAI directly
      const url = `${config.openai.wsUrl}?model=${config.openai.model}`;
      
      console.log('[OpenAI] 🔌 Connecting via proxy server...');
      console.log(`[OpenAI] 📡 Proxy URL: ${url}`);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[OpenAI] ✅ WebSocket connected to proxy');
        console.log('[OpenAI] 📱 Proxy will forward to OpenAI Realtime API');
        resolve();
      };

      this.ws.onmessage = async (event) => {
        // Handle both text (JSON) and binary (audio) messages
        if (typeof event.data === 'string') {
          this.handleMessage(event.data);
        } else if (event.data instanceof Blob) {
          // Binary data (Blob) - try to read as text for debugging
          const text = await event.data.text();
          console.log('[OpenAI] 📦 Received Blob data:', text);
          try {
            const json = JSON.parse(text);
            this.handleMessage(text);
          } catch (e) {
            console.log('[OpenAI] 📦 Binary data is not JSON, might be audio');
          }
        } else {
          console.log('[OpenAI] 📦 Received binary data (ArrayBuffer), skipping...');
        }
      };

      this.ws.onerror = (error) => {
        console.error('[OpenAI] ❌ WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[OpenAI] 🔌 WebSocket closed');
        console.log('[OpenAI]    Code:', event.code);
        console.log('[OpenAI]    Reason:', event.reason || '(no reason)');
        console.log('[OpenAI]    Clean:', event.wasClean);
        this.emit('disconnected', {});
      };
    });
  }

  /**
   * Configure the OpenAI session with Vietnamese support
   */
  async configureSession(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Send session update with authentication
    const sessionConfig = {
      type: 'session.update',
      session: {
        type: 'realtime',  // Required field for Realtime API
        modalities: ['text', 'audio'],
        voice: config.openai.voice,
        instructions: `Bạn là trợ lý AI thông minh, luôn trả lời bằng tiếng Việt. 
Hãy thân thiện, nhiệt tình và chính xác trong mọi câu trả lời.`,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };

    console.log('[OpenAI] ⚙️ Configuring session...');
    console.log('[OpenAI] 📋 Sending config:', JSON.stringify(sessionConfig, null, 2));
    this.ws.send(JSON.stringify(sessionConfig));
  }

  /**
   * Handle incoming WebSocket messages from OpenAI
   */
  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data);

      // Log ALL events for debugging
      if (event.type !== 'response.audio.delta') {
        console.log('[OpenAI] 📨 Event:', event.type);
      }

      // Log important events
      switch (event.type) {
        case 'session.created':
          console.log('[OpenAI] ✅ Session created:', event.session.id);
          this.emit('sessionCreated', event);
          break;

        case 'session.updated':
          console.log('[OpenAI] ⚙️ Session updated');
          this.sessionReady = true;
          this.emit('sessionUpdated', event);
          this.emit('sessionReady', event);
          break;

        case 'input_audio_buffer.speech_started':
          console.log('[OpenAI] 🎤 User started speaking...');
          this.emit('speechStarted', event);
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('[OpenAI] 🎤 User stopped speaking');
          this.emit('speechStopped', event);
          break;

        case 'conversation.item.created':
          if (event.item?.content) {
            const content = event.item.content;
            if (Array.isArray(content)) {
              content.forEach((c: any) => {
                if (c.transcript) {
                  console.log('[OpenAI] 📝 Transcript:', c.transcript);
                  this.emit('transcript', { transcript: c.transcript });
                }
              });
            }
          }
          break;

        case 'response.audio.delta':
          // Audio chunk received - emit to be played
          if (event.delta) {
            this.emit('audioResponse', event.delta);
          }
          break;

        case 'response.audio.done':
          console.log('[OpenAI] 🔊 AI finished audio response');
          this.emit('audioResponseDone', event);
          break;

        case 'response.function_call_arguments.done':
          // Function call completed
          console.log('[OpenAI] 🔧 Function call detected');
          this.emit('functionCall', {
            callId: event.call_id,
            name: event.name,
            arguments: event.arguments,
          });
          break;

        case 'response.done':
          console.log('[OpenAI] ✅ Response completed');
          this.emit('responseDone', event);
          break;

        case 'error':
          console.error('[OpenAI] ❌ Error event:', event.error);
          this.emit('error', event.error);
          break;

        default:
          // Ignore other event types for simplicity
          break;
      }
    } catch (error) {
      console.error('[OpenAI] ❌ Error parsing message:', error);
    }
  }

  /**
   * Send audio data to OpenAI for processing
   * @param audioData - PCM16 audio data (Int16Array or Buffer)
   */
  sendAudio(audioData: Int16Array | ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Convert to base64
    const buffer = audioData instanceof Int16Array
      ? new Uint8Array(audioData.buffer)
      : new Uint8Array(audioData);
    
    const base64Audio = btoa(String.fromCharCode(...Array.from(buffer)));

    const message = {
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send function call result back to OpenAI
   * @param callId - Function call ID from OpenAI
   * @param result - Function execution result
   */
  sendFunctionResult(callId: string, result: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Create conversation item with function output
    const outputMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    };

    this.ws.send(JSON.stringify(outputMessage));

    // Trigger response generation
    const responseMessage = {
      type: 'response.create',
    };

    this.ws.send(JSON.stringify(responseMessage));

    console.log('[OpenAI] 📤 Function result sent, requesting AI response...');
  }

  /**
   * Send greeting message to start the conversation
   */
  sendGreeting(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[OpenAI] ❌ Cannot send greeting: WebSocket not connected');
      return;
    }

    if (!this.sessionReady) {
      console.warn('[OpenAI] ⏳ Session not ready yet, waiting...');
      // Wait for session ready
      this.once('sessionReady', () => {
        this.sendGreeting();
      });
      return;
    }

    console.log('[OpenAI] 👋 Sending greeting message...');

    // Create a conversation item to trigger AI greeting
    const greetingMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Xin chào! Hãy chào tôi và giới thiệu bản thân bạn.'
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(greetingMessage));

    // Trigger AI response
    const responseMessage = {
      type: 'response.create'
    };

    this.ws.send(JSON.stringify(responseMessage));

    console.log('[OpenAI] ✅ Greeting request sent');
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: OpenAIEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Register one-time event handler
   */
  once(eventType: string, handler: OpenAIEventHandler): void {
    const onceHandler = (data: any) => {
      handler(data);
      // Remove handler after execution
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(onceHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
    this.on(eventType, onceHandler);
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
   * Close WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
