/**
 * Google (Gemini) LLM Provider
 * Implements Google Gemini API integration
 */

import { LLMProvider, LLMConfig, LLMResponse } from '../llm-interface.js';
import { logger } from '../../../utils/logger.js';

export class GoogleProvider implements LLMProvider {
  private config: LLMConfig;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async generateResponse(instruction: string, context?: any): Promise<LLMResponse> {
    try {
      logger.debug('Generating response with Google Gemini', {
        model: this.config.model,
        baseUrl: this.baseUrl,
        instructionLength: instruction.length,
      });

      const model = this.config.model || 'gemini-pro';
      const response = await this.makeRequest(`/models/${model}:generateContent`, {
        contents: [
          {
            parts: [
              {
                text: instruction,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.config.temperature || 0.7,
          maxOutputTokens: this.config.maxTokens || 4000,
          topP: 0.8,
          topK: 10,
        },
      });

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageMetadata = response.usageMetadata;

      return {
        content,
        usage: usageMetadata
          ? {
              promptTokens: usageMetadata.promptTokenCount || 0,
              completionTokens: usageMetadata.candidatesTokenCount || 0,
              totalTokens: usageMetadata.totalTokenCount || 0,
            }
          : undefined,
        model: model,
        finishReason: response.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      logger.error('Google provider failed to generate response', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'Google (Gemini)';
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/models', 'GET');
      return (
        response.models
          ?.filter((model: any) => model.name.includes('gemini'))
          .map((model: any) => model.name.split('/').pop())
          .sort() || ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash']
      );
    } catch (error) {
      logger.warn('Failed to get available models from Google', error);
      return ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    }
  }

  validateConfig(): boolean {
    return !!(this.config.apiKey && this.config.apiKey.length > 20);
  }

  private async makeRequest(
    endpoint: string,
    body?: any,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'augment-agent/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: this.config.timeout ? AbortSignal.timeout(this.config.timeout) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`
      );
    }

    return await response.json();
  }
}
