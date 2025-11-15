import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMCompletionRequest, LLMCompletionResponse } from './types';

/**
 * Anthropic LLM Provider
 *
 * Implements the LLMProvider interface using Anthropic's Claude models.
 */
export class AnthropicProvider implements LLMProvider {
  public readonly name = 'anthropic';
  public readonly defaultModel = 'claude-opus-4-20250514';

  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const messages: Anthropic.Messages.MessageParam[] = request.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const systemPrompt = request.systemPrompt ||
      request.messages.find(msg => msg.role === 'system')?.content;

    const response = await this.client.messages.create({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(c => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response received from Anthropic');
    }

    return {
      content: textBlock.text,
      model: response.model,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }
}
