/**
 * Configuration module for the Voice Chat POC
 * Loads environment variables and provides app configuration
 */

export const config = {
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '', // Not needed when using proxy
    model: 'gpt-4o-audio-preview-2024-12-17',  // Alternative model with audio support
    voice: 'alloy', // Supports Vietnamese well
    // Use local proxy server instead of direct OpenAI connection
    wsUrl: import.meta.env.VITE_OPENAI_WS_URL || 'ws://localhost:8080',
  },
  livekit: {
    url: import.meta.env.VITE_LIVEKIT_URL || '',
    apiKey: import.meta.env.VITE_LIVEKIT_API_KEY || '', // Not needed when using backend
    apiSecret: import.meta.env.VITE_LIVEKIT_API_SECRET || '', // Not needed when using backend
    // Backend API for token generation
    tokenUrl: import.meta.env.VITE_LIVEKIT_TOKEN_URL || 'http://localhost:3000/api/livekit/token',
  },
  room: {
    name: 'test-room', // Default room name
    participantName: 'user',
  },
};

/**
 * Validate that all required environment variables are set
 * @throws Error if any required variable is missing
 */
export function validateConfig(): void {
  // Debug: Log all values
  console.log('[Config] Validating configuration...');
  console.log('[Config] OpenAI WS URL:', config.openai.wsUrl);
  console.log('[Config] Livekit URL:', config.livekit.url);
  console.log('[Config] Token URL:', config.livekit.tokenUrl);

  const required = [
    { key: 'Livekit URL', value: config.livekit.url },
  ];

  // Check for missing or placeholder values
  const missing = required.filter(({ value }) => {
    const isMissing = !value || 
           value === '' || 
           value.includes('your-project') || 
           value.includes('your_');
    
    if (isMissing) {
      console.log(`[Config] Missing/Invalid: ${value}`);
    }
    return isMissing;
  });

  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ');
    throw new Error(
      `❌ Missing configuration: ${missingKeys}\n\n` +
      '📝 Make sure:\n' +
      '   1. Backend server is running: cd server && npm start\n' +
      '   2. .env.local has VITE_LIVEKIT_URL set\n\n' +
      '🔗 Current values:\n' +
      `   - Livekit URL: "${config.livekit.url}"\n\n` +
      '💡 Expected: wss://voice-chat-poc-rp1c8cec.livekit.cloud\n\n' +
      '⚠️ If values are empty, restart dev server: npm run dev'
    );
  }

  console.log('✅ Configuration validated successfully');
  console.log('📡 Using proxy server mode (secure)');
}
