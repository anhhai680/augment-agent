/**
 * OpenAI LLM Provider
 * Implements OpenAI API integration
 */

import { LLMProvider, LLMConfig, LLMResponse } from '../llm-interface.js';
import { logger } from '../../../utils/logger.js';

export class OpenAIProvider implements LLMProvider {
  private config: LLMConfig;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async generateResponse(instruction: string, context?: any): Promise<LLMResponse> {
    try {
      logger.debug('Generating response with OpenAI', {
        model: this.config.model,
        baseUrl: this.baseUrl,
        instructionLength: instruction.length,
      });

      const response = await this.makeRequest({
        model: this.config.model || 'gpt-4',
        messages: [
          {
            role: 'user',
            content: instruction,
          },
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 4000,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        model: response.model,
        finishReason: response.choices[0]?.finish_reason,
      };
    } catch (error) {
      logger.error('OpenAI provider failed to generate response', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models', 'GET');
      return response.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      logger.warn('Failed to get available models from OpenAI', error);
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
    }
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.apiKey.startsWith('sk-'));
  }

  private async makeRequest(
    endpoint: string | object,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const url =
      typeof endpoint === 'string'
        ? `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
        : `${this.baseUrl}/chat/completions`;

    const body = typeof endpoint === 'object' ? JSON.stringify(endpoint) : undefined;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'augment-agent/1.0',
      },
      body,
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    return await response.json();
  }
}
