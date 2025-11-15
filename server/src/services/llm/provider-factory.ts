import { LLMProvider } from './types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';

/**
 * Creates an LLM provider based on environment configuration
 *
 * Environment variables:
 * - LLM_PROVIDER: The provider to use ('anthropic' or 'openai'). Defaults to 'anthropic'.
 * - LLM_MODEL: (Optional) Override the default model for the selected provider
 * - ANTHROPIC_API_KEY: API key for Anthropic (required if using Anthropic)
 * - OPENAI_API_KEY: API key for OpenAI (required if using OpenAI)
 */
export function createLLMProvider(): LLMProvider {
  const providerName = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();

  let provider: LLMProvider;

  switch (providerName) {
  case 'anthropic':
    provider = new AnthropicProvider();
    break;

  case 'openai':
    provider = new OpenAIProvider();
    break;

  default:
    console.warn(
      `Unknown LLM provider "${providerName}". Falling back to Anthropic. ` +
        'Supported providers: anthropic, openai',
    );
    provider = new AnthropicProvider();
    break;
  }

  console.info(`Using LLM provider: ${provider.name} (default model: ${provider.defaultModel})`);

  return provider;
}

/**
 * Gets the configured model name, falling back to provider default
 */
export function getConfiguredModel(provider: LLMProvider): string {
  return process.env.LLM_MODEL || provider.defaultModel;
}
