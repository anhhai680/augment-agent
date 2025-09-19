#!/usr/bin/env bun

/**
 * Augment Agent GitHub Action
 * Main entry point for the action
 */

import { spawn, SpawnOptions } from 'child_process';
import process from 'process';
import { ValidationUtils } from './utils/validation.js';
import { TemplateProcessor } from './template/template-processor.js';
import { LLMFactory } from './services/llm/llm-factory.js';
import { logger } from './utils/logger.js';
import { ActionInputs } from './types/inputs.js';

/**
 * Execute a shell command and return a promise
 */
function execCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Join command and args into a single shell command for proper quoting
    const fullCommand = `${command} ${args
      .map(arg => {
        // Properly quote arguments that contain spaces or special characters
        if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      })
      .join(' ')}`;

    const child = spawn(fullCommand, [], {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', code => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Set up environment variables for the augment script
 */
function setupEnvironment(inputs: ActionInputs): void {
  // Set authentication environment variables
  if (inputs.augmentSessionAuth) {
    // Use session authentication
    process.env.AUGMENT_SESSION_AUTH = inputs.augmentSessionAuth;
  } else {
    // Use token + URL authentication
    process.env.AUGMENT_API_TOKEN = inputs.augmentApiToken;
    process.env.AUGMENT_API_URL = inputs.augmentApiUrl;
  }

  // Set GitHub token if provided
  if (inputs.githubToken) {
    process.env.GITHUB_API_TOKEN = inputs.githubToken;
  }
}

/**
 * Process templates and generate instruction file
 */
async function processTemplate(inputs: ActionInputs): Promise<string> {
  logger.info('Preparing template', {
    templateDirectory: inputs.templateDirectory,
    templateName: inputs.templateName,
  });

  // Create and run template processor
  const processor = TemplateProcessor.create(inputs);
  const instructionFilePath = await processor.processTemplate(inputs);

  logger.info('Template processing completed', {
    instructionFile: instructionFilePath,
  });

  return instructionFilePath;
}

/**
 * Run the LLM with appropriate provider
 */
async function runLLM(inputs: ActionInputs): Promise<void> {
  let instruction_value: string;
  let is_file: boolean;
  
  if (inputs.instruction) {
    instruction_value = inputs.instruction;
    is_file = false;
    logger.debug('Using direct instruction', { instruction: inputs.instruction });
  } else if (inputs.instructionFile) {
    instruction_value = inputs.instructionFile;
    is_file = true;
    logger.debug('Using instruction file', { instructionFile: inputs.instructionFile });
  } else {
    instruction_value = await processTemplate(inputs);
    is_file = true;
    logger.debug('Using template-generated instruction file', {
      instructionFile: instruction_value,
    });
  }

  // Determine LLM provider
  const providerType = inputs.llmProvider || 'auggie';
  logger.info(`🤖 Using LLM provider: ${providerType}`);

  if (providerType === 'auggie') {
    // Use existing Auggie CLI approach for backward compatibility
    await runAuggieScript(inputs, instruction_value, is_file);
  } else {
    // Use new LLM provider system
    await runCustomLLM(inputs, instruction_value, is_file);
  }
}

/**
 * Run Auggie script with appropriate arguments (backward compatibility)
 */
async function runAuggieScript(inputs: ActionInputs, instruction_value: string, is_file: boolean): Promise<void> {
  const args = ['--print'];
  if (inputs.model && inputs.model.trim().length > 0) {
    args.push('--model', inputs.model.trim());
  }
  if (is_file) {
    logger.info(`📄 Using instruction file: ${instruction_value}`);
    args.push('--instruction-file');
  } else {
    logger.info('📝 Using direct instruction');
    args.push('--instruction');
  }
  args.push(instruction_value);
  await execCommand('auggie', args);
  logger.info('✅ Augment Agent completed successfully');
}

/**
 * Run custom LLM provider
 */
async function runCustomLLM(inputs: ActionInputs, instruction_value: string, is_file: boolean): Promise<void> {
  try {
    // Create LLM provider
    const llmProvider = LLMFactory.createProvider(inputs.llmProvider!, {
      apiKey: inputs.llmApiKey!,
      baseUrl: inputs.llmBaseUrl,
      model: inputs.model || undefined,
      temperature: inputs.llmTemperature,
      maxTokens: inputs.llmMaxTokens,
      timeout: inputs.llmTimeout
    });

    // Validate configuration
    if (!llmProvider.validateConfig()) {
      throw new Error(`Invalid configuration for ${llmProvider.getProviderName()} provider`);
    }

    // Read instruction content if it's a file
    let instructionContent = instruction_value;
    if (is_file) {
      const fs = await import('fs/promises');
      instructionContent = await fs.readFile(instruction_value, 'utf-8');
    }

    logger.info(`🚀 Generating response with ${llmProvider.getProviderName()}`);
    
    // Generate response
    const response = await llmProvider.generateResponse(instructionContent);
    
    // Output the response
    console.log(response.content);
    
    // Log usage information if available
    if (response.usage) {
      logger.info('📊 Token usage', {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens
      });
    }
    
    logger.info('✅ Augment Agent completed successfully');
  } catch (error) {
    logger.error('Custom LLM provider failed', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    logger.info('🔍 Validating inputs...');
    const inputs = ValidationUtils.validateInputs();

    logger.info('⚙️ Setting up environment...');
    setupEnvironment(inputs);

    logger.info('🚀 Starting Augment Agent...');
    await runLLM(inputs);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.setFailed(errorMessage);
  }
}

// Run the action only if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.setFailed(`Unexpected error: ${errorMessage}`);
  });
}
