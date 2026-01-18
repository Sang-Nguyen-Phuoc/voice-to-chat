/**
 * Main Application Entry Point
 * Initializes the voice chat application and sets up UI interactions
 */

import './style.css';
import './debug-env'; // Debug environment variables
import { validateConfig, config } from './config';
import { LivekitManager } from './livekit-manager';
import { OpenAIManager } from './openai-manager';
import { AudioBridge } from './audio-bridge';
import { functionDefinitions } from './function-registry';

// Global managers
let livekitManager: LivekitManager | null = null;
let openaiManager: OpenAIManager | null = null;
let audioBridge: AudioBridge | null = null;
let isConnected = false;

/**
 * Initialize the application
 */
async function initApp() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║        🎙️  AI VOICE CHAT ASSISTANT - POC 🤖                ║');
  console.log('║                                                            ║');
  console.log('║        OpenAI Realtime API + Livekit                      ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Setup UI event listeners
  setupUIListeners();

  // Validate configuration
  try {
    validateConfig();
    logToChat('system', '✅ Configuration validated successfully');
  } catch (error: any) {
    logToChat('system', `❌ Configuration error: ${error.message}`);
    console.error(error);
    return;
  }

  // Display room name
  const roomNameEl = document.getElementById('room-name');
  if (roomNameEl) {
    roomNameEl.textContent = config.room.name;
  }

  logToChat('system', 'Ready to connect. Click "Connect & Start" button.');
}

/**
 * Setup UI event listeners
 */
function setupUIListeners() {
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const clearLogBtn = document.getElementById('clear-log');

  connectBtn?.addEventListener('click', handleConnect);
  disconnectBtn?.addEventListener('click', handleDisconnect);
  clearLogBtn?.addEventListener('click', clearChatLog);
}

/**
 * Handle connect button click
 */
async function handleConnect() {
  if (isConnected) {
    logToChat('system', '⚠️ Already connected');
    return;
  }

  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

  try {
    // Disable connect button
    connectBtn.disabled = true;
    connectBtn.textContent = '⏳ Connecting...';

    logToChat('system', '🔧 Initializing managers...');

    // Step 1: Initialize managers
    livekitManager = new LivekitManager();
    openaiManager = new OpenAIManager(functionDefinitions);
    audioBridge = new AudioBridge(livekitManager, openaiManager);

    // Step 2: Connect to OpenAI
    logToChat('system', '🤖 Connecting to OpenAI Realtime API...');
    updateStatus('openai-status', '🟡 Connecting...');

    await openaiManager.connect();
    await openaiManager.configureSession();

    updateStatus('openai-status', '🟢 Connected');
    logToChat('system', `✅ OpenAI connected (${config.openai.model})`);

    // Step 3: Connect to Livekit
    logToChat('system', '🌐 Connecting to Livekit room...');
    updateStatus('livekit-status', '🟡 Connecting...');

    await livekitManager.connect(config.room.name);

    updateStatus('livekit-status', '🟢 Connected');
    logToChat('system', `✅ Livekit connected (Room: ${config.room.name})`);

    // Step 4: Publish microphone
    logToChat('system', '🎤 Publishing microphone...');
    updateStatus('audio-status', '🟡 Setting up...');

    await livekitManager.publishMicrophone();

    updateStatus('audio-status', '🟢 Ready');
    logToChat('system', '✅ Microphone published');

    // Step 5: Setup audio bridge
    logToChat('system', '🌉 Setting up audio bridge...');
    audioBridge.setupBridge();

    logToChat('system', '✅ Audio bridge ready');

    // Success
    isConnected = true;
    connectBtn.style.display = 'none';
    disconnectBtn.disabled = false;

    logToChat('system', '🎉 Connection successful!');
    
    // Step 6: AI greets the user first - wait for session to be fully ready
    setTimeout(() => {
      try {
        logToChat('system', '👋 AI is greeting you...');
        if (openaiManager) {
          openaiManager.sendGreeting();
          logToChat('system', '💡 After AI greeting, you can try: "Thời tiết Hà Nội", "Mấy giờ rồi?"');
        }
      } catch (greetError: any) {
        console.error('[App] Greeting error:', greetError);
        logToChat('system', `⚠️ Greeting failed: ${greetError.message}`);
      }
    }, 1000); // Wait 1 second for session to be fully ready

  } catch (error: any) {
    console.error('[App] Connection error:', error);
    logToChat('system', `❌ Connection failed: ${error.message}`);

    // Reset UI
    connectBtn.disabled = false;
    connectBtn.textContent = '🚀 Connect & Start';
    updateStatus('openai-status', '🔴 Disconnected');
    updateStatus('livekit-status', '🔴 Disconnected');
    updateStatus('audio-status', '🔴 Inactive');

    // Cleanup
    if (openaiManager) openaiManager.close();
    if (livekitManager) livekitManager.disconnect();
  }
}

/**
 * Handle disconnect button click
 */
function handleDisconnect() {
  if (!isConnected) {
    return;
  }

  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

  logToChat('system', '🛑 Disconnecting...');

  // Close connections
  if (openaiManager) {
    openaiManager.close();
  }
  if (livekitManager) {
    livekitManager.disconnect();
  }

  // Reset state
  isConnected = false;
  livekitManager = null;
  openaiManager = null;
  audioBridge = null;

  // Update UI
  updateStatus('openai-status', '⚪ Disconnected');
  updateStatus('livekit-status', '⚪ Disconnected');
  updateStatus('audio-status', '⚪ Inactive');

  connectBtn.style.display = 'block';
  connectBtn.disabled = false;
  connectBtn.textContent = '🚀 Connect & Start';
  disconnectBtn.disabled = true;

  logToChat('system', '✅ Disconnected successfully');
}

/**
 * Update status display
 */
function updateStatus(elementId: string, status: string) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = status;
  }
}

/**
 * Log message to chat
 */
function logToChat(role: 'user' | 'assistant' | 'system', message: string) {
  const chatLog = document.getElementById('chat-log');
  if (!chatLog) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${role}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = role === 'system' ? 'System' : new Date().toLocaleTimeString('vi-VN');

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
 * Clear chat log
 */
function clearChatLog() {
  const chatLog = document.getElementById('chat-log');
  if (chatLog) {
    chatLog.innerHTML = '';
    logToChat('system', 'Chat log cleared');
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (isConnected) {
    handleDisconnect();
  }
});
