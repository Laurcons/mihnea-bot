# Mihnea Poller

A NestJS CLI application that acts as a Discord bot, sending daily polls to a specified Discord channel.

## Features

### Daily Poll
- Sends a daily poll at 18:00 to a configured Discord channel
- Poll title: "il scoatem pe mihnea?"
- Poll answers: "da" and "da"
- Poll expires after 1 hour
- Sends an announcement message before the poll: "Timpul pentru votul zilnic!"

### Mention Responder (ChatGPT Integration)
- Responds to @mentions using OpenAI's ChatGPT API
- Bot has a persona called "Mihneainatorul" - a parody character that roasts users with creative insults
- Simulates typing while generating responses for a natural feel
- Rate limiting: one request per user at a time (prevents spam)

### Channel Controls
- **Blacklisted channels**: Bot reacts with 👎 instead of responding in specified channels
- **Bot-allowed channels**: Allows the bot to respond to other bots in whitelisted channels

### Admin Comeback Feature
- Admins can reply to any message while mentioning the bot
- The bot will then roast the author of the referenced message
- Admin can include instructions in their message to guide the response

## Prerequisites

- Node.js (v18 or higher)
- npm
- A Discord bot token
- Discord server (guild) ID and channel ID

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:

```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_discord_guild_id_here
DISCORD_CHANNEL_ID=your_discord_channel_id_here
OPENAI_API_KEY=your_openai_api_key_here
```

3. Build the project:

```bash
npm run build
```

4. Run the application:

```bash
npm run start:prod
```

For development with hot-reload:

```bash
npm run start:dev
```

## Configuration

The application uses `@nestjs/config` and `dotenv` to load environment variables from a `.env` file.

### Required environment variables

- `DISCORD_BOT_TOKEN`: Your Discord bot token (get it from https://discord.com/developers/applications)
- `DISCORD_GUILD_ID`: The Discord server (guild) ID where the bot should operate
- `DISCORD_CHANNEL_ID`: The channel ID where polls should be sent
- `OPENAI_API_KEY`: Your OpenAI API key for ChatGPT integration

### Optional environment variables

- `OPENAI_MODEL`: The OpenAI model to use (default: `gpt-4o-mini`)
- `DISCORD_BLACKLISTED_CHANNEL_IDS`: Comma-separated list of channel IDs where the bot will only react with 👎
- `DISCORD_ALLOWED_BOT_CHANNEL_IDS`: Comma-separated list of channel IDs where the bot can respond to other bots
- `DISCORD_ADMIN_USER_ID`: Discord user ID of the admin who can use the comeback feature

## How It Works

### Daily Poll
1. The bot connects to Discord when the application starts
2. A cron job runs every day at 18:00
3. Before sending the poll, it sends: "Timpul pentru votul zilnic!"
4. Then it sends a poll with the question "il scoatem pe mihnea?" with two "da" options
5. The poll automatically expires after 1 hour

### Mention Responses
1. When a user @mentions the bot, it extracts the message content
2. The message is sent to OpenAI with a system prompt defining the bot's persona
3. The bot simulates typing while waiting for the response
4. The response is sent as a reply to the user's message
5. If the response is too long (>2000 chars), a fallback message is sent instead

### Admin Comeback
1. An admin replies to any user's message while mentioning the bot
2. The admin can include additional instructions in the reply
3. The bot fetches the original message and generates a roast targeting that user

## Discord Bot Setup

### Step 1: Create the Bot Application

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot" and confirm
5. Copy the bot token (click "Reset Token" if needed, then copy it)
6. Under "Privileged Gateway Intents", enable "MESSAGE CONTENT INTENT" if needed
7. Save your changes

### Step 2: Invite the Bot to Your Server

You have two options:

#### Option A: Using the Discord Developer Portal (Recommended)

1. In your Discord application, go to the "OAuth2" → "URL Generator" section
2. Select the following scopes:
   - `bot`
3. Select the following bot permissions:
   - Send Messages
   - View Channels
   - Read Message History (optional, but recommended)
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select the server where you want to add the bot
7. Click "Authorize" (you need "Manage Server" permissions)

#### Option B: Using the Helper Script

1. Get your Application ID (Client ID):
   - Go to "General Information" in your Discord application
   - Copy the "Application ID"

2. Run the helper script:

   ```bash
   npm run invite <YOUR_APPLICATION_ID>
   ```

   Example:

   ```bash
   npm run invite 123456789012345678
   ```

3. Copy the generated URL and open it in your browser
4. Select your server and authorize the bot

### Step 3: Get Server and Channel IDs

1. Enable Developer Mode in Discord:
   - Go to User Settings → Advanced → Enable Developer Mode

2. Get the Server (Guild) ID:
   - Right-click on your server name → "Copy Server ID"

3. Get the Channel ID:
   - Right-click on the channel where polls should be sent → "Copy Channel ID"

4. Add these IDs to your `.env` file

## Docker

### Building the Image

```bash
docker build -t mihnea-poller .
```

### Running with Docker

Create a `.env` file with your configuration, then run:

```bash
docker run --env-file .env mihnea-poller
```

Or pass environment variables directly:

```bash
docker run \
  -e DISCORD_BOT_TOKEN=your_token \
  -e DISCORD_GUILD_ID=your_guild_id \
  -e DISCORD_CHANNEL_ID=your_channel_id \
  -e OPENAI_API_KEY=your_openai_key \
  mihnea-poller
```

## License

UNLICENSED
