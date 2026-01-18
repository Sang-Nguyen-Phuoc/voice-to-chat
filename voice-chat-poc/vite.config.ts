import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('=== Vite Loading Env ===');
  console.log('Mode:', mode);
  console.log('VITE_LIVEKIT_URL:', env.VITE_LIVEKIT_URL);
  console.log('VITE_OPENAI_WS_URL:', env.VITE_OPENAI_WS_URL);
  console.log('VITE_LIVEKIT_TOKEN_URL:', env.VITE_LIVEKIT_TOKEN_URL);
  console.log('=======================');

  return {
    server: {
      port: 5173,
      open: false
    },
    define: {
      // Expose env variables to the client using loadEnv
      'import.meta.env.VITE_OPENAI_WS_URL': JSON.stringify(env.VITE_OPENAI_WS_URL),
      'import.meta.env.VITE_LIVEKIT_URL': JSON.stringify(env.VITE_LIVEKIT_URL),
      'import.meta.env.VITE_LIVEKIT_TOKEN_URL': JSON.stringify(env.VITE_LIVEKIT_TOKEN_URL),
    }
  };
})
