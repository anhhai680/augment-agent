/**
 * LLM Provider Interface
 * Defines the contract for all LLM providers
 */

export interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface LLMProvider {
  /**
   * Generate a response from the LLM
   * @param instruction The instruction/prompt to send to the LLM
   * @param context Optional context data to include
   * @returns Promise resolving to LLM response
   */
  generateResponse(instruction: string, context?: any): Promise<LLMResponse>;

  /**
   * Get the name of the provider
   */
  getProviderName(): string;

  /**
   * Get available models for this provider
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * Validate the configuration
   */
  validateConfig(): boolean;
}

export type LLMProviderType = 'auggie' | 'openai' | 'claude' | 'google';
