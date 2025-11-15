import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV1 } from 'ai';

/**
 * Get the configured language model based on environment variables
 *
 * Environment variables:
 * - LLM_PROVIDER: The provider to use ('anthropic' or 'openai'). Defaults to 'anthropic'.
 * - LLM_MODEL: (Optional) Override the default model for the selected provider
 * - ANTHROPIC_API_KEY: API key for Anthropic (required if using Anthropic)
 * - OPENAI_API_KEY: API key for OpenAI (required if using OpenAI)
 */
export function getLanguageModel(): LanguageModelV1 {
  const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();

  switch (provider) {
  case 'anthropic': {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const model = process.env.LLM_MODEL || 'claude-opus-4-20250514';
    console.info(`Using Anthropic provider with model: ${model}`);
    return anthropic(model);
  }

  case 'openai': {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const model = process.env.LLM_MODEL || 'gpt-4o';
    console.info(`Using OpenAI provider with model: ${model}`);
    return openai(model);
  }

  default: {
    console.warn(
      `Unknown LLM provider "${provider}". Falling back to Anthropic. ` +
        'Supported providers: anthropic, openai',
    );
    const anthropicFallback = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const modelFallback = 'claude-opus-4-20250514';
    console.info(`Using Anthropic provider (fallback) with model: ${modelFallback}`);
    return anthropicFallback(modelFallback);
  }
  }
}
