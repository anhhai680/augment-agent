/**
 * LLM Provider Factory
 * Creates appropriate LLM provider instances based on configuration
 */

import { LLMProvider, LLMProviderType, LLMConfig } from './llm-interface.js';
import { AuggieProvider } from './providers/auggie-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { ClaudeProvider } from './providers/claude-provider.js';
import { GoogleProvider } from './providers/google-provider.js';
import { logger } from '../../utils/logger.js';

export class LLMFactory {
  /**
   * Create an LLM provider instance
   * @param providerType The type of provider to create
   * @param config Configuration for the provider
   * @returns LLM provider instance
   */
  static createProvider(providerType: LLMProviderType, config: LLMConfig): LLMProvider {
    logger.debug('Creating LLM provider', { providerType, hasApiKey: !!config.apiKey });

    switch (providerType) {
      case 'auggie':
        return new AuggieProvider(config);

      case 'openai':
        return new OpenAIProvider(config);

      case 'claude':
        return new ClaudeProvider(config);

      case 'google':
        return new GoogleProvider(config);

      default:
        throw new Error(`Unknown LLM provider: ${providerType}`);
    }
  }

  /**
   * Get all available provider types
   */
  static getAvailableProviders(): LLMProviderType[] {
    return ['auggie', 'openai', 'claude', 'google'];
  }

  /**
   * Validate provider configuration
   * @param providerType The provider type
   * @param config The configuration
   * @returns True if configuration is valid
   */
  static validateProviderConfig(providerType: LLMProviderType, config: LLMConfig): boolean {
    try {
      const provider = this.createProvider(providerType, config);
      return provider.validateConfig();
    } catch (error) {
      logger.error('Provider configuration validation failed', error);
      return false;
    }
  }
}
