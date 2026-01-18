/**
 * Test Livekit token generation
 * Run: node test-token.js
 */

import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

console.log('\n🧪 Testing Livekit Token Generation...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   LIVEKIT_API_KEY: ${process.env.LIVEKIT_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   LIVEKIT_API_SECRET: ${process.env.LIVEKIT_API_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log('');

if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
  console.error('❌ Missing Livekit credentials in .env file!');
  process.exit(1);
}

(async () => {
  try {
    // Create test token
    const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: 'test-user',
      ttl: 3600,
    }
  );

  token.addGrant({
    roomJoin: true,
    room: 'test-room',
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await token.toJwt();

  console.log('✅ Token generated successfully!\n');
  console.log('📝 Token Details:');
  console.log(`   Identity: test-user`);
  console.log(`   Room: test-room`);
  console.log(`   TTL: 3600 seconds (1 hour)`);
  console.log('');
  console.log('🎫 JWT Token (first 100 chars):');
  console.log(`   ${jwt.substring(0, 100)}...`);
  console.log('');
  console.log('📏 Token Length:', jwt.length, 'characters');
  console.log('');
  console.log('💡 Use this token to connect to:');
  console.log('   wss://voice-chat-poc-rp1c8cec.livekit.cloud');
  console.log('');

} catch (error) {
  console.error('❌ Token generation failed!');
  console.error('Error:', error.message);
  console.error('');
  console.error('💡 Check that your LIVEKIT_API_KEY and LIVEKIT_API_SECRET are correct.');
  process.exit(1);
}
})();
