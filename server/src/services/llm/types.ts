/**
 * LLM Provider Abstraction
 *
 * This module provides a model-agnostic interface for interacting with different LLM providers
 * (e.g., Anthropic, OpenAI, etc.) allowing the application to switch between providers via
 * environment variables.
 */

/**
 * A message in the conversation
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Configuration for an LLM completion request
 */
export interface LLMCompletionRequest {
  /** System prompt that sets the behavior of the AI */
  systemPrompt?: string;
  /** Conversation messages */
  messages: LLMMessage[];
  /** Maximum tokens to generate in the response */
  maxTokens: number;
  /** Temperature for response randomness (0-1 or 0-2 depending on provider) */
  temperature: number;
  /** Optional model override (uses provider default if not specified) */
  model?: string;
}

/**
 * Response from an LLM completion request
 */
export interface LLMCompletionResponse {
  /** The generated text content */
  content: string;
  /** Model that was used for this completion */
  model: string;
  /** Total tokens used in this request */
  tokensUsed?: number;
}

/**
 * Interface that all LLM providers must implement
 */
export interface LLMProvider {
  /** The name of this provider (e.g., "anthropic", "openai") */
  readonly name: string;

  /** Default model to use if none is specified */
  readonly defaultModel: string;

  /**
   * Generate a completion based on the provided request
   */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
