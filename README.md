# Mihnea Poller

A NestJS CLI application that acts as a Discord bot with daily kick votes and AI-powered responses.

## Features

### Daily Kick Vote
- Sends a daily poll at 18:00 to nominate a random user for "kicking"
- Users opt-in to the kickable list via `/mihneainator kickvote optin`
- AI generates a dramatic, mock-serious accusation about an innocent activity
- Poll runs for 1 hour, results processed at 19:00
- If the vote passes (more positive than negative votes), the user is kicked
- Kicked users receive a DM with a one-time rejoin invite link
- If DM fails, the invite link is posted in the channel for others to share

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

## Slash Commands

- `/mihneainator kickvote optin` - Opt in to the daily kick vote
- `/mihneainator kickvote optout` - Opt out from the daily kick vote

## Prerequisites

- Node.js (v18 or higher)
- npm
- A Discord bot token and application client ID
- Discord server (guild) ID and channel ID
- OpenAI API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:

```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_client_id_here
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
- `DISCORD_CLIENT_ID`: Your Discord application's Client ID (found in "General Information")
- `DISCORD_GUILD_ID`: The Discord server (guild) ID where the bot should operate
- `DISCORD_CHANNEL_ID`: The channel ID where polls and announcements are sent
- `OPENAI_API_KEY`: Your OpenAI API key for ChatGPT integration

### Optional environment variables

- `OPENAI_MODEL`: The OpenAI model to use (default: `gpt-4o-mini`)
- `DATA_DIRECTORY`: Directory for data files (default: `./data`)
- `DISCORD_BLACKLISTED_CHANNEL_IDS`: Comma-separated list of channel IDs where the bot will only react with 👎
- `DISCORD_ALLOWED_BOT_CHANNEL_IDS`: Comma-separated list of channel IDs where the bot can respond to other bots
- `DISCORD_ADMIN_USER_ID`: Discord user ID of the admin who can use the comeback feature

## How It Works

### Daily Kick Vote
1. At 18:00, the bot selects a random user from the opt-in list (requires at least 2 users)
2. If the selected user has left the server, the poll is aborted for the day
3. The bot makes a single OpenAI API call to generate all poll content in Romanian
4. A poll is sent with a dramatic accusation and vote options
5. At 19:00, votes are counted:
   - **Positive wins**: More positive votes than negative → user is kicked
   - **Tie or zero votes**: User is spared
6. If kicked:
   - A one-time use invite is created (valid 24h)
   - The bot DMs the user with the AI announcement and rejoin link
   - If DM fails, the invite is posted in the channel
7. An AI-generated announcement is posted, followed by opt-in/opt-out instructions

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
6. Under "Privileged Gateway Intents", enable:
   - **SERVER MEMBERS INTENT** (required for kick functionality)
   - **MESSAGE CONTENT INTENT**
7. Save your changes

### Step 2: Get the Client ID

1. Go to "General Information" in your Discord application
2. Copy the "Application ID" (this is your `DISCORD_CLIENT_ID`)

### Step 3: Invite the Bot to Your Server

1. In your Discord application, go to the "OAuth2" → "URL Generator" section
2. Select the following scopes:
   - `bot`
   - `applications.commands` (for slash commands)
3. Select the following bot permissions:
   - Send Messages
   - View Channels
   - Read Message History
   - **Kick Members** (required for kick vote)
   - **Create Instant Invite** (required for rejoin links)
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select the server where you want to add the bot
7. Click "Authorize" (you need "Manage Server" permissions)

### Step 4: Configure Role Hierarchy

**Important**: The bot's role must be **higher** than any user who can be kicked. In Discord Server Settings → Roles, drag the bot's role above all roles that kickable users might have.

### Step 5: Get Server and Channel IDs

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
docker run --env-file .env -v $(pwd)/data:/app/data mihnea-poller
```

The `-v` flag mounts the data directory so kickable users and poll state persist across container restarts.

Or pass environment variables directly:

```bash
docker run \
  -e DISCORD_BOT_TOKEN=your_token \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e DISCORD_GUILD_ID=your_guild_id \
  -e DISCORD_CHANNEL_ID=your_channel_id \
  -e OPENAI_API_KEY=your_openai_key \
  -v $(pwd)/data:/app/data \
  mihnea-poller
```

## Data Storage

The bot stores data in JSON files under the `data/` directory:

- `data/kick-poll-data.json`: Contains the kickable users list, active poll state, and last poll result

## License

UNLICENSED
