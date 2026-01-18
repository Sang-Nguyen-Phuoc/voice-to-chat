/**
 * Audio Bridge - Connects OpenAI and Livekit
 * Manages bidirectional audio flow and function calling
 */

import { LivekitManager } from './livekit-manager';
import { OpenAIManager } from './openai-manager';
import { executeFunctionCall } from './function-registry';

export class AudioBridge {
  private livekitManager: LivekitManager;
  private openaiManager: OpenAIManager;

  constructor(livekitManager: LivekitManager, openaiManager: OpenAIManager) {
    this.livekitManager = livekitManager;
    this.openaiManager = openaiManager;
  }

  /**
   * Setup bidirectional audio bridge between Livekit and OpenAI
   */
  setupBridge(): void {
    console.log('[Bridge] 🌉 Setting up audio bridge...');

    // 1. User audio from Livekit → OpenAI
    this.livekitManager.on('userAudio', (audioData: Int16Array) => {
      // Send user audio to OpenAI for processing
      this.openaiManager.sendAudio(audioData);
    });

    // 2. AI audio from OpenAI → Livekit
    this.openaiManager.on('audioResponse', (base64Audio: string) => {
      // Play AI audio response
      this.livekitManager.playAudio(base64Audio);
    });

    // 3. Handle function calls from OpenAI
    this.openaiManager.on('functionCall', async (data: any) => {
      const { callId, name, arguments: argsJson } = data;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`[Bridge] 🔧 Function Call: ${name}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Execute the function
      const result = await executeFunctionCall(name, argsJson);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Send result back to OpenAI
      this.openaiManager.sendFunctionResult(callId, result);
    });

    // 4. Forward OpenAI events for UI updates
    this.openaiManager.on('transcript', (data: any) => {
      this.logToUI('user', data.transcript);
    });

    this.openaiManager.on('speechStarted', () => {
      this.updateAudioStatus('🎤 Listening...');
    });

    this.openaiManager.on('speechStopped', () => {
      this.updateAudioStatus('🔊 Processing...');
    });

    this.openaiManager.on('audioResponseDone', () => {
      this.updateAudioStatus('✅ Ready');
    });

    console.log('[Bridge] ✅ Audio bridge setup complete');
    console.log('[Bridge] 📊 Flow: User → Livekit → OpenAI → Livekit → User');
  }

  /**
   * Log message to chat UI
   */
  private logToUI(role: 'user' | 'assistant' | 'system', message: string): void {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${role}`;

    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = new Date().toLocaleTimeString('vi-VN');

    const msg = document.createElement('span');
    msg.className = 'log-message';
    msg.textContent = message;

    entry.appendChild(time);
    entry.appendChild(msg);
    chatLog.appendChild(entry);

    // Scroll to bottom
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  /**
   * Update audio status in UI
   */
  private updateAudioStatus(status: string): void {
    const audioStatus = document.getElementById('audio-status');
    if (audioStatus) {
      audioStatus.textContent = status;
    }
  }
}
