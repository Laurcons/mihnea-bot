# Mihnea Poller

A NestJS CLI application that acts as a Discord bot, sending daily polls to a specified Discord channel.

## Features

- Sends a daily poll at 12:00 (noon) to a configured Discord channel
- Poll title: "il scoatem pe mihnea?"
- Poll answers: "da" and "da"
- Poll expires after 1 hour
- Sends an announcement message before the poll: "Timpul pentru votul zilnic!"

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

Required environment variables:

- `DISCORD_BOT_TOKEN`: Your Discord bot token (get it from https://discord.com/developers/applications)
- `DISCORD_GUILD_ID`: The Discord server (guild) ID where the bot should operate
- `DISCORD_CHANNEL_ID`: The channel ID where polls should be sent

## How It Works

1. The bot connects to Discord when the application starts
2. A cron job runs every day at 12:00 (noon)
3. Before sending the poll, it sends: "Timpul pentru votul zilnic!"
4. Then it sends a poll with the question "il scoatem pe mihnea?" with two "da" options
5. The poll automatically expires after 1 hour

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
  mihnea-poller
```

## License

UNLICENSED
