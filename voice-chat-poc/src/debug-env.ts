/**
 * Debug script to check environment variables in browser
 */

export function debugEnv() {
  console.log('=== Environment Variables Debug ===');
  console.log('import.meta.env:', import.meta.env);
  console.log('---');
  console.log('VITE_LIVEKIT_URL:', import.meta.env.VITE_LIVEKIT_URL);
  console.log('VITE_OPENAI_WS_URL:', import.meta.env.VITE_OPENAI_WS_URL);
  console.log('VITE_LIVEKIT_TOKEN_URL:', import.meta.env.VITE_LIVEKIT_TOKEN_URL);
  console.log('---');
  console.log('DEV:', import.meta.env.DEV);
  console.log('PROD:', import.meta.env.PROD);
  console.log('MODE:', import.meta.env.MODE);
  console.log('===================================');
}

// Auto-run on import
debugEnv();
