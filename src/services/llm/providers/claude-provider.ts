/**
 * Claude (Anthropic) LLM Provider
 * Implements Anthropic Claude API integration
 */

import { LLMProvider, LLMConfig, LLMResponse } from '../llm-interface.js';
import { logger } from '../../../utils/logger.js';

export class ClaudeProvider implements LLMProvider {
  private config: LLMConfig;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  }

  async generateResponse(instruction: string, context?: any): Promise<LLMResponse> {
    try {
      logger.debug('Generating response with Claude', { 
        model: this.config.model,
        baseUrl: this.baseUrl,
        instructionLength: instruction.length 
      });

      const response = await this.makeRequest({
        model: this.config.model || 'claude-3-sonnet-20240229',
        max_tokens: this.config.maxTokens || 4000,
        temperature: this.config.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: instruction
          }
        ]
      });

      return {
        content: response.content[0]?.text || '',
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        } : undefined,
        model: response.model,
        finishReason: response.stop_reason
      };
    } catch (error) {
      logger.error('Claude provider failed to generate response', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'Claude (Anthropic)';
  }

  async getAvailableModels(): Promise<string[]> {
    // Anthropic doesn't provide a model-listing endpoint, return known models
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.apiKey.startsWith('sk-ant-'));
  }

  private async makeRequest(endpoint: string | object, method: 'GET' | 'POST' = 'POST'): Promise<any> {
    const url = typeof endpoint === 'string' 
      ? `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      : `${this.baseUrl}/messages`;

    const body = typeof endpoint === 'object' ? JSON.stringify(endpoint) : undefined;

    const response = await fetch(url, {
      method,
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'User-Agent': 'augment-agent/1.0'
      },
      body,
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  }
}
