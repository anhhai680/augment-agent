#!/usr/bin/env bun

/**
 * Augment Agent GitHub Action
 * Main entry point for the action
 */

import process from 'process';
import { ValidationUtils } from './utils/validation.js';
import { TemplateProcessor } from './template/template-processor.js';
import { LLMFactory } from './services/llm/llm-factory.js';
import { logger } from './utils/logger.js';
import { ActionInputs } from './types/inputs.js';

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

  // Use unified LLM provider system for all providers
  await runUnifiedLLM(inputs, instruction_value, is_file);
}

/**
 * Run LLM with unified provider system
 */
async function runUnifiedLLM(inputs: ActionInputs, instruction_value: string, is_file: boolean): Promise<void> {
  try {
    // Validate required fields for LLM providers
    if (!inputs.llmProvider) {
      throw new Error('LLM provider is required for LLM execution');
    }
    
    // Only validate API key for non-Auggie providers
    if (inputs.llmProvider !== 'auggie' && (!inputs.llmApiKey || inputs.llmApiKey.trim().length === 0)) {
      throw new Error(`API key is required for ${inputs.llmProvider} provider`);
    }

    // Create LLM provider
    const config: any = {
      apiKey: inputs.llmApiKey,
      model: inputs.model || undefined,
      temperature: inputs.llmTemperature,
      maxTokens: inputs.llmMaxTokens,
      timeout: inputs.llmTimeout
    };
    
    // Only add baseUrl if it's defined
    if (inputs.llmBaseUrl) {
      config.baseUrl = inputs.llmBaseUrl;
    }
    
    const llmProvider = LLMFactory.createProvider(inputs.llmProvider, config);

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
    
    // Output the response to console
    console.log(response.content);
    
    // Post comment to PR if requested and we have the necessary context
    await postCommentIfRequested(inputs, response.content);
    
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
    logger.error('LLM provider failed', error);
    throw error;
  }
}

/**
 * Post comment to PR if requested and context is available
 */
async function postCommentIfRequested(inputs: ActionInputs, content: string): Promise<void> {
  // Check if we should post a comment
  if (!inputs.postComment) {
    logger.debug('Comment posting not requested');
    return;
  }

  // Check if we have the necessary context for posting comments
  if (!inputs.githubToken || !inputs.repoName || !inputs.pullNumber) {
    logger.warning('Cannot post comment: missing required context (github_token, repo_name, pull_number)');
    return;
  }

  try {
    // Import required services
    const { GitHubService } = await import('./services/github-service.js');
    const { ValidationUtils } = await import('./utils/validation.js');
    const { ReviewParser } = await import('./services/review-parser.js');

    // Parse repository information
    const repoInfo = ValidationUtils.parseRepoName(inputs.repoName);
    
    // Create GitHub service
    const githubService = new GitHubService({
      token: inputs.githubToken,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
    });

    // Check if inline comments are requested
    if (inputs.useInlineComments) {
      logger.info(`📝 Processing inline comments for PR #${inputs.pullNumber}`);
      
      // Parse the review content for structured comments
      const parsedReview = ReviewParser.parseReview(content);
      
      if (parsedReview.comments && parsedReview.comments.length > 0) {
        const strategy = inputs.inlineCommentStrategy || 'review_with_comments';
        
        if (strategy === 'review_with_comments') {
          // Post all comments as part of a single review
          logger.info(`📝 Posting ${parsedReview.comments.length} inline comments as review to PR #${inputs.pullNumber}`);
          const reviewEvent = inputs.reviewEvent || 'COMMENT';
          await githubService.createPullRequestReviewWithComments(
            inputs.pullNumber,
            parsedReview.summary || 'Code review',
            parsedReview.comments,
            reviewEvent as 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'
          );
        } else if (strategy === 'individual_comments') {
          // Post each comment individually
          logger.info(`� Posting ${parsedReview.comments.length} individual inline comments to PR #${inputs.pullNumber}`);
          for (const comment of parsedReview.comments) {
            await githubService.createIndividualReviewComment(inputs.pullNumber, comment);
          }
          
          // Also post a summary comment if available
          if (parsedReview.summary) {
            await githubService.createPullRequestComment(inputs.pullNumber, parsedReview.summary);
          }
        }
        
        logger.info('✅ Inline comments posted successfully');
      } else {
        // Fall back to regular comment if no structured comments found
        logger.info('No structured comments found, falling back to regular comment');
        await postRegularComment(githubService, inputs, content);
      }
    } else {
      // Post regular comment
      await postRegularComment(githubService, inputs, content);
    }
    
  } catch (error) {
    logger.error('Failed to post comment to PR', error);
    // Don't throw the error - the main task was successful even if comment posting failed
  }
}

/**
 * Post a regular comment (non-inline)
 */
async function postRegularComment(githubService: any, inputs: ActionInputs, content: string): Promise<void> {
  const commentType = inputs.commentType || 'comment';
  
  if (commentType === 'review') {
    const reviewEvent = inputs.reviewEvent || 'COMMENT';
    logger.info(`📝 Posting review comment to PR #${inputs.pullNumber} with event: ${reviewEvent}`);
    await githubService.createPullRequestReview(inputs.pullNumber, content, reviewEvent as 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES');
  } else {
    logger.info(`💬 Posting comment to PR #${inputs.pullNumber}`);
    await githubService.createPullRequestComment(inputs.pullNumber, content);
  }
  
  logger.info('✅ Comment posted successfully');
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
