/**
 * Auggie LLM Provider
 * Wraps the existing Auggie CLI functionality
 */

import { spawn } from 'child_process';
import { LLMProvider, LLMConfig, LLMResponse } from '../llm-interface.js';
import { logger } from '../../../utils/logger.js';
import { FileUtils } from '../../../utils/file-utils.js';
import { PATHS } from '../../../config/constants.js';

export class AuggieProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async generateResponse(instruction: string, context?: any): Promise<LLMResponse> {
    try {
      logger.debug('Generating response with Auggie', { 
        model: this.config.model,
        instructionLength: instruction.length 
      });

      // Create temporary instruction file
      const instructionFile = await this.createInstructionFile(instruction);
      
      // Build auggie command arguments
      const args = ['--print'];
      
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      
      args.push('--instruction-file', instructionFile);

      // Execute auggie command
      const response = await this.executeAuggieCommand(args);
      
      // Clean up temporary file
      await FileUtils.deleteFile(instructionFile);

      return {
        content: response,
        model: this.config.model || 'default',
        finishReason: 'stop'
      };
    } catch (error) {
      logger.error('Auggie provider failed to generate response', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'Auggie';
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      // Execute auggie --list-models command
      const response = await this.executeAuggieCommand(['--list-models']);
      
      // Parse the response to extract model names
      const models = response
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('Available models:'))
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return models;
    } catch (error) {
      logger.warn('Failed to get available models from Auggie', error);
      return ['default'];
    }
  }

  validateConfig(): boolean {
    // Auggie doesn't require API key validation as it uses session auth
    return true;
  }

  private async createInstructionFile(instruction: string): Promise<string> {
    const instructionFile = `${PATHS.TEMP_DIR}/auggie-instruction-${Date.now()}.txt`;
    await FileUtils.writeFile(instructionFile, instruction);
    return instructionFile;
  }

  private async executeAuggieCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('auggie', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          // Set Auggie authentication environment variables
          AUGMENT_SESSION_AUTH: process.env.AUGMENT_SESSION_AUTH,
          AUGMENT_API_TOKEN: process.env.AUGMENT_API_TOKEN,
          AUGMENT_API_URL: process.env.AUGMENT_API_URL,
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          const error = new Error(`Auggie command failed with exit code ${code}: ${stderr}`);
          logger.error('Auggie command failed', { code, stderr, args });
          reject(error);
        }
      });

      child.on('error', (error) => {
        logger.error('Auggie command error', error);
        reject(error);
      });
    });
  }
}
