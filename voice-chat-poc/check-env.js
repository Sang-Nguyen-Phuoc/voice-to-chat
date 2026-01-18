#!/usr/bin/env node

/**
 * Check environment variables
 * Run: node check-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔍 Checking Environment Configuration...\n');

// Check .env.local exists
const envLocalPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ .env.local file not found!');
  console.log('\n📝 Create it by copying .env.example:');
  console.log('   cp .env.example .env.local\n');
  process.exit(1);
}

console.log('✅ .env.local file exists');

// Read and parse .env.local
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

console.log('\n📋 Environment Variables Found:\n');

const required = [
  'VITE_LIVEKIT_URL',
  'VITE_OPENAI_WS_URL',
  'VITE_LIVEKIT_TOKEN_URL'
];

let allValid = true;

required.forEach(key => {
  const value = envVars[key];
  if (!value) {
    console.log(`❌ ${key}: NOT SET`);
    allValid = false;
  } else if (value.includes('your-project') || value.includes('your_')) {
    console.log(`⚠️  ${key}: ${value} (PLACEHOLDER - needs real value)`);
    allValid = false;
  } else {
    console.log(`✅ ${key}: ${value}`);
  }
});

console.log('\n');

if (!allValid) {
  console.error('❌ Configuration incomplete!\n');
  console.log('📝 Required values in .env.local:');
  console.log('   VITE_LIVEKIT_URL=wss://voice-chat-poc-rp1c8cec.livekit.cloud');
  console.log('   VITE_OPENAI_WS_URL=ws://localhost:8080');
  console.log('   VITE_LIVEKIT_TOKEN_URL=http://localhost:3001/api/livekit/token\n');
  process.exit(1);
}

console.log('✅ All environment variables configured correctly!\n');
console.log('💡 Next steps:');
console.log('   1. Start backend: cd server && npm start');
console.log('   2. Start frontend: npm run dev\n');
