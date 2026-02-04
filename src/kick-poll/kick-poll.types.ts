export interface KickableUser {
  userId: string;
  username: string;
  optedInAt: string;
}

export interface AiPollContent {
  question: string;
  positiveOption: string;
  negativeOption: string;
  positiveAnnouncement: string;
  negativeAnnouncement: string;
}

export interface ActivePoll {
  messageId: string;
  channelId: string;
  targetUserId: string;
  targetUsername: string;
  startedAt: string;
  endsAt: string;
  aiContent: AiPollContent;
}

export interface PollResult {
  targetUserId: string;
  targetUsername: string;
  wasKicked: boolean;
  dmSent: boolean;
  processedAt: string;
}

export interface KickPollData {
  kickableUsers: KickableUser[];
  activePoll: ActivePoll | null;
  lastPollResult: PollResult | null;
}

export interface KickResult {
  kicked: boolean;
  dmSent: boolean;
  inviteUrl: string;
  error?: string;
}
