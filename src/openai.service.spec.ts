import { OpenAiService } from './openai.service';
import { BotConfigService } from './bot-config.service';

describe('OpenAiService', () => {
  const botConfig = {
    getOpenAIApiKey: () => 'test-key',
    getOpenAIModel: () => 'gpt-4o-mini',
  } as BotConfigService;

  const service = new OpenAiService(botConfig);

  // Typed args so the assertions below can read the request without casts.
  type FetchArgs = [url: string, init: { body: string; signal?: AbortSignal }];
  const fetchMock = jest.fn<Promise<unknown>, FetchArgs>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const reply = (content: string) => ({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  });

  const requestInit = () => fetchMock.mock.calls[0][1];

  const body = () =>
    JSON.parse(requestInit().body) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      response_format?: unknown;
    };

  describe('chat', () => {
    it('sends the system and user prompts and returns the content', async () => {
      fetchMock.mockResolvedValue(reply('  raspuns  '));

      const result = await service.chat({ system: 'be rude', user: 'hello' });

      expect(result).toBe('raspuns');
      expect(body().messages).toEqual([
        { role: 'system', content: 'be rude' },
        { role: 'user', content: 'hello' },
      ]);
    });

    it('omits response_format when no schema is given', async () => {
      fetchMock.mockResolvedValue(reply('ok'));

      await service.chat({ system: 's', user: 'u' });

      expect(body()).not.toHaveProperty('response_format');
    });

    it('sends json_schema mode when a schema is given', async () => {
      fetchMock.mockResolvedValue(reply('{}'));

      await service.chat({ system: 's', user: 'u', jsonSchema: { name: 'x' } });

      expect(body().response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'x' },
      });
    });

    it('throws on a non-ok response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('rate limited'),
      });

      await expect(service.chat({ system: 's', user: 'u' })).rejects.toThrow(
        'OpenAI API error: 429',
      );
    });

    it('throws when the response has no content', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      await expect(service.chat({ system: 's', user: 'u' })).rejects.toThrow(
        'empty response',
      );
    });

    // Previously there was no timeout at all, so a hung request hung its
    // caller — and in the mention responder, held that user's slot.
    it('reports a timeout distinctly', async () => {
      const timeout = new Error('aborted');
      timeout.name = 'TimeoutError';
      fetchMock.mockRejectedValue(timeout);

      await expect(
        service.chat({ system: 's', user: 'u', timeoutMs: 50 }),
      ).rejects.toThrow('timed out after 50ms');
    });

    it('passes an abort signal', async () => {
      fetchMock.mockResolvedValue(reply('ok'));

      await service.chat({ system: 's', user: 'u' });

      expect(requestInit().signal).toBeDefined();
    });
  });

  describe('chatJson', () => {
    it('parses a structured response', async () => {
      fetchMock.mockResolvedValue(reply('{"question":"de ce?"}'));

      const result = await service.chatJson<{ question: string }>({
        system: 's',
        user: 'u',
        jsonSchema: { name: 'x' },
      });

      expect(result).toEqual({ question: 'de ce?' });
    });

    it('throws a clear error on malformed JSON', async () => {
      fetchMock.mockResolvedValue(reply('not json'));

      await expect(
        service.chatJson({ system: 's', user: 'u', jsonSchema: {} }),
      ).rejects.toThrow('malformed JSON');
    });
  });
});
