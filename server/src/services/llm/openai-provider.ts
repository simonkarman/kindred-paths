import OpenAI from 'openai';
import { LLMProvider, LLMCompletionRequest, LLMCompletionResponse } from './types';

/**
 * OpenAI LLM Provider
 *
 * Implements the LLMProvider interface using OpenAI's GPT models.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai';
  public readonly defaultModel = 'gpt-4o';

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    const systemPrompt = request.systemPrompt ||
      request.messages.find(msg => msg.role === 'system')?.content;
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add conversation messages
    request.messages
      .filter(msg => msg.role !== 'system')
      .forEach(msg => {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      });

    const response = await this.client.chat.completions.create({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    return {
      content,
      model: response.model,
      tokensUsed: response.usage?.total_tokens,
    };
  }
}
