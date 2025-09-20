/**
 * Input validation utilities
 * 
 * Security Note: API key format validation is intentionally minimal. We only validate
 * presence, not specific formats (prefixes, lengths, etc.) to avoid:
 * - False positives from legitimate keys that don't match expected patterns
 * - Security vulnerabilities from client-side format assumptions
 * - Maintenance overhead as providers change their key formats
 * 
 * Each LLM provider handles their own key format validation during API calls,
 * which is more secure and reliable than client-side checks.
 */

import { z } from 'zod';
import type { ActionInputs, RepoInfo } from '../types/inputs.js';
import { logger } from './logger.js';
import { ERROR, INPUT_FIELD_MAP } from '../config/constants.js';

/**
 * Zod schema for action inputs validation
 */
const ActionInputsSchema = z
  .object({
    augmentSessionAuth: z.string().optional(),
    augmentApiToken: z.string().optional(),
    augmentApiUrl: z.string().optional(),
    githubToken: z.string().optional(),
    instruction: z.string().optional(),
    instructionFile: z.string().optional(),
    model: z.string().optional(),
    templateDirectory: z.string().optional(),
    templateName: z.string().default('prompt.njk'),
    customContext: z.string().optional(),
    pullNumber: z.number().int().positive('Pull number must be a positive integer').optional(),
    repoName: z
      .string()
      .regex(/^[^\/]+\/[^\/]+$/, ERROR.INPUT.REPO_FORMAT)
      .optional(),
    // Platform and Azure DevOps fields
    platform: z.enum(['github', 'azure-devops']).default('github'),
    azureDevOpsToken: z.string().optional(),
    azureDevOpsOrganization: z.string().optional(),
    azureDevOpsProject: z.string().optional(),
    azureDevOpsRepository: z.string().optional(),
    azureDevOpsPullRequestId: z.number().int().positive('Azure DevOps pull request ID must be a positive integer').optional(),
    azureDevOpsWorkItemId: z.number().int().positive('Azure DevOps work item ID must be a positive integer').optional(),
    azureDevOpsBuildId: z.number().int().positive('Azure DevOps build ID must be a positive integer').optional(),
    // LLM Provider fields
    llmProvider: z.enum(['auggie', 'openai', 'claude', 'google']).default('auggie'),
    llmApiKey: z.string().optional(),
    llmBaseUrl: z.string().optional(),
    llmTemperature: z.number().min(0).max(2).default(0.7),
    llmMaxTokens: z.number().int().positive('Max tokens must be a positive integer').default(4000),
    llmTimeout: z.number().int().positive('Timeout must be a positive integer').default(30000),
  })
  .refine(
    (data: any) => {
      const hasInstruction = data.instruction || data.instructionFile;
      const hasTemplate = data.templateDirectory;
      return hasInstruction || hasTemplate;
    },
    {
      message: ERROR.INPUT.MISSING_INSTRUCTION_OR_TEMPLATE,
      path: ['instruction', 'instructionFile', 'templateDirectory'],
    }
  )
  .refine(
    (data: any) => {
      const hasInstruction = data.instruction || data.instructionFile;
      const hasTemplate = data.templateDirectory;
      return !(hasInstruction && hasTemplate);
    },
    {
      message: ERROR.INPUT.CONFLICTING_INSTRUCTION_TEMPLATE,
      path: ['instruction', 'instructionFile', 'templateDirectory'],
    }
  )
  .refine((data: any) => !(data.instruction && data.instructionFile), {
    message: ERROR.INPUT.CONFLICTING_INSTRUCTION_INPUTS,
    path: ['instruction', 'instructionFile'],
  })
  .refine(
    (data: any) => {
      const hasPullNumber = data.pullNumber !== undefined;
      const hasRepoName = data.repoName !== undefined;
      return hasPullNumber === hasRepoName;
    },
    {
      message: ERROR.INPUT.MISMATCHED_PR_FIELDS,
      path: ['pullNumber', 'repoName'],
    }
  )
  .refine(
    (data: any) => {
      if (!data.customContext) return true;
      try {
        JSON.parse(data.customContext);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: ERROR.INPUT.INVALID_CONTEXT_JSON,
      path: ['customContext'],
    }
  )
  .refine(
    (data: any) => {
      const hasSessionAuth = data.augmentSessionAuth;
      const hasTokenAuth = data.augmentApiToken && data.augmentApiUrl;
      return hasSessionAuth || hasTokenAuth;
    },
    {
      message:
        'Either augment_session_auth or both augment_api_token and augment_api_url must be provided',
      path: ['augmentSessionAuth', 'augmentApiToken', 'augmentApiUrl'],
    }
  )
  .refine(
    (data: any) => {
      const hasSessionAuth = data.augmentSessionAuth;
      const hasTokenAuth = data.augmentApiToken || data.augmentApiUrl;
      return !(hasSessionAuth && hasTokenAuth);
    },
    {
      message:
        'Cannot use both augment_session_auth and augment_api_token/augment_api_url simultaneously',
      path: ['augmentSessionAuth', 'augmentApiToken', 'augmentApiUrl'],
    }
  )
  .refine(
    (data: any) => {
      if (!data.augmentSessionAuth) return true;
      try {
        JSON.parse(data.augmentSessionAuth);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'augment_session_auth must be valid JSON',
      path: ['augmentSessionAuth'],
    }
  )
  .refine(
    (data: any) => {
      if (!data.augmentApiUrl) return true;
      try {
        // More robust URL validation pattern that handles paths, query params, etc.
        const urlPattern = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[-a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=\/]*)$/;
        const url = data.augmentApiUrl.trim();
        
        // Check basic pattern and ensure it has a proper domain structure
        if (!urlPattern.test(url)) return false;
        
        // Additional validation: ensure there's a domain with TLD after the protocol
        const urlParts = url.split('://');
        if (urlParts.length !== 2) return false;
        
        const domainPart = urlParts[1].split('/')[0].split('?')[0]; // Extract domain part
        const domainParts = domainPart.split('.');
        
        // Must have at least one dot in domain (e.g., example.com)
        return domainParts.length >= 2 && domainParts.every((part: string) => part.length > 0);
      } catch {
        return false;
      }
    },
    {
      message: 'Augment API URL must be a valid HTTP(S) URL with a proper domain',
      path: ['augmentApiUrl'],
    }
  )
  .refine(
    (data: any) => {
      if (!data.llmBaseUrl) return true;
      try {
        // More robust URL validation pattern that handles paths, query params, etc.
        const urlPattern = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[-a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=\/]*)$/;
        const url = data.llmBaseUrl.trim();
        
        // Check basic pattern and ensure it has a proper domain structure
        if (!urlPattern.test(url)) return false;
        
        // Additional validation: ensure there's a domain with TLD after the protocol
        const urlParts = url.split('://');
        if (urlParts.length !== 2) return false;
        
        const domainPart = urlParts[1].split('/')[0].split('?')[0]; // Extract domain part
        const domainParts = domainPart.split('.');
        
        // Must have at least one dot in domain (e.g., example.com)
        return domainParts.length >= 2 && domainParts.every((part: string) => part.length > 0);
      } catch {
        return false;
      }
    },
    {
      message: 'LLM Base URL must be a valid HTTP(S) URL with a proper domain',
      path: ['llmBaseUrl'],
    }
  )
  .refine(
    (data: any) => {
      // If platform is azure-devops, validate Azure DevOps configuration
      if (data.platform === 'azure-devops') {
        const hasAzureDevOpsConfig = data.azureDevOpsToken && 
                                   data.azureDevOpsOrganization && 
                                   data.azureDevOpsProject && 
                                   data.azureDevOpsRepository;
        return hasAzureDevOpsConfig;
      }
      return true;
    },
    {
      message: 'Azure DevOps platform requires azure_devops_token, azure_devops_organization, azure_devops_project, and azure_devops_repository',
      path: ['platform'],
    }
  )
  .refine(
    (data: any) => {
      // Only require Azure DevOps context IDs when using templates
      // This allows for:
      // 1. Direct instruction/instruction_file usage without context
      // 2. Repository-wide analysis templates using only custom context
      // 3. General purpose templates that don't need specific PR/work item/build context
      if (data.platform === 'azure-devops' && data.templateDirectory) {
        // For template-based execution, we could validate context requirements
        // at template processing time instead of input validation time.
        // This allows templates to be more flexible in their context requirements.
        // The Azure DevOps context extractor's shouldExtract() method will determine
        // if specific context extraction is needed based on available IDs.
        return true;
      }
      return true;
    },
    {
      message: 'Azure DevOps context validation handled at template processing time',
      path: ['platform'],
    }
  )
  .refine(
    (data: any) => {
      // If LLM provider is not auggie, validate API key is provided
      // We only validate presence, not format - let the provider handle format validation
      // to avoid false positives and security issues with client-side format checks
      if (data.llmProvider !== 'auggie') {
        return !!(data.llmApiKey && data.llmApiKey.trim().length > 0);
      }
      return true;
    },
    {
      message: 'LLM provider requires API key when not using auggie',
      path: ['llmProvider'],
    }
  );

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate action inputs from environment variables
   */
  static validateInputs(): ActionInputs {
    try {
      logger.debug('Reading action inputs from environment variables');

      // Build inputs object from field map
      const inputs = Object.fromEntries(
        Object.entries(INPUT_FIELD_MAP)
          .map(([key, fieldDef]) => {
            const value = process.env[fieldDef.envVar];

            // Skip optional fields if no value set
            if (!fieldDef.required && !value) {
              return null;
            }

            // Apply transformation if defined
            const transformedValue =
              fieldDef.transform && value ? fieldDef.transform(value) : value;

            return [key, transformedValue];
          })
          .filter((entry): entry is [string, any] => entry !== null)
      );

      logger.debug('Validating action inputs');
      const validated = ActionInputsSchema.parse(inputs) as ActionInputs;
      logger.debug('Action inputs validated successfully');
      return validated;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`);
        const message = `${ERROR.INPUT.INVALID}: ${errorMessages.join(', ')}`;
        logger.error(message, error);
        throw new Error(message);
      }
      logger.error('Unexpected validation error', error);
      throw error;
    }
  }

  /**
   * Parse repository name into owner and repo
   */
  static parseRepoName(repoName: string): RepoInfo {
    logger.debug('Parsing repository name', { repoName });

    const parts = repoName.split('/');
    if (parts.length !== 2) {
      const message = `${ERROR.INPUT.REPO_FORMAT}: ${repoName}`;
      logger.error(message);
      throw new Error(message);
    }

    const [owner, repo] = parts;
    if (!owner || !repo) {
      const message = `${ERROR.INPUT.REPO_FORMAT}: ${repoName}. Owner and repo cannot be empty`;
      logger.error(message);
      throw new Error(message);
    }

    const result = { owner, repo };
    logger.debug('Repository name parsed successfully', result);
    return result;
  }
}
