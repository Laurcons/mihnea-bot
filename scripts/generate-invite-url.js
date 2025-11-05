#!/usr/bin/env node

/**
 * Helper script to generate Discord bot invite URL
 * Usage: node scripts/generate-invite-url.js <CLIENT_ID>
 */

const clientId = process.argv[2];

if (!clientId) {
  console.error('Usage: node scripts/generate-invite-url.js <CLIENT_ID>');
  console.error('\nTo get your CLIENT_ID:');
  console.error('1. Go to https://discord.com/developers/applications');
  console.error('2. Select your application');
  console.error('3. Go to "General Information"');
  console.error('4. Copy the "Application ID" (this is your CLIENT_ID)');
  process.exit(1);
}

// Required permissions:
// - Send Messages (8192)
// - View Channels (1024)
// - Read Message History (65536)
const permissions = '8192'; // Send Messages + View Channels (basic permissions)
const scopes = 'bot';

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;

console.log('\n📋 Discord Bot Invite URL:');
console.log('═'.repeat(60));
console.log(inviteUrl);
console.log('═'.repeat(60));
console.log('\n💡 Copy this URL and open it in your browser to invite the bot to your server.');
console.log('   Make sure you have "Manage Server" permissions on the target server.\n');
