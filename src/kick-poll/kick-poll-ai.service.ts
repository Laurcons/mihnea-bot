import { Injectable, Logger } from '@nestjs/common';
import { BotConfigService } from '../bot-config.service';
import { AiPollContent } from './kick-poll.types';

const SYSTEM_PROMPT = `You are a dramatic medieval court announcer for a Discord server's daily "kick vote" ritual. Your job is to generate theatrical, over-the-top content that accuses a user of hilariously mundane "crimes" as if they were grave offenses.

You will receive a username. Generate content accusing them of innocent, everyday activities but framed as serious transgressions. Examples of "crimes":
- Breathing too loudly during a voice call
- Having a controversial opinion about pineapple on pizza
- Existing on a Tuesday
- Using too many emojis (or too few)
- Taking the last slice of virtual pizza
- Being suspiciously quiet (or suspiciously loud)
- Having a username that's hard to pronounce
- Winning too many games
- Losing too many games
- Having an opinion
- Not having an opinion
- Being online at suspicious hours
- Being offline at suspicious hours
Be inventive and try new things, don't be limited to these examples, just keep the tone.

RULES:
1. The question MUST start with "Îl dăm afară pe @{username}" (NOT THIS EXACT phrasing) asking if the user should be kicked
2. The question should include the dramatic accusation (max 300 characters total)
3. positiveOption = the vote option to kick, in an over-the-top theatrical tone
4. negativeOption = the vote option to spare, in an over-the-top theatrical tone
5. positiveAnnouncement = dramatic announcement that they WERE kicked (max 1500 chars)
   - Reference the original "crime"
   - Be theatrical about justice being served
   - Example tone: "Prin votul poporului, @username a fost IZGONIT pentru crima odioasă de..."
6. negativeAnnouncement = announcement that they were SPARED (max 1500 chars)
   - Express dramatic relief or disappointment that justice wasn't served
   - Warn them they're being watched
   - Example tone: "Poporul a arătat milă! @username scapă NEPEDEPSIT de această dată..."

LANGUAGE: Write everything in Romanian.
TONE: Pompous, theatrical, mock-serious - like a Shakespeare play about nothing important.
IMPORTANT: All output MUST be in Romanian language. Be creative with the accusations and make them absurd but funny.`;

const FALLBACK_CONTENT: AiPollContent = {
  question: 'Îl dăm afară pe @{username} pentru că așa vrem noi?',
  positiveOption: 'Da, afară!',
  negativeOption: 'Nu, să ramană',
  positiveAnnouncement:
    'Prin votul poporului, @{username} a fost IZGONIT de pe server!',
  negativeAnnouncement:
    'Poporul a arătat milă! @{username} scapă nepedepsit/ă de această dată...',
};

const JSON_SCHEMA = {
  name: 'kick_poll_content',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The poll question (max 300 chars)',
      },
      positiveOption: {
        type: 'string',
        description: 'Vote option to kick (max 55 chars)',
      },
      negativeOption: {
        type: 'string',
        description: 'Vote option to spare (max 55 chars)',
      },
      positiveAnnouncement: {
        type: 'string',
        description: 'Announcement if kicked (max 1500 chars)',
      },
      negativeAnnouncement: {
        type: 'string',
        description: 'Announcement if spared (max 1500 chars)',
      },
    },
    required: [
      'question',
      'positiveOption',
      'negativeOption',
      'positiveAnnouncement',
      'negativeAnnouncement',
    ],
    additionalProperties: false,
  },
};

@Injectable()
export class KickPollAiService {
  private readonly logger = new Logger(KickPollAiService.name);

  constructor(private readonly botConfig: BotConfigService) {}

  async generatePollContent(username: string): Promise<AiPollContent> {
    try {
      const content = await this.callOpenAI(username);
      return this.validateAndTruncate(content, username);
    } catch (error) {
      this.logger.error(`Failed to generate AI content: ${error}`);
      return this.getFallbackContent(username);
    }
  }

  private async callOpenAI(username: string): Promise<AiPollContent> {
    const apiKey = this.botConfig.getOpenAIApiKey();
    const model = this.botConfig.getOpenAIModel();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: 'json_schema',
          json_schema: JSON_SCHEMA,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Username: ${username}` },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    return JSON.parse(content) as AiPollContent;
  }

  private validateAndTruncate(
    content: AiPollContent,
    username: string,
  ): AiPollContent {
    return {
      question: this.truncate(
        this.replaceUsername(content.question, username),
        300,
      ),
      positiveOption: this.truncate(content.positiveOption, 55),
      negativeOption: this.truncate(content.negativeOption, 55),
      positiveAnnouncement: this.truncate(
        this.replaceUsername(content.positiveAnnouncement, username),
        1500,
      ),
      negativeAnnouncement: this.truncate(
        this.replaceUsername(content.negativeAnnouncement, username),
        1500,
      ),
    };
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  private replaceUsername(text: string, username: string): string {
    return text.replace(/{username}/g, username);
  }

  private getFallbackContent(username: string): AiPollContent {
    return {
      question: FALLBACK_CONTENT.question.replace('{username}', username),
      positiveOption: FALLBACK_CONTENT.positiveOption,
      negativeOption: FALLBACK_CONTENT.negativeOption,
      positiveAnnouncement: FALLBACK_CONTENT.positiveAnnouncement.replace(
        '{username}',
        username,
      ),
      negativeAnnouncement: FALLBACK_CONTENT.negativeAnnouncement.replace(
        '{username}',
        username,
      ),
    };
  }
}
