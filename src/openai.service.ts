import { Injectable, Logger } from '@nestjs/common';
import { BotConfigService } from './bot-config.service';

const COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * No timeout at all meant a hung request hung its caller indefinitely — and in
 * the mention responder that also held the user's concurrency slot.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

export interface ChatRequest {
  system: string;
  user: string;
  /** Pass to force a structured response via OpenAI's json_schema mode. */
  jsonSchema?: object;
  timeoutMs?: number;
}

/**
 * The single place the project talks to OpenAI. Three services previously
 * hand-rolled the same fetch, error handling and payload shaping.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly botConfig: BotConfigService) {}

  /** Returns the assistant's message content, never empty. */
  async chat({
    system,
    user,
    jsonSchema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: ChatRequest): Promise<string> {
    const model = this.botConfig.getOpenAIModel();

    let response: Response;
    try {
      response = await fetch(COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.botConfig.getOpenAIApiKey()}`,
        },
        body: JSON.stringify({
          model,
          ...(jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: jsonSchema,
                },
              }
            : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error: unknown) {
      // A timeout surfaces here as an AbortError rather than a bad response.
      const reason =
        error instanceof Error && error.name === 'TimeoutError'
          ? `timed out after ${timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger.error(`OpenAI request failed: ${reason}`);
      throw new Error(`OpenAI request failed: ${reason}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
      );
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    return content;
  }

  /** As chat(), but parses the response against the supplied json_schema. */
  async chatJson<T>(request: ChatRequest & { jsonSchema: object }): Promise<T> {
    const content = await this.chat(request);

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error('OpenAI returned malformed JSON');
    }
  }
}
